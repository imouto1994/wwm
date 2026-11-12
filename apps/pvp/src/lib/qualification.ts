import type { PlayerId, Series, Tournament } from '../types/tournament.js';
import { SEMIFINALISTS, formatFor, isSupportedCount } from './format.js';
import { type Tie, rankRecords, tiesAcrossCut } from './ranking.js';
import { type PlayerRecord, seriesRecords, seriesWinner } from './series.js';

export interface GroupStageOutcome {
  /** Every group has a winner. `qualifiers`, `playIn` and `ties` are only final once this is true. */
  complete: boolean;
  /** Winners of finished groups, in group order. */
  winners: PlayerId[];
  /** Runners-up of finished groups, in group order. Only computed when the format uses them (21, 24, 30). */
  runnersUp: PlayerId[];
  /** `runnersUp` best first: the runners-up race shown to viewers, and the spare-spot order. */
  rankedRunnersUp: PlayerId[];
  /** Group-stage record per player, used for every ranking and for seeding. */
  records: Map<PlayerId, PlayerRecord>;
  /** Direct semifinal spots: 9 players, or 8 at 30 players where the play-in decides the last one. */
  qualifiers: PlayerId[];
  /** 30 players only: the two weakest group winners plus the best runner-up. */
  playIn: PlayerId[];
  /** Ties that still change the outcome and need a recorded draw. */
  ties: Tie[];
}

export function groupSeries(tournament: Tournament): Series[] {
  return tournament.series.filter((series) => series.stage === 'group');
}

const EMPTY_OUTCOME: GroupStageOutcome = {
  complete: false,
  winners: [],
  runnersUp: [],
  rankedRunnersUp: [],
  records: new Map(),
  qualifiers: [],
  playIn: [],
  ties: [],
};

function recordOf(records: Map<PlayerId, PlayerRecord>, playerId: PlayerId): PlayerRecord {
  return records.get(playerId) ?? { playerId, wins: 0, points: 0, games: 0 };
}

/**
 * Applies the qualification rules to the group stage. Works on partial
 * results too, so the viewer can show winners and the runners-up race while
 * groups are still being played.
 */
export function groupStageOutcome(tournament: Tournament): GroupStageOutcome {
  if (!isSupportedCount(tournament.players.length)) return EMPTY_OUTCOME;
  const format = formatFor(tournament.players.length);
  const groups = groupSeries(tournament);
  const needsRunnersUp = format.runnerUpSpots > 0 || format.hasPlayIn;

  const records = new Map<PlayerId, PlayerRecord>();
  const winners: PlayerId[] = [];
  const runnersUp: PlayerId[] = [];
  const ties: Tie[] = [];
  let complete = groups.length === format.groups;

  for (const series of groups) {
    const groupRecords = seriesRecords(series);
    for (const record of groupRecords) records.set(record.playerId, record);
    const winner = seriesWinner(series);
    if (!winner) {
      complete = false;
      continue;
    }
    winners.push(winner);
    if (needsRunnersUp) {
      const others = groupRecords.filter((record) => record.playerId !== winner);
      const ranked = rankRecords(others, `runnerUp:${series.id}`, tournament.tieDraws);
      runnersUp.push(ranked.order[0]);
      ties.push(...ranked.ties);
    }
  }

  const rankedRunnersUp = rankRecords(
    runnersUp.map((playerId) => recordOf(records, playerId)),
    'runnersUp',
    tournament.tieDraws
  );

  let qualifiers: PlayerId[] = [];
  let playIn: PlayerId[] = [];
  if (complete) {
    if (format.hasPlayIn) {
      const rankedWinners = rankRecords(
        winners.map((playerId) => recordOf(records, playerId)),
        'winners',
        tournament.tieDraws
      );
      const direct = SEMIFINALISTS - 1;
      qualifiers = rankedWinners.order.slice(0, direct);
      playIn = [...rankedWinners.order.slice(direct), rankedRunnersUp.order[0]];
      ties.push(...tiesAcrossCut(rankedWinners.ties, rankedWinners.order, direct), ...tiesAcrossCut(rankedRunnersUp.ties, rankedRunnersUp.order, 1));
    } else {
      qualifiers = [...winners, ...rankedRunnersUp.order.slice(0, format.runnerUpSpots)];
      ties.push(...tiesAcrossCut(rankedRunnersUp.ties, rankedRunnersUp.order, format.runnerUpSpots));
    }
  }

  return { complete, winners, runnersUp, rankedRunnersUp: rankedRunnersUp.order, records, qualifiers, playIn, ties };
}

/** The nine semifinalists, once the group stage (and the play-in at 30 players) is decided. */
export function semifinalistsOf(tournament: Tournament): PlayerId[] | undefined {
  const outcome = groupStageOutcome(tournament);
  if (!outcome.complete || outcome.ties.length > 0) return undefined;
  if (!formatFor(tournament.players.length).hasPlayIn) return outcome.qualifiers;
  const playIn = tournament.series.find((series) => series.stage === 'playIn');
  const playInWinner = playIn ? seriesWinner(playIn) : undefined;
  return playInWinner ? [...outcome.qualifiers, playInWinner] : undefined;
}

/** Seeds come from group-stage records, so group winners always rank above runners-up. */
export function seedingOrder(tournament: Tournament, semifinalists: readonly PlayerId[]): { order: PlayerId[]; ties: Tie[] } {
  const { records } = groupStageOutcome(tournament);
  return rankRecords(
    semifinalists.map((playerId) => recordOf(records, playerId)),
    'seeding',
    tournament.tieDraws
  );
}

/**
 * Ties blocking the next stage. Group runner-up ties come first because they
 * decide who is a runner-up at all; resolving them can expose new ties, so
 * callers re-check after recording draws (see the `resolveTies` action).
 */
export function pendingTies(tournament: Tournament): Tie[] {
  if (tournament.stage === 'groups') {
    const outcome = groupStageOutcome(tournament);
    if (!outcome.complete) return [];
    if (outcome.ties.length > 0) return outcome.ties;
    if (formatFor(tournament.players.length).hasPlayIn) return [];
    return seedingOrder(tournament, outcome.qualifiers).ties;
  }
  if (tournament.stage === 'playIn') {
    const semifinalists = semifinalistsOf(tournament);
    return semifinalists ? seedingOrder(tournament, semifinalists).ties : [];
  }
  return [];
}
