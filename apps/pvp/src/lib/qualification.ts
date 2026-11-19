import type { PlayerId, Series, Tournament } from '../types/tournament.js';
import { WINS_NEEDED, formatFor, isSupportedCount } from './format.js';
import { type Tie, compareRecords, rankRecords } from './ranking.js';
import { seedSemifinalGroups } from './seeding.js';
import { type PlayerRecord, seriesRecords, seriesWinner, survivalLoser } from './series.js';

export interface GroupStageOutcome {
  /** Every group has a winner. */
  complete: boolean;
  /** Winners of finished groups, in group order. */
  winners: PlayerId[];
  /** Group-stage record per player: ranks the host's pick candidates and the survival seats, and seeds the semifinals. */
  records: Map<PlayerId, PlayerRecord>;
}

export function groupSeries(tournament: Tournament): Series[] {
  return tournament.series.filter((series) => series.stage === 'group');
}

function recordOf(records: Map<PlayerId, PlayerRecord>, playerId: PlayerId): PlayerRecord {
  return records.get(playerId) ?? { playerId, wins: 0, points: 0, games: 0 };
}

/** Group winners and records so far. Works on partial results, so the viewer can follow along. */
export function groupStageOutcome(tournament: Tournament): GroupStageOutcome {
  const groups = groupSeries(tournament);
  const records = new Map<PlayerId, PlayerRecord>();
  const winners: PlayerId[] = [];
  for (const series of groups) {
    for (const record of seriesRecords(series)) records.set(record.playerId, record);
    const winner = seriesWinner(series);
    if (winner) winners.push(winner);
  }
  const complete =
    isSupportedCount(tournament.players.length) && groups.length === formatFor(tournament.players.length).groups && winners.length === groups.length;
  return { complete, winners, records };
}

/** Seats in the 30-player survival game; its 3rd place is the one winner too many. */
export const SURVIVAL_SEATS = 3;

export interface SurvivalPlan {
  /** Group winners best first, with recorded draws applied; the last three take the seats. */
  ranking: PlayerId[];
  /** A tie that straddles the seat cut, waiting for a recorded draw before the seats are known. */
  ties: Tie[];
  /** The three players, once every group is decided and any tie at the cut is drawn. */
  seats?: PlayerId[];
}

/**
 * The survival game at 30 players (undefined at other counts): the three
 * weakest group winners by wins, then points per game, play one game and 3rd
 * place is out. Winners' records come in only a handful of shapes, so the cut
 * often falls inside a tie; a recorded draw then picks who takes the last
 * seats. Ties wholly inside or outside the seats change nothing and need no draw.
 */
export function survivalPlan(tournament: Tournament): SurvivalPlan | undefined {
  if (!isSupportedCount(tournament.players.length) || formatFor(tournament.players.length).dropSpots === 0) return undefined;
  const outcome = groupStageOutcome(tournament);
  const { order, ties } = rankRecords(
    outcome.winners.map((playerId) => recordOf(outcome.records, playerId)),
    'survival',
    tournament.tieDraws
  );
  if (!outcome.complete) return { ranking: order, ties: [] };
  const cut = order.length - SURVIVAL_SEATS;
  const atCut = ties.filter((tie) => {
    const positions = tie.playerIds.map((playerId) => order.indexOf(playerId));
    return Math.min(...positions) < cut && Math.max(...positions) >= cut;
  });
  return { ranking: order, ties: atCut, ...(atCut.length === 0 ? { seats: order.slice(cut) } : {}) };
}

export function survivalSeriesFrom(seats: readonly PlayerId[]): Series {
  return { id: 'P', stage: 'survival', label: 'Survival game', playerIds: [seats[0], seats[1], seats[2]], winsNeeded: WINS_NEEDED.survival, games: [] };
}

export interface SemifinalSelection {
  /** Empty spots the host fills (21 → 2, 24 → 1) and winners too many (30 → 1). */
  fillInSpots: number;
  dropSpots: number;
  /** The host's picks that still fit the current results (an undone game can turn a fill-in into a winner). */
  fillIns: PlayerId[];
  /** The winner the survival game knocked out, once it's played. */
  dropped: PlayerId[];
  /** Who the host can pick for an empty spot: non-winners, best group-stage record first. */
  fillInCandidates: PlayerId[];
  /** The nine semifinalists, once every group is decided and the picks or the survival game are done. */
  semifinalists?: PlayerId[];
}

