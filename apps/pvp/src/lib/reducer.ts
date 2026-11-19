import type { Ballot, GamesBallot, Placement, PlayerId, Series, SeriesStage, Stage, TieDraw, Tournament } from '../types/tournament.js';
import { type Random, drawGroupSeries, drawSemifinalGroups, shuffle } from './draw.js';
import { SUPPORTED_COUNTS, WINS_NEEDED, formatFor, isSupportedCount } from './format.js';
import type { Translatable } from './i18n.js';
import { MAX_DISPLAY_NAME, MAX_DISPLAY_NAMES, isDiscordUsername, nameLookup, normalizeUsername } from './names.js';
import { gamesLineOf, hasGamesPrediction, normalizeAnswer } from './polls.js';
import {
  groupSeries,
  groupStageOutcome,
  pendingTies,
  semifinalGroups,
  semifinalSelection,
  semifinalSeriesFrom,
  survivalPlan,
  survivalSeriesFrom,
} from './qualification.js';
import { compareRecords } from './ranking.js';
import { type Placing, type PlayerRecord, isSeriesComplete, isValidPlacement, seriesPlacings, seriesRecords, seriesWinner } from './series.js';

const emptyRecord = (playerId: PlayerId): PlayerRecord => ({ playerId, wins: 0, points: 0, games: 0 });

// Every host change goes through `applyAction`: the host page applies it
// locally, then saves the resulting document. Keeping all validation here
// means the same rules run on the host page and in simulation scripts.
// Errors are `Translatable`s, so the host sees them in the selected language.

export const DEFAULT_EVENT_NAME = 'Guild PvP Tournament';
const MAX_EVENT_NAME = 60;
const MAX_REASON = 120;

export interface ActionContext {
  /** ISO timestamp stamped on saved games, draws and polls. */
  now: string;
  random: Random;
}

export type ActionResult = { ok: true; value: Tournament } | { ok: false; error: Translatable };

export type Action =
  | { type: 'setName'; name: string }
  | { type: 'setDisplayNames'; displayNames: Record<string, string> }
  | { type: 'setPlayers'; usernames: string[] }
  | { type: 'drawGroups' }
  | { type: 'startGroupStage' }
  | { type: 'startSeries'; seriesId: string }
  | { type: 'saveGame'; seriesId: string; placement: PlayerId[] }
  | { type: 'undoGame'; seriesId: string }
  | { type: 'overrideWinner'; seriesId: string; playerId: PlayerId; reason: string }
  | { type: 'clearOverride'; seriesId: string }
  | { type: 'replacePlayer'; seriesId: string; outId: PlayerId; inId: PlayerId }
  | { type: 'swapPlayers'; firstId: PlayerId; secondId: PlayerId }
  | { type: 'setSemifinalPicks'; fillIns: PlayerId[] }
  | { type: 'drawSemifinals' }
  | { type: 'arrangeSemifinals'; firstId: PlayerId; secondId: PlayerId }
  | { type: 'recordPoll'; seriesId: string; ballots: Ballot[] }
  | { type: 'clearPoll'; seriesId: string }
  | { type: 'recordGamesPoll'; seriesId: string; ballots: GamesBallot[] }
  | { type: 'clearGamesPoll'; seriesId: string }
  | { type: 'resolveTies' }
  | { type: 'advance' }
  | { type: 'reopenStage' }
  | { type: 'reset' };

/** Which series stage the host plays during each tournament stage. */
export const STAGE_SERIES: Record<Stage, SeriesStage | undefined> = {
  setup: undefined,
  groups: 'group',
  survival: 'survival',
  semis: 'semi',
  final: 'final',
  done: undefined,
};

export function createEmptyTournament(name: string = DEFAULT_EVENT_NAME): Tournament {
  return { schemaVersion: 2, version: 0, updatedAt: '', name, players: [], displayNames: {}, stage: 'setup', series: [], tieDraws: [] };
}

