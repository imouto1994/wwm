import type { Ballot, GamesBallot, GamesPick, Placement, PlayerId, Series, SeriesStage, Stage, TieDraw, Tournament } from '../types/tournament.js';
import { type Random, drawGroupSeries, shuffle } from './draw.js';
import { SUPPORTED_COUNTS, formatFor, isSupportedCount, isValidGamesLine } from './format.js';
import type { Translatable } from './i18n.js';
import { gamesLineOf, hasGamesPrediction } from './polls.js';
import { groupSeries, groupStageOutcome, pendingTies, seedingOrder, semifinalSelection } from './qualification.js';
import { compareRecords } from './ranking.js';
import { seedSemifinalGroups } from './seeding.js';
import { type PlayerRecord, isSeriesComplete, isValidPlacement, seriesRecords, seriesWinner } from './series.js';

const emptyRecord = (playerId: PlayerId): PlayerRecord => ({ playerId, wins: 0, points: 0, games: 0 });

// Every host change goes through `applyAction`: the host page applies it
// locally, then saves the resulting document. Keeping all validation here
// means the same rules run on the host page and in simulation scripts.
// Errors are `Translatable`s, so the host sees them in the selected language.

export const DEFAULT_EVENT_NAME = 'Guild PvP Tournament';
const MAX_PLAYER_NAME = 32;
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
  | { type: 'setPlayers'; playerNames: string[] }
  | { type: 'renamePlayer'; playerId: PlayerId; name: string }
  | { type: 'drawGroups' }
  | { type: 'startGroupStage' }
  | { type: 'startSeries'; seriesId: string }
  | { type: 'saveGame'; seriesId: string; placement: PlayerId[] }
  | { type: 'undoGame'; seriesId: string }
  | { type: 'overrideWinner'; seriesId: string; playerId: PlayerId; reason: string }
  | { type: 'clearOverride'; seriesId: string }
  | { type: 'replacePlayer'; seriesId: string; outId: PlayerId; inId: PlayerId }
  | { type: 'swapPlayers'; firstId: PlayerId; secondId: PlayerId }
  | { type: 'setSemifinalPicks'; fillIns: PlayerId[]; dropped: PlayerId[] }
  | { type: 'recordPoll'; seriesId: string; votes: Record<PlayerId, number>; ballots?: Ballot[] }
  | { type: 'clearPoll'; seriesId: string }
  | { type: 'setGamesLine'; seriesId: string; line: number }
  | { type: 'recordGamesPoll'; seriesId: string; votes: Record<GamesPick, number>; ballots?: GamesBallot[] }
  | { type: 'clearGamesPoll'; seriesId: string }
  | { type: 'resolveTies' }
  | { type: 'setLateRule'; enabled: boolean }
  | { type: 'advance' }
  | { type: 'reopenStage' }
  | { type: 'reset' };

/** Which series stage the host plays during each tournament stage. */
export const STAGE_SERIES: Record<Stage, SeriesStage | undefined> = {
  setup: undefined,
  groups: 'group',
  semis: 'semi',
  final: 'final',
  done: undefined,
};