/**
 * Applies the qualification rule: every group winner goes through. At 21 and
 * 24 players the host's picks fill the empty spots; that's a judgement call on
 * purpose, so the candidates are only ordered by record as a guide. At 30 the
 * survival game removes the extra winner.
 */
export function semifinalSelection(tournament: Tournament): SemifinalSelection {
  const empty: SemifinalSelection = { fillInSpots: 0, dropSpots: 0, fillIns: [], dropped: [], fillInCandidates: [] };
  if (!isSupportedCount(tournament.players.length)) return empty;
  const { fillInSpots, dropSpots } = formatFor(tournament.players.length);
  const outcome = groupStageOutcome(tournament);
  const winners = new Set(outcome.winners);
  const byRecord = (playerIds: PlayerId[]) => [...playerIds].sort((a, b) => compareRecords(recordOf(outcome.records, a), recordOf(outcome.records, b)));

  const fillInCandidates = fillInSpots > 0 ? byRecord(tournament.players.filter((playerId) => !winners.has(playerId))) : [];
  const fillIns = (tournament.semifinalPicks?.fillIns ?? []).filter((playerId) => fillInCandidates.includes(playerId)).slice(0, fillInSpots);
  const survival = tournament.series.find((series) => series.stage === 'survival');
  const loser = survival ? survivalLoser(survival) : undefined;
  const dropped = dropSpots > 0 && loser ? [loser] : [];

  const ready = outcome.complete && fillIns.length === fillInSpots && dropped.length === dropSpots;
  const semifinalists = ready ? [...outcome.winners.filter((playerId) => !dropped.includes(playerId)), ...fillIns] : undefined;
  return { fillInSpots, dropSpots, fillIns, dropped, fillInCandidates, ...(semifinalists ? { semifinalists } : {}) };
}

/** Seeds come from group-stage records, so group winners normally rank above fill-ins. */
export function seedingOrder(tournament: Tournament, semifinalists: readonly PlayerId[]): { order: PlayerId[]; ties: Tie[] } {
  const { records } = groupStageOutcome(tournament);
  return rankRecords(
    semifinalists.map((playerId) => recordOf(records, playerId)),
    'seeding',
    tournament.tieDraws
  );
}

/**
 * The semifinal groups as they stand before the semifinals start: the host's
 * arrangement when it still holds exactly the current semifinalists,
 * otherwise the seeded groups. Undefined until the group stage, the host's
 * picks or the survival game, and the seeding draws are all done. Viewers see this too.
 */
export function semifinalGroups(tournament: Tournament): PlayerId[][] | undefined {
  const { semifinalists } = semifinalSelection(tournament);
  if (!semifinalists) return undefined;
  const draft = tournament.semifinalDraft;
  if (draft) {
    const members = new Set(draft.flat());
    if (members.size === semifinalists.length && semifinalists.every((playerId) => members.has(playerId))) return draft.map((group) => [...group]);
  }
  const seeding = seedingOrder(tournament, semifinalists);
  if (seeding.ties.length > 0) return undefined;
  const firstRoundGroup = new Map(groupSeries(tournament).flatMap((series) => series.playerIds.map((playerId) => [playerId, series.id] as const)));
  return seedSemifinalGroups(seeding.order, (playerId) => firstRoundGroup.get(playerId));
}

/** Semifinal series for a set of groups; used both to start the semifinals and to preview them. */
export function semifinalSeriesFrom(groups: readonly PlayerId[][]): Series[] {
  return groups.map((playerIds, index) => ({
    id: `S${index + 1}`,
    stage: 'semi',
    label: `Semifinal ${index + 1}`,
    playerIds: [playerIds[0], playerIds[1], playerIds[2]],
    winsNeeded: WINS_NEEDED.semi,
    games: [],
  }));
}

/**
 * Ties that need a recorded draw before the tournament can move on: at 30
 * players, a tie at the survival seat cut during the group stage; otherwise
 * the semifinal seeding ties, known once the picks or the survival game are done.
 */
export function pendingTies(tournament: Tournament): Tie[] {
  if (tournament.stage === 'groups') {
    const plan = survivalPlan(tournament);
    if (plan) return plan.ties;
  }
  if (tournament.stage !== 'groups' && tournament.stage !== 'survival') return [];
  const { semifinalists } = semifinalSelection(tournament);
  return semifinalists ? seedingOrder(tournament, semifinalists).ties : [];
}