/** Series the host can play right now. */
export function playableSeries(tournament: Tournament): Series[] {
  const stage = STAGE_SERIES[tournament.stage];
  return stage ? tournament.series.filter((series) => series.stage === stage) : [];
}

export function isStageComplete(tournament: Tournament): boolean {
  const series = playableSeries(tournament);
  return series.length > 0 && series.every(isSeriesComplete);
}

export function championOf(tournament: Tournament): PlayerId | undefined {
  const final = tournament.series.find((series) => series.stage === 'final');
  return final ? seriesWinner(final) : undefined;
}

/** Champion, 2nd and 3rd once the grand final is decided (see seriesPlacings). */
export function finalStandings(tournament: Tournament): Placing[] | undefined {
  const final = tournament.series.find((series) => series.stage === 'final');
  return final ? seriesPlacings(final) : undefined;
}

/** The stage `advance` moves to, or undefined at the end. */
export function nextStage(tournament: Tournament): Stage | undefined {
  switch (tournament.stage) {
    case 'setup':
      return 'groups';
    case 'groups':
      return survivalPlan(tournament) ? 'survival' : 'semis';
    case 'survival':
      return 'semis';
    case 'semis':
      return 'final';
    case 'final':
      return 'done';
    default:
      return undefined;
  }
}

const ok = (value: Tournament): ActionResult => ({ ok: true, value });
const fail = (error: Translatable): ActionResult => ({ ok: false, error });

