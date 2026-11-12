import type { Ballot, Placement, PlayerId, Result, Series, SeriesStage, Stage, TieDraw, Tournament } from '../types/tournament.js';
import { type Random, drawGroupSeries, shuffle } from './draw.js';
import { SUPPORTED_COUNTS, formatFor, isSupportedCount } from './format.js';
import { groupSeries, groupStageOutcome, pendingTies, seedingOrder, semifinalistsOf } from './qualification.js';
import { compareRecords } from './ranking.js';
import { seedSemifinalGroups } from './seeding.js';
import { type PlayerRecord, isSeriesComplete, isValidPlacement, seriesRecords, seriesWinner } from './series.js';

const emptyRecord = (playerId: PlayerId): PlayerRecord => ({ playerId, wins: 0, points: 0, games: 0 });

// Every host change goes through `applyAction`: the host page applies it
// locally, then saves the resulting document. Keeping all validation here
// means the same rules run on the host page and in simulation scripts.

export const DEFAULT_EVENT_NAME = 'Guild PvP Tournament';
const MAX_PLAYER_NAME = 32;
const MAX_EVENT_NAME = 60;
const MAX_REASON = 120;

export interface ActionContext {
  /** ISO timestamp stamped on saved games, draws and polls. */
  now: string;
  random: Random;
}

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
  | { type: 'recordPoll'; seriesId: string; votes: Record<PlayerId, number>; ballots?: Ballot[] }
  | { type: 'clearPoll'; seriesId: string }
  | { type: 'resolveTies' }
  | { type: 'setLateRule'; enabled: boolean }
  | { type: 'advance' }
  | { type: 'reopenStage' }
  | { type: 'reset' };

/** Which series stage the host plays during each tournament stage. */
export const STAGE_SERIES: Record<Stage, SeriesStage | undefined> = {
  setup: undefined,
  groups: 'group',
  playIn: 'playIn',
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
      return isSupportedCount(tournament.players.length) && formatFor(tournament.players.length).hasPlayIn ? 'playIn' : 'semis';
    case 'playIn':
      return 'semis';
    case 'semis':
      return 'final';
    case 'final':
      return 'done';
    default:
      return undefined;
  }
}

const ok = (value: Tournament): Result<Tournament> => ({ ok: true, value });
const fail = (error: string): Result<Tournament> => ({ ok: false, error });

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

/** Results can only change in the stage being played; earlier stages need `reopenStage` first. */
function playableOrError(tournament: Tournament, seriesId: string): Series | string {
  const series = findSeries(tournament, seriesId);
  if (!series) return `Unknown series ${seriesId}.`;
  if (series.stage !== STAGE_SERIES[tournament.stage]) return `${series.label} is not part of the current stage.`;
  return series;
}