export function createEmptyTournament(name: string = DEFAULT_EVENT_NAME): Tournament {
  return { schemaVersion: 1, version: 0, updatedAt: '', name, players: [], stage: 'setup', series: [], lateRule: false, tieDraws: [] };
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

/** The stage `advance` moves to, or undefined at the end. */
export function nextStage(tournament: Tournament): Stage | undefined {
  switch (tournament.stage) {
    case 'setup':
      return 'groups';
    case 'groups':
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
  return tournament.players.find((player) => player.id === playerId)?.name ?? playerId;
}

function findSeries(tournament: Tournament, seriesId: string): Series | undefined {
  return tournament.series.find((series) => series.id === seriesId);
}

function withSeries(tournament: Tournament, seriesId: string, update: (series: Series) => Series): Tournament {
  return { ...tournament, series: tournament.series.map((series) => (series.id === seriesId ? update(series) : series)) };
}

/** A new participant list or group draw makes earlier semifinal picks meaningless. */
function withoutPicks({ semifinalPicks: _cleared, ...tournament }: Tournament): Tournament {
  return tournament;
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

/** Records the host's semifinal picks; partial picks are fine while the host is still choosing. */
function setSemifinalPicks(tournament: Tournament, fillIns: PlayerId[], dropped: PlayerId[]): ActionResult {
  if (tournament.stage !== 'groups') return fail((t) => t.errors.picksOnlyInGroups);
  if (!groupStageOutcome(tournament).complete) return fail((t) => t.errors.finishGroupsFirst);
  const selection = semifinalSelection(tournament);
  const uniqueFillIns = [...new Set(fillIns)];
  const uniqueDropped = [...new Set(dropped)];
  if (uniqueFillIns.length > selection.fillInSpots) {
    return fail((t) => (selection.fillInSpots === 0 ? t.errors.allSpotsFilled : t.errors.tooManyFillIns(selection.fillInSpots)));
  }
  if (uniqueDropped.length > selection.dropSpots) {
    return fail((t) => (selection.dropSpots === 0 ? t.errors.noDropNeeded : t.errors.tooManyDrops(selection.dropSpots)));
  }
  if (uniqueFillIns.some((playerId) => !selection.fillInCandidates.includes(playerId))) return fail((t) => t.errors.fillInNotWinner);
  if (uniqueDropped.some((playerId) => !selection.dropCandidates.includes(playerId))) return fail((t) => t.errors.dropMustBeWinner);
  return ok({ ...tournament, semifinalPicks: { fillIns: uniqueFillIns, dropped: uniqueDropped } });
}

/** Results can only change in the stage being played; earlier stages need `reopenStage` first. */
function playableOrError(tournament: Tournament, seriesId: string): Series | Translatable {
  const series = findSeries(tournament, seriesId);
  if (!series) return (t) => t.errors.unknownSeries(seriesId);
  if (series.stage !== STAGE_SERIES[tournament.stage]) return (t) => t.errors.notCurrentStage(t.seriesName(series));
  return series;
}

function createSemifinals(tournament: Tournament, semifinalists: PlayerId[]): ActionResult {
  const seeding = seedingOrder(tournament, semifinalists);
  if (seeding.ties.length > 0) return fail((t) => t.errors.resolveTiesFirst);
  const firstRoundGroup = new Map(groupSeries(tournament).flatMap((series) => series.playerIds.map((playerId) => [playerId, series.id] as const)));
  const groups = seedSemifinalGroups(seeding.order, (playerId) => firstRoundGroup.get(playerId));
  const semis: Series[] = groups.map((playerIds, index) => ({
    id: `S${index + 1}`,
    stage: 'semi',
    label: `Semifinal ${index + 1}`,
    playerIds: playerIds as [PlayerId, PlayerId, PlayerId],
    winsNeeded: tournament.lateRule ? 1 : 2,
    games: [],
  }));
  return ok({ ...tournament, stage: 'semis', series: [...tournament.series, ...semis], currentSeriesId: undefined });
}

function advance(tournament: Tournament): ActionResult {
  if (tournament.stage === 'setup') return fail((t) => t.errors.useStartGroupStage);
  if (tournament.stage === 'done') return fail((t) => t.errors.alreadyFinished);
  if (!isStageComplete(tournament)) return fail((t) => t.errors.finishStageFirst);

  if (tournament.stage === 'groups') {
    const { semifinalists, fillInSpots, dropSpots } = semifinalSelection(tournament);
    if (!semifinalists) return fail((t) => (dropSpots > 0 ? t.errors.pickDropFirst : t.errors.pickFillInsFirst(fillInSpots)));
    if (pendingTies(tournament).length > 0) return fail((t) => t.errors.resolveTiesFirst);
    return createSemifinals(tournament, semifinalists);
  }

  if (tournament.stage === 'semis') {
    const winners = playableSeries(tournament).map((series) => seriesWinner(series) as PlayerId);
    const final: Series = {
      id: 'F',
      stage: 'final',
      label: 'Grand final',
      playerIds: winners as [PlayerId, PlayerId, PlayerId],
      winsNeeded: 2,
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
    case 'semis':
      return ok({ ...tournament, stage: 'groups', series: removeStage('semi'), currentSeriesId: undefined });
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

const isVoteCount = (count: number) => Number.isInteger(count) && count >= 0;
const hasRepeatVoters = (ballots: readonly { discordId: string }[]) => new Set(ballots.map((ballot) => ballot.discordId)).size !== ballots.length;

function recordPoll(tournament: Tournament, seriesId: string, votes: Record<PlayerId, number>, ballots: Ballot[] | undefined, now: string): ActionResult {
  const series = findSeries(tournament, seriesId);
  if (!series) return fail((t) => t.errors.unknownSeries(seriesId));
  const members = new Set(series.playerIds);
  const cleanVotes: Record<PlayerId, number> = {};
  for (const playerId of series.playerIds) {
    const count = votes[playerId] ?? 0;
    if (!isVoteCount(count)) return fail((t) => t.errors.voteCountsWhole);
    cleanVotes[playerId] = count;
  }
  if (Object.keys(votes).some((playerId) => !members.has(playerId))) return fail((t) => t.errors.votesOutsideSeries);
  if (ballots) {
    if (ballots.some((ballot) => !members.has(ballot.playerId))) return fail((t) => t.errors.ballotOutsideSeries);
    if (hasRepeatVoters(ballots)) return fail((t) => t.errors.oneVotePerMember);
  }
  return ok(withSeries(tournament, seriesId, (current) => ({ ...current, poll: { votes: cleanVotes, ...(ballots ? { ballots } : {}), recordedAt: now } })));
}

/** Series that can carry the over/under prediction, or why not. */
function gamesSeriesOrError(tournament: Tournament, seriesId: string): Series | Translatable {
  const series = findSeries(tournament, seriesId);
  if (!series) return (t) => t.errors.unknownSeries(seriesId);
  if (!hasGamesPrediction(series)) return (t) => t.errors.singleMatchNoGames(t.seriesName(series));
  return series;
}

function setGamesLine(tournament: Tournament, seriesId: string, line: number): ActionResult {
  const series = gamesSeriesOrError(tournament, seriesId);
  if (typeof series === 'function') return fail(series);
  if (!isValidGamesLine(line)) return fail((t) => t.errors.invalidLine);
  // Votes recorded against another line no longer answer the question being asked.
  return ok(
    withSeries(tournament, series.id, ({ gamesPoll, ...rest }) => ({
      ...rest,
      gamesLine: line,
      ...(gamesPoll && gamesPoll.line === line ? { gamesPoll } : {}),
    }))
  );
}

function recordGamesPoll(
  tournament: Tournament,
  seriesId: string,
  votes: Record<GamesPick, number>,
  ballots: GamesBallot[] | undefined,
  now: string
): ActionResult {
  const series = gamesSeriesOrError(tournament, seriesId);
  if (typeof series === 'function') return fail(series);
  if (!isVoteCount(votes.over) || !isVoteCount(votes.under)) return fail((t) => t.errors.voteCountsWhole);
  if (ballots) {
    if (ballots.some((ballot) => ballot.pick !== 'over' && ballot.pick !== 'under')) return fail((t) => t.errors.ballotPickInvalid);
    if (hasRepeatVoters(ballots)) return fail((t) => t.errors.oneVotePerMember);
  }
  const gamesPoll = { line: gamesLineOf(series), votes: { over: votes.over, under: votes.under }, ...(ballots ? { ballots } : {}), recordedAt: now };
  return ok(withSeries(tournament, series.id, (current) => ({ ...current, gamesPoll })));
}

export function applyAction(tournament: Tournament, action: Action, context: ActionContext): ActionResult {
  switch (action.type) {
    case 'setName': {
      const name = cleanName(action.name);
      if (!name) return fail((t) => t.errors.eventNameEmpty);
      if (name.length > MAX_EVENT_NAME) return fail((t) => t.errors.eventNameTooLong(MAX_EVENT_NAME));
      return ok({ ...tournament, name });
    }

    case 'setPlayers': {
      if (tournament.stage !== 'setup') return fail((t) => t.errors.playersOnlyInSetup);
      const names = action.playerNames.map(cleanName).filter(Boolean);
      if (!isSupportedCount(names.length)) return fail((t) => t.errors.wrongCount(SUPPORTED_COUNTS.join(', '), names.length));
      const tooLong = names.find((name) => name.length > MAX_PLAYER_NAME);
      if (tooLong) return fail((t) => t.errors.nameTooLong(tooLong, MAX_PLAYER_NAME));
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      for (const name of names) {
        const key = name.toLowerCase();
        if (seen.has(key)) duplicates.add(name);
        seen.add(key);
      }
      if (duplicates.size > 0) return fail((t) => t.errors.duplicateNames([...duplicates].join(', ')));
      const players = names.map((name, index) => ({ id: `p${index + 1}`, name }));
      return ok({ ...withoutPicks(tournament), players, series: [], currentSeriesId: undefined, tieDraws: [] });
    }

    case 'renamePlayer': {
      const name = cleanName(action.name);
      if (!tournament.players.some((player) => player.id === action.playerId)) return fail((t) => t.errors.unknownPlayer);
      if (!name) return fail((t) => t.errors.nameEmpty);
      if (name.length > MAX_PLAYER_NAME) return fail((t) => t.errors.namesTooLong(MAX_PLAYER_NAME));
      if (tournament.players.some((player) => player.id !== action.playerId && player.name.toLowerCase() === name.toLowerCase())) {
        return fail((t) => t.errors.nameTaken(name));
      }
      return ok({ ...tournament, players: tournament.players.map((player) => (player.id === action.playerId ? { ...player, name } : player)) });
    }

    case 'drawGroups': {
      if (tournament.stage !== 'setup') return fail((t) => t.errors.drawOnlyInSetup);
      if (!isSupportedCount(tournament.players.length)) return fail((t) => t.errors.saveParticipantsFirst);
      const groups = drawGroupSeries(
        tournament.players.map((player) => player.id),
        context.random
      );
      return ok({ ...withoutPicks(tournament), series: groups, currentSeriesId: undefined, tieDraws: [] });
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

    case 'replacePlayer': {
      const series = playableOrError(tournament, action.seriesId);
      if (typeof series === 'function') return fail(series);
      if (series.stage !== 'semi' && series.stage !== 'final') return fail((t) => t.errors.replaceOnlyKnockout);
      if (series.games.length > 0 || series.winnerOverride) return fail((t) => t.errors.replaceStarted(t.seriesName(series)));
      if (!series.playerIds.includes(action.outId)) return fail((t) => t.errors.notInSeries);
      if (!tournament.players.some((player) => player.id === action.inId)) return fail((t) => t.errors.unknownReplacement);
      if (playableSeries(tournament).some((current) => current.playerIds.includes(action.inId))) {
        return fail((t) => t.errors.alreadyPlaying(playerName(tournament, action.inId)));
      }
      return ok(
        withSeries(tournament, series.id, (current) => ({
          ...withoutPolls(current),
          playerIds: current.playerIds.map((playerId) => (playerId === action.outId ? action.inId : playerId)) as [PlayerId, PlayerId, PlayerId],
        }))
      );
    }

    case 'swapPlayers':
      return swapPlayers(tournament, action.firstId, action.secondId);

    case 'setSemifinalPicks':
      return setSemifinalPicks(tournament, action.fillIns, action.dropped);

    case 'recordPoll':
      return recordPoll(tournament, action.seriesId, action.votes, action.ballots, context.now);

    case 'clearPoll': {
      const series = findSeries(tournament, action.seriesId);
      if (!series) return fail((t) => t.errors.unknownSeries(action.seriesId));
      return ok(withSeries(tournament, series.id, ({ poll: _cleared, ...rest }) => rest));
    }

    case 'setGamesLine':
      return setGamesLine(tournament, action.seriesId, action.line);

    case 'recordGamesPoll':
      return recordGamesPoll(tournament, action.seriesId, action.votes, action.ballots, context.now);

    case 'clearGamesPoll': {
      const series = findSeries(tournament, action.seriesId);
      if (!series) return fail((t) => t.errors.unknownSeries(action.seriesId));
      return ok(withSeries(tournament, series.id, ({ gamesPoll: _cleared, ...rest }) => rest));
    }

    case 'resolveTies':
      return resolveTies(tournament, context);

    case 'setLateRule': {
      const semis = tournament.series.filter((series) => series.stage === 'semi');
      if (semis.some((series) => series.games.length > 0 || series.winnerOverride)) return fail((t) => t.errors.semisStarted);
      if (tournament.stage === 'final' || tournament.stage === 'done') return fail((t) => t.errors.semisOver);
      const winsNeeded = action.enabled ? 1 : 2;
      return ok({
        ...tournament,
        lateRule: action.enabled,
        series: tournament.series.map((series) => (series.stage === 'semi' ? { ...series, winsNeeded } : series)),
      });
    }

    case 'advance':
      return advance(tournament);

    case 'reopenStage':
      return reopenStage(tournament);

    case 'reset':
      return ok({ ...createEmptyTournament(tournament.name), version: tournament.version, updatedAt: tournament.updatedAt });
  }
}

/**
 * Candidates to replace a withdrawn semifinalist or finalist, best first:
 * for the semifinals, the best group-stage records among non-semifinalists;
 * for the final, the other players of that finalist's semifinal.
 */
export function replacementCandidates(tournament: Tournament, seriesId: string, outId: PlayerId): PlayerId[] {
  const series = findSeries(tournament, seriesId);
  if (!series) return [];
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
    return byRecord(
      groupStageOutcome(tournament).records,
      tournament.players.map((player) => player.id)
    );
  }
  return [];
}