export function cleanName(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function playerName(tournament: Tournament, playerId: PlayerId): string {
  return nameLookup(tournament)(playerId);
}

const list = (items: Iterable<string>) => [...new Set(items)].join(', ');

const repeatsIn = (items: readonly string[]) => items.filter((item, index) => items.indexOf(item) !== index);

/**
 * Replaces the whole Discord username → display name list. Winner-poll
 * answers are display names read back to a username, so names must stay
 * unique under the same comparison the poll importer uses, and no participant
 * may lose theirs.
 */
function setDisplayNames(tournament: Tournament, input: Record<string, string>): ActionResult {
  const entries = Object.entries(input).map(([username, name]) => [normalizeUsername(username), cleanName(name)] as const);
  if (entries.length > MAX_DISPLAY_NAMES) return fail((t) => t.errors.tooManyDisplayNames(MAX_DISPLAY_NAMES));
  const usernames = entries.map(([username]) => username);
  const invalid = usernames.filter((username) => !isDiscordUsername(username));
  if (invalid.length > 0) return fail((t) => t.errors.notUsernames(list(invalid)));
  // "Lan" and "@lan" are the same Discord account once normalized.
  const repeated = repeatsIn(usernames);
  if (repeated.length > 0) return fail((t) => t.errors.duplicateUsernames(list(repeated)));
  const empty = entries.filter(([, name]) => !name).map(([username]) => username);
  if (empty.length > 0) return fail((t) => t.errors.displayNamesEmpty(list(empty)));
  const tooLong = entries.filter(([, name]) => name.length > MAX_DISPLAY_NAME).map(([, name]) => name);
  if (tooLong.length > 0) return fail((t) => t.errors.displayNamesTooLong(list(tooLong), MAX_DISPLAY_NAME));
  const firstByKey = new Map<string, string>();
  const clashes: string[] = [];
  for (const [, name] of entries) {
    const key = normalizeAnswer(name);
    const first = firstByKey.get(key);
    if (first === undefined) firstByKey.set(key, name);
    else clashes.push(first, name);
  }
  if (clashes.length > 0) return fail((t) => t.errors.duplicateDisplayNames(list(clashes)));
  const displayNames = Object.fromEntries(entries);
  const named = new Set(Object.keys(displayNames));
  const unnamed = tournament.players.filter((playerId) => !named.has(playerId));
  if (unnamed.length > 0)
    return fail((t) => t.errors.participantsNeedNames(list(unnamed.map((playerId) => `${playerId} (${playerName(tournament, playerId)})`))));
  return ok({ ...tournament, displayNames });
}

/** Participants are entered by Discord username; each needs a display name first so every screen and poll can name them. */
function setPlayers(tournament: Tournament, input: string[]): ActionResult {
  if (tournament.stage !== 'setup') return fail((t) => t.errors.playersOnlyInSetup);
  const players = input.map(normalizeUsername).filter(Boolean);
  const invalid = players.filter((username) => !isDiscordUsername(username));
  if (invalid.length > 0) return fail((t) => t.errors.notUsernames(list(invalid)));
  const repeated = repeatsIn(players);
  if (repeated.length > 0) return fail((t) => t.errors.duplicateUsernames(list(repeated)));
  if (!isSupportedCount(players.length)) return fail((t) => t.errors.wrongCount(SUPPORTED_COUNTS.join(', '), players.length));
  const named = new Set(Object.keys(tournament.displayNames));
  const unnamed = players.filter((username) => !named.has(username));
  if (unnamed.length > 0) return fail((t) => t.errors.namesNeededFirst(list(unnamed)));
  return ok({ ...withoutSemifinalPlan(tournament), players, series: [], currentSeriesId: undefined, tieDraws: [] });
}

function findSeries(tournament: Tournament, seriesId: string): Series | undefined {
  return tournament.series.find((series) => series.id === seriesId);
}

function withSeries(tournament: Tournament, seriesId: string, update: (series: Series) => Series): Tournament {
  return { ...tournament, series: tournament.series.map((series) => (series.id === seriesId ? update(series) : series)) };
}

/** A new participant list or group draw makes earlier semifinal picks and arrangements meaningless. */
function withoutSemifinalPlan({ semifinalPicks: _picks, semifinalDraft: _draft, ...tournament }: Tournament): Tournament {
  return tournament;
}

function withoutDraft({ semifinalDraft: _cleared, ...tournament }: Tournament): Tournament {
  return tournament;
}

/**
 * Draws the semifinal groups at random once the semifinalists are known.
 * Drawing again replaces the groups and any swaps. The result is a draft that
 * only the host sees until `advance` starts exactly these groups.
 */
function drawSemifinals(tournament: Tournament, random: Random): ActionResult {
  if (tournament.stage !== 'groups' && tournament.stage !== 'survival') return fail((t) => t.errors.semifinalDrawTooLate);
  const { semifinalists } = semifinalSelection(tournament);
  if (!semifinalists) return fail((t) => t.errors.semifinalistsNotReady);
  const firstRoundGroup = new Map(groupSeries(tournament).flatMap((series) => series.playerIds.map((playerId) => [playerId, series.id] as const)));
  return ok({ ...tournament, semifinalDraft: drawSemifinalGroups(semifinalists, (playerId) => firstRoundGroup.get(playerId), random) });
}

/** Swaps two players between the drawn semifinal groups before the semifinals start. */
function arrangeSemifinals(tournament: Tournament, firstId: PlayerId, secondId: PlayerId): ActionResult {
  const groups = tournament.stage === 'groups' || tournament.stage === 'survival' ? semifinalGroups(tournament) : undefined;
  if (!groups) return fail((t) => t.errors.drawSemifinalsFirst);
  const firstGroup = groups.findIndex((group) => group.includes(firstId));
  const secondGroup = groups.findIndex((group) => group.includes(secondId));
  if (firstGroup < 0 || secondGroup < 0) return fail((t) => t.errors.notSemifinalists);
  if (firstGroup === secondGroup) {
    return fail((t) =>
      t.errors.sameGroup(playerName(tournament, firstId), playerName(tournament, secondId), t.seriesName({ id: `S${firstGroup + 1}`, stage: 'semi' }))
    );
  }
  const swapIn = (playerId: PlayerId) => (playerId === firstId ? secondId : playerId === secondId ? firstId : playerId);
  const semifinalDraft = groups.map((group) => group.map(swapIn) as [PlayerId, PlayerId, PlayerId]);
  return ok({ ...tournament, semifinalDraft });
}

/**
 * A changed line-up makes recorded predictions meaningless (the winner poll
 * would even hold votes for a player who left), so both are dropped.
 */
function withoutPolls({ poll: _poll, gamesPoll: _gamesPoll, ...series }: Series): Series {
  return series;
}

/**
 * Swaps two players between series of the stage being set up or played: the
 * group draw (setup and group stage) or the semifinals. A series that has a
 * game or a ruling is locked, because its results belong to its players.
 */
function swapPlayers(tournament: Tournament, firstId: PlayerId, secondId: PlayerId): ActionResult {
  const stage = tournament.stage === 'setup' ? 'group' : STAGE_SERIES[tournament.stage];
  if (stage !== 'group' && stage !== 'semi') return fail((t) => t.errors.rearrangeStages);
  const pool = tournament.series.filter((series) => series.stage === stage);
  const first = pool.find((series) => series.playerIds.includes(firstId));
  const second = pool.find((series) => series.playerIds.includes(secondId));
  if (!first || !second) return fail((t) => t.errors.bothPlayersInStage);
  if (first.id === second.id) {
    return fail((t) => t.errors.sameGroup(playerName(tournament, firstId), playerName(tournament, secondId), t.seriesName(first)));
  }
  const locked = [first, second].find((series) => series.games.length > 0 || series.winnerOverride);
  if (locked) return fail((t) => t.errors.seriesLocked(t.seriesName(locked)));

  const swapIn = (playerId: PlayerId) => (playerId === firstId ? secondId : playerId === secondId ? firstId : playerId);
  return ok({
    ...tournament,
    series: tournament.series.map((series) =>
      series.id === first.id || series.id === second.id
        ? { ...withoutPolls(series), playerIds: series.playerIds.map(swapIn) as [PlayerId, PlayerId, PlayerId] }
        : series
    ),
  });
}

/**
 * Puts someone in for a player who can't play, before their series has a game
 * or a ruling. In a group (setup or group stage) the newcomer is a reserve
 * from the display names who isn't in the event yet and takes the leaver's
 * place in the event, so the rest of the draw stands. In the semifinals and
 * the final it's a participant not playing in that stage (see
 * replacementCandidates). The survival game takes no replacements.
 */
function replacePlayer(tournament: Tournament, seriesId: string, outId: PlayerId, inId: PlayerId): ActionResult {
  const series = findSeries(tournament, seriesId);
  if (!series) return fail((t) => t.errors.unknownSeries(seriesId));
  const inGroupDraw = series.stage === 'group' && tournament.stage === 'setup';
  if (!inGroupDraw && series.stage !== STAGE_SERIES[tournament.stage]) return fail((t) => t.errors.notCurrentStage(t.seriesName(series)));
  if (series.stage === 'survival') return fail((t) => t.errors.replaceNotSurvival);
  if (series.games.length > 0 || series.winnerOverride) return fail((t) => t.errors.replaceStarted(t.seriesName(series)));
  if (!series.playerIds.includes(outId)) return fail((t) => t.errors.notInSeries);

  const incoming = series.stage === 'group' ? normalizeUsername(inId) : inId;
  const swapIn = (playerId: PlayerId) => (playerId === outId ? incoming : playerId);
  const withLineUp = (current: Tournament) =>
    withSeries(current, series.id, (entry) => ({ ...withoutPolls(entry), playerIds: entry.playerIds.map(swapIn) as [PlayerId, PlayerId, PlayerId] }));

  if (series.stage !== 'group') {
    if (!tournament.players.includes(incoming)) return fail((t) => t.errors.unknownReplacement);
    if (playableSeries(tournament).some((current) => current.playerIds.includes(incoming))) {
      return fail((t) => t.errors.alreadyPlaying(playerName(tournament, incoming)));
    }
    return ok(withLineUp(tournament));
  }

  if (tournament.players.includes(incoming)) return fail((t) => t.errors.reserveAlreadyIn(playerName(tournament, incoming)));
  if (!isDiscordUsername(incoming)) return fail((t) => t.errors.notUsernames(incoming));
  if (!Object.keys(tournament.displayNames).includes(incoming)) return fail((t) => t.errors.namesNeededFirst(incoming));
  // Draws, picks and arrangements left over from undone results may still name the leaver, who is no longer in the event.
  const { semifinalPicks, semifinalDraft, ...rest } = tournament;
  return ok(
    withLineUp({
      ...rest,
      players: tournament.players.map(swapIn),
      tieDraws: tournament.tieDraws.filter((draw) => !draw.order.includes(outId)),
      ...(semifinalPicks ? { semifinalPicks: { fillIns: semifinalPicks.fillIns.filter((playerId) => playerId !== outId) } } : {}),
      ...(semifinalDraft && !semifinalDraft.flat().includes(outId) ? { semifinalDraft } : {}),
    })
  );
}

/** Records the host's picks for the empty semifinal spots; partial picks are fine while the host is still choosing. */
function setSemifinalPicks(tournament: Tournament, fillIns: PlayerId[]): ActionResult {
  if (tournament.stage !== 'groups') return fail((t) => t.errors.picksOnlyInGroups);
  if (!groupStageOutcome(tournament).complete) return fail((t) => t.errors.finishGroupsFirst);
  const selection = semifinalSelection(tournament);
  const uniqueFillIns = [...new Set(fillIns)];
  if (uniqueFillIns.length > selection.fillInSpots) {
    return fail((t) => (selection.fillInSpots === 0 ? t.errors.allSpotsFilled : t.errors.tooManyFillIns(selection.fillInSpots)));
  }
  if (uniqueFillIns.some((playerId) => !selection.fillInCandidates.includes(playerId))) return fail((t) => t.errors.fillInNotWinner);
  // Different picks mean different semifinalists, so the semifinal groups have to be drawn again.
  return ok({ ...withoutDraft(tournament), semifinalPicks: { fillIns: uniqueFillIns } });
}

/** Results can only change in the stage being played; earlier stages need `reopenStage` first. */
function playableOrError(tournament: Tournament, seriesId: string): Series | Translatable {
  const series = findSeries(tournament, seriesId);
  if (!series) return (t) => t.errors.unknownSeries(seriesId);
  if (series.stage !== STAGE_SERIES[tournament.stage]) return (t) => t.errors.notCurrentStage(t.seriesName(series));
  return series;
}

/** Starts the semifinals from the drawn groups as the host left them; the draft lives on in the series themselves. */
function createSemifinals(tournament: Tournament): ActionResult {
  const groups = semifinalGroups(tournament);
  if (!groups) return fail((t) => t.errors.drawSemifinalsFirst);
  const semis = semifinalSeriesFrom(groups);
  return ok({ ...withoutDraft(tournament), stage: 'semis', series: [...tournament.series, ...semis], currentSeriesId: undefined });
}

function advance(tournament: Tournament): ActionResult {
  if (tournament.stage === 'setup') return fail((t) => t.errors.useStartGroupStage);
  if (tournament.stage === 'done') return fail((t) => t.errors.alreadyFinished);
  if (!isStageComplete(tournament)) return fail((t) => t.errors.finishStageFirst);

  if (tournament.stage === 'groups') {
    if (pendingTies(tournament).length > 0) return fail((t) => t.errors.resolveTiesFirst);
    const plan = survivalPlan(tournament);
    if (plan) {
      if (!plan.seats) return fail((t) => t.errors.finishStageFirst);
      return ok({ ...withoutDraft(tournament), stage: 'survival', series: [...tournament.series, survivalSeriesFrom(plan.seats)], currentSeriesId: undefined });
    }
    const { semifinalists, fillInSpots } = semifinalSelection(tournament);
    if (!semifinalists) return fail((t) => t.errors.pickFillInsFirst(fillInSpots));
    return createSemifinals(tournament);
  }

  if (tournament.stage === 'survival') return createSemifinals(tournament);

  if (tournament.stage === 'semis') {
    const winners = playableSeries(tournament).map((series) => seriesWinner(series) as PlayerId);
    const final: Series = {
      id: 'F',
      stage: 'final',
      label: 'Grand final',
      playerIds: winners as [PlayerId, PlayerId, PlayerId],
      winsNeeded: WINS_NEEDED.final,
      games: [],
    };
    return ok({ ...tournament, stage: 'final', series: [...tournament.series, final], currentSeriesId: undefined });
  }

  return ok({ ...tournament, stage: 'done', currentSeriesId: undefined });
}

function reopenStage(tournament: Tournament): ActionResult {
  const removeStage = (stage: SeriesStage) => tournament.series.filter((series) => series.stage !== stage);
  switch (tournament.stage) {
    case 'setup':
      return fail((t) => t.errors.setupIsFirst);
    case 'groups':
      if (groupSeries(tournament).some((series) => series.games.length > 0 || series.winnerOverride)) {
        return fail((t) => t.errors.groupsHaveResults);
      }
      return ok({ ...tournament, stage: 'setup', currentSeriesId: undefined });
    case 'survival':
      return ok({ ...tournament, stage: 'groups', series: removeStage('survival'), currentSeriesId: undefined });
    case 'semis': {
      // Keep the host's arrangement as the draft, so going back to fix a result doesn't undo it.
      const semifinalDraft = tournament.series.filter((series) => series.stage === 'semi').map((series) => series.playerIds);
      const stage = tournament.series.some((series) => series.stage === 'survival') ? 'survival' : 'groups';
      return ok({ ...tournament, stage, series: removeStage('semi'), currentSeriesId: undefined, semifinalDraft });
    }
    case 'final':
      return ok({ ...tournament, stage: 'semis', series: removeStage('final'), currentSeriesId: undefined });
    case 'done':
      return ok({ ...tournament, stage: 'final', currentSeriesId: undefined });
  }
}

/** Records a random order for every pending tie, repeating while new ties surface. */
function resolveTies(tournament: Tournament, context: ActionContext): ActionResult {
  let current = tournament;
  for (let round = 0; round < 5; round++) {
    const ties = pendingTies(current);
    if (ties.length === 0) break;
    const draws: TieDraw[] = ties.map((tie) => ({ key: tie.key, order: shuffle(tie.playerIds, context.random), drawnAt: context.now }));
    current = { ...current, tieDraws: [...current.tieDraws.filter((draw) => !draws.some((next) => next.key === draw.key)), ...draws] };
  }
  return current === tournament ? fail((t) => t.errors.noTies) : ok(current);
}

/** Checks shared by both predictions; only the per-voter import is accepted so every vote reaches the leaderboard. */
function ballotsProblem(ballots: readonly { username: string }[]): Translatable | undefined {
  if (ballots.length === 0) return (t) => t.errors.noBallots;
  if (repeatsIn(ballots.map((ballot) => ballot.username)).length > 0) return (t) => t.errors.oneVotePerMember;
  return undefined;
}

function recordPoll(tournament: Tournament, seriesId: string, ballots: Ballot[], now: string): ActionResult {
  const series = findSeries(tournament, seriesId);
  if (!series) return fail((t) => t.errors.unknownSeries(seriesId));
  const problem = ballotsProblem(ballots);
  if (problem) return fail(problem);
  if (ballots.some((ballot) => !series.playerIds.includes(ballot.playerId))) return fail((t) => t.errors.ballotOutsideSeries);
  return ok(withSeries(tournament, seriesId, (current) => ({ ...current, poll: { ballots, recordedAt: now } })));
}

/** Series that can carry the over/under prediction, or why not. */
function gamesSeriesOrError(tournament: Tournament, seriesId: string): Series | Translatable {
  const series = findSeries(tournament, seriesId);
  if (!series) return (t) => t.errors.unknownSeries(seriesId);
  if (!hasGamesPrediction(series)) return (t) => t.errors.singleMatchNoGames(t.seriesName(series));
  return series;
}

function recordGamesPoll(tournament: Tournament, seriesId: string, ballots: GamesBallot[], now: string): ActionResult {
  const series = gamesSeriesOrError(tournament, seriesId);
  if (typeof series === 'function') return fail(series);
  const problem = ballotsProblem(ballots);
  if (problem) return fail(problem);
  if (ballots.some((ballot) => ballot.pick !== 'over' && ballot.pick !== 'under')) return fail((t) => t.errors.ballotPickInvalid);
  return ok(withSeries(tournament, series.id, (current) => ({ ...current, gamesPoll: { line: gamesLineOf(series), ballots, recordedAt: now } })));
}

export function applyAction(tournament: Tournament, action: Action, context: ActionContext): ActionResult {
  switch (action.type) {
    case 'setName': {
      const name = cleanName(action.name);
      if (!name) return fail((t) => t.errors.eventNameEmpty);
      if (name.length > MAX_EVENT_NAME) return fail((t) => t.errors.eventNameTooLong(MAX_EVENT_NAME));
      return ok({ ...tournament, name });
    }

    case 'setDisplayNames':
      return setDisplayNames(tournament, action.displayNames);

    case 'setPlayers':
      return setPlayers(tournament, action.usernames);

    case 'drawGroups': {
      if (tournament.stage !== 'setup') return fail((t) => t.errors.drawOnlyInSetup);
      if (!isSupportedCount(tournament.players.length)) return fail((t) => t.errors.saveParticipantsFirst);
      const groups = drawGroupSeries(tournament.players, context.random);
      return ok({ ...withoutSemifinalPlan(tournament), series: groups, currentSeriesId: undefined, tieDraws: [] });
    }

    case 'startGroupStage': {
      if (tournament.stage !== 'setup') return fail((t) => t.errors.groupStageStarted);
      if (!isSupportedCount(tournament.players.length)) return fail((t) => t.errors.saveParticipantsFirst);
      if (groupSeries(tournament).length !== formatFor(tournament.players.length).groups) return fail((t) => t.errors.drawFirst);
      return ok({ ...tournament, stage: 'groups', currentSeriesId: undefined });
    }

    case 'startSeries': {
      const series = playableOrError(tournament, action.seriesId);
      if (typeof series === 'function') return fail(series);
      if (isSeriesComplete(series)) return fail((t) => t.errors.seriesFinished(t.seriesName(series)));
      const started = withSeries(tournament, series.id, (current) => ({ ...current, startedAt: current.startedAt ?? context.now }));
      return ok({ ...started, currentSeriesId: series.id });
    }

    case 'saveGame': {
      const series = playableOrError(tournament, action.seriesId);
      if (typeof series === 'function') return fail(series);
      if (isSeriesComplete(series)) return fail((t) => t.errors.seriesFinished(t.seriesName(series)));
      if (!isValidPlacement(series, action.placement)) return fail((t) => t.errors.invalidPlacement);
      const placement = [...action.placement] as Placement;
      const saved = withSeries(tournament, series.id, (current) => ({
        ...current,
        startedAt: current.startedAt ?? context.now,
        games: [...current.games, { placement, savedAt: context.now }],
      }));
      return ok({ ...saved, currentSeriesId: series.id });
    }

    case 'undoGame': {
      const series = playableOrError(tournament, action.seriesId);
      if (typeof series === 'function') return fail(series);
      if (series.games.length === 0) return fail((t) => t.errors.noGamesToUndo(t.seriesName(series)));
      return ok(withSeries(tournament, series.id, (current) => ({ ...current, games: current.games.slice(0, -1) })));
    }

    case 'overrideWinner': {
      const series = playableOrError(tournament, action.seriesId);
      if (typeof series === 'function') return fail(series);
      // The survival game is decided by who finishes 3rd, which a winner ruling can't express.
      if (series.stage === 'survival') return fail((t) => t.errors.survivalNoRuling);
      if (!series.playerIds.includes(action.playerId)) return fail((t) => t.errors.winnerNotInSeries);
      const reason = cleanName(action.reason);
      if (!reason) return fail((t) => t.errors.reasonRequired);
      if (reason.length > MAX_REASON) return fail((t) => t.errors.reasonTooLong(MAX_REASON));
      return ok(withSeries(tournament, series.id, (current) => ({ ...current, winnerOverride: { playerId: action.playerId, reason } })));
    }

    case 'clearOverride': {
      const series = playableOrError(tournament, action.seriesId);
      if (typeof series === 'function') return fail(series);
      if (!series.winnerOverride) return fail((t) => t.errors.noOverride(t.seriesName(series)));
      return ok(withSeries(tournament, series.id, ({ winnerOverride: _cleared, ...rest }) => rest));
    }

    case 'replacePlayer':
      return replacePlayer(tournament, action.seriesId, action.outId, action.inId);

    case 'swapPlayers':
      return swapPlayers(tournament, action.firstId, action.secondId);

    case 'setSemifinalPicks':
      return setSemifinalPicks(tournament, action.fillIns);

    case 'drawSemifinals':
      return drawSemifinals(tournament, context.random);

    case 'arrangeSemifinals':
      return arrangeSemifinals(tournament, action.firstId, action.secondId);

    case 'recordPoll':
      return recordPoll(tournament, action.seriesId, action.ballots, context.now);

    case 'clearPoll': {
      const series = findSeries(tournament, action.seriesId);
      if (!series) return fail((t) => t.errors.unknownSeries(action.seriesId));
      return ok(withSeries(tournament, series.id, ({ poll: _cleared, ...rest }) => rest));
    }

    case 'recordGamesPoll':
      return recordGamesPoll(tournament, action.seriesId, action.ballots, context.now);

    case 'clearGamesPoll': {
      const series = findSeries(tournament, action.seriesId);
      if (!series) return fail((t) => t.errors.unknownSeries(action.seriesId));
      return ok(withSeries(tournament, series.id, ({ gamesPoll: _cleared, ...rest }) => rest));
    }

    case 'resolveTies':
      return resolveTies(tournament, context);

    case 'advance':
      return advance(tournament);

    case 'reopenStage':
      return reopenStage(tournament);

    case 'reset':
      // The display names are a guild-wide list rather than event results, so they stay.
      return ok({
        ...createEmptyTournament(tournament.name),
        displayNames: tournament.displayNames,
        version: tournament.version,
        updatedAt: tournament.updatedAt,
      });
  }
}

/**
 * Candidates to replace a player who can't play. For a group, reserves: people
 * in the display names who aren't in the event, by name. Otherwise best
 * first: for the semifinals, the best group-stage records among
 * non-semifinalists; for the final, the other players of that finalist's semifinal.
 */
export function replacementCandidates(tournament: Tournament, seriesId: string, outId: PlayerId): PlayerId[] {
  const series = findSeries(tournament, seriesId);
  if (!series) return [];
  if (series.stage === 'group') {
    const nameOf = nameLookup(tournament);
    const inEvent = new Set(tournament.players);
    return Object.keys(tournament.displayNames)
      .filter((username) => !inEvent.has(username) && isDiscordUsername(username))
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }
  const playing = new Set(playableSeries(tournament).flatMap((current) => current.playerIds));
  const byRecord = (records: Map<PlayerId, PlayerRecord>, playerIds: PlayerId[]) =>
    playerIds.filter((playerId) => !playing.has(playerId)).sort((a, b) => compareRecords(records.get(a) ?? emptyRecord(a), records.get(b) ?? emptyRecord(b)));
  if (series.stage === 'final') {
    const semifinal = tournament.series.find((current) => current.stage === 'semi' && current.playerIds.includes(outId));
    if (!semifinal) return [];
    const records = new Map(seriesRecords(semifinal).map((record) => [record.playerId, record]));
    return byRecord(
      records,
      semifinal.playerIds.filter((playerId) => playerId !== outId)
    );
  }
  if (series.stage === 'semi') {
    return byRecord(groupStageOutcome(tournament).records, tournament.players);
  }
  return [];
}