function createSemifinals(tournament: Tournament, semifinalists: PlayerId[]): Result<Tournament> {
  const seeding = seedingOrder(tournament, semifinalists);
  if (seeding.ties.length > 0) return fail('Resolve the ties before seeding the semifinals.');
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

function advance(tournament: Tournament): Result<Tournament> {
  if (tournament.stage === 'setup') return fail('Use “Start group stage” to begin.');
  if (tournament.stage === 'done') return fail('The tournament is already finished.');
  if (!isStageComplete(tournament)) return fail('Finish every series in this stage first.');
  if (pendingTies(tournament).length > 0) return fail('Resolve the ties first.');

  if (tournament.stage === 'groups') {
    const outcome = groupStageOutcome(tournament);
    if (formatFor(tournament.players.length).hasPlayIn) {
      const playIn: Series = {
        id: 'PI',
        stage: 'playIn',
        label: 'Play-in',
        playerIds: outcome.playIn as [PlayerId, PlayerId, PlayerId],
        winsNeeded: 1,
        games: [],
      };
      return ok({ ...tournament, stage: 'playIn', series: [...tournament.series, playIn], currentSeriesId: undefined });
    }
    return createSemifinals(tournament, outcome.qualifiers);
  }

  if (tournament.stage === 'playIn') {
    const semifinalists = semifinalistsOf(tournament);
    if (!semifinalists) return fail('The play-in has no winner yet.');
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

function reopenStage(tournament: Tournament): Result<Tournament> {
  const removeStage = (stage: SeriesStage) => tournament.series.filter((series) => series.stage !== stage);
  switch (tournament.stage) {
    case 'setup':
      return fail('Setup is the first stage.');
    case 'groups':
      if (groupSeries(tournament).some((series) => series.games.length > 0 || series.winnerOverride)) {
        return fail('Groups already have results. Undo them before going back to setup.');
      }
      return ok({ ...tournament, stage: 'setup', currentSeriesId: undefined });
    case 'playIn':
      return ok({ ...tournament, stage: 'groups', series: removeStage('playIn'), currentSeriesId: undefined });
    case 'semis': {
      const hasPlayIn = tournament.series.some((series) => series.stage === 'playIn');
      return ok({ ...tournament, stage: hasPlayIn ? 'playIn' : 'groups', series: removeStage('semi'), currentSeriesId: undefined });
    }
    case 'final':
      return ok({ ...tournament, stage: 'semis', series: removeStage('final'), currentSeriesId: undefined });
    case 'done':
      return ok({ ...tournament, stage: 'final', currentSeriesId: undefined });
  }
}

/** Records a random order for every pending tie, repeating while new ties surface. */
function resolveTies(tournament: Tournament, context: ActionContext): Result<Tournament> {
  let current = tournament;
  for (let round = 0; round < 5; round++) {
    const ties = pendingTies(current);
    if (ties.length === 0) break;
    const draws: TieDraw[] = ties.map((tie) => ({ key: tie.key, order: shuffle(tie.playerIds, context.random), drawnAt: context.now }));
    current = { ...current, tieDraws: [...current.tieDraws.filter((draw) => !draws.some((next) => next.key === draw.key)), ...draws] };
  }
  return current === tournament ? fail('There are no ties to resolve.') : ok(current);
}

function recordPoll(tournament: Tournament, seriesId: string, votes: Record<PlayerId, number>, ballots: Ballot[] | undefined, now: string): Result<Tournament> {
  const series = findSeries(tournament, seriesId);
  if (!series) return fail(`Unknown series ${seriesId}.`);
  const members = new Set(series.playerIds);
  const cleanVotes: Record<PlayerId, number> = {};
  for (const playerId of series.playerIds) {
    const count = votes[playerId] ?? 0;
    if (!Number.isInteger(count) || count < 0) return fail('Vote counts must be whole numbers, 0 or more.');
    cleanVotes[playerId] = count;
  }
  if (Object.keys(votes).some((playerId) => !members.has(playerId))) return fail('Votes can only go to players in this series.');
  if (ballots) {
    if (ballots.some((ballot) => !members.has(ballot.playerId))) return fail('Every ballot must pick a player in this series.');
    if (new Set(ballots.map((ballot) => ballot.discordId)).size !== ballots.length) return fail('Each Discord member can only vote once per series.');
  }
  return ok(withSeries(tournament, seriesId, (current) => ({ ...current, poll: { votes: cleanVotes, ...(ballots ? { ballots } : {}), recordedAt: now } })));
}

export function applyAction(tournament: Tournament, action: Action, context: ActionContext): Result<Tournament> {
  switch (action.type) {
    case 'setName': {
      const name = cleanName(action.name);
      if (!name) return fail('The event needs a name.');
      if (name.length > MAX_EVENT_NAME) return fail(`Keep the event name under ${MAX_EVENT_NAME} characters.`);
      return ok({ ...tournament, name });
    }

    case 'setPlayers': {
      if (tournament.stage !== 'setup') return fail('Players can only be changed during setup.');
      const names = action.playerNames.map(cleanName).filter(Boolean);
      if (!isSupportedCount(names.length)) return fail(`Need ${SUPPORTED_COUNTS.join(', ')} players; got ${names.length}.`);
      const tooLong = names.find((name) => name.length > MAX_PLAYER_NAME);
      if (tooLong) return fail(`“${tooLong}” is longer than ${MAX_PLAYER_NAME} characters.`);
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      for (const name of names) {
        const key = name.toLowerCase();
        if (seen.has(key)) duplicates.add(name);
        seen.add(key);
      }
      if (duplicates.size > 0) return fail(`Duplicate names: ${[...duplicates].join(', ')}.`);
      const players = names.map((name, index) => ({ id: `p${index + 1}`, name }));
      return ok({ ...tournament, players, series: [], currentSeriesId: undefined, tieDraws: [] });
    }

    case 'renamePlayer': {
      const name = cleanName(action.name);
      if (!tournament.players.some((player) => player.id === action.playerId)) return fail('Unknown player.');
      if (!name) return fail('Names cannot be empty.');
      if (name.length > MAX_PLAYER_NAME) return fail(`Keep names under ${MAX_PLAYER_NAME} characters.`);
      if (tournament.players.some((player) => player.id !== action.playerId && player.name.toLowerCase() === name.toLowerCase())) {
        return fail(`Another player is already called “${name}”.`);
      }
      return ok({ ...tournament, players: tournament.players.map((player) => (player.id === action.playerId ? { ...player, name } : player)) });
    }

    case 'drawGroups': {
      if (tournament.stage !== 'setup') return fail('Groups can only be drawn during setup.');
      if (!isSupportedCount(tournament.players.length)) return fail('Save the participants first.');
      const groups = drawGroupSeries(
        tournament.players.map((player) => player.id),
        context.random
      );
      return ok({ ...tournament, series: groups, currentSeriesId: undefined, tieDraws: [] });
    }

    case 'startGroupStage': {
      if (tournament.stage !== 'setup') return fail('The group stage has already started.');
      if (!isSupportedCount(tournament.players.length)) return fail('Save the participants first.');
      if (groupSeries(tournament).length !== formatFor(tournament.players.length).groups) return fail('Draw the groups first.');
      return ok({ ...tournament, stage: 'groups', currentSeriesId: undefined });
    }

    case 'startSeries': {
      const series = playableOrError(tournament, action.seriesId);
      if (typeof series === 'string') return fail(series);
      if (isSeriesComplete(series)) return fail(`${series.label} is already finished.`);
      const started = withSeries(tournament, series.id, (current) => ({ ...current, startedAt: current.startedAt ?? context.now }));
      return ok({ ...started, currentSeriesId: series.id });
    }

    case 'saveGame': {
      const series = playableOrError(tournament, action.seriesId);
      if (typeof series === 'string') return fail(series);
      if (isSeriesComplete(series)) return fail(`${series.label} is already finished.`);
      if (!isValidPlacement(series, action.placement)) return fail('Pick a different player for 1st, 2nd and 3rd.');
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
      if (typeof series === 'string') return fail(series);
      if (series.games.length === 0) return fail(`${series.label} has no games to undo.`);
      return ok(withSeries(tournament, series.id, (current) => ({ ...current, games: current.games.slice(0, -1) })));
    }

    case 'overrideWinner': {
      const series = playableOrError(tournament, action.seriesId);
      if (typeof series === 'string') return fail(series);
      if (!series.playerIds.includes(action.playerId)) return fail('The winner must be one of the three players.');
      const reason = cleanName(action.reason);
      if (!reason) return fail('Give a short reason viewers can see, such as “forfeit”.');
      if (reason.length > MAX_REASON) return fail(`Keep the reason under ${MAX_REASON} characters.`);
      return ok(withSeries(tournament, series.id, (current) => ({ ...current, winnerOverride: { playerId: action.playerId, reason } })));
    }

    case 'clearOverride': {
      const series = playableOrError(tournament, action.seriesId);
      if (typeof series === 'string') return fail(series);
      if (!series.winnerOverride) return fail(`${series.label} has no override.`);
      return ok(withSeries(tournament, series.id, ({ winnerOverride: _cleared, ...rest }) => rest));
    }

    case 'replacePlayer': {
      const series = playableOrError(tournament, action.seriesId);
      if (typeof series === 'string') return fail(series);
      if (series.stage !== 'semi' && series.stage !== 'final') return fail('Players can only be replaced in the semifinals and the final.');
      if (series.games.length > 0 || series.winnerOverride) return fail(`${series.label} has already started; use a winner override instead.`);
      if (!series.playerIds.includes(action.outId)) return fail('That player is not in this series.');
      if (!tournament.players.some((player) => player.id === action.inId)) return fail('Unknown replacement player.');
      if (playableSeries(tournament).some((current) => current.playerIds.includes(action.inId))) {
        return fail(`${playerName(tournament, action.inId)} is already playing in this stage.`);
      }
      return ok(
        withSeries(tournament, series.id, (current) => ({
          ...current,
          playerIds: current.playerIds.map((playerId) => (playerId === action.outId ? action.inId : playerId)) as [PlayerId, PlayerId, PlayerId],
        }))
      );
    }

    case 'recordPoll':
      return recordPoll(tournament, action.seriesId, action.votes, action.ballots, context.now);

    case 'clearPoll': {
      const series = findSeries(tournament, action.seriesId);
      if (!series) return fail(`Unknown series ${action.seriesId}.`);
      return ok(withSeries(tournament, series.id, ({ poll: _cleared, ...rest }) => rest));
    }

    case 'resolveTies':
      return resolveTies(tournament, context);

    case 'setLateRule': {
      const semis = tournament.series.filter((series) => series.stage === 'semi');
      if (semis.some((series) => series.games.length > 0 || series.winnerOverride)) return fail('The semifinals have already started.');
      if (tournament.stage === 'final' || tournament.stage === 'done') return fail('The semifinals are over.');
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
