import type { PlayerId, Series, Tournament } from '../types/tournament.js';
import { formatFor, isSupportedCount } from './format.js';
import { type Tie, compareRecords, rankRecords } from './ranking.js';
import { seedSemifinalGroups } from './seeding.js';
import { type PlayerRecord, seriesRecords, seriesWinner } from './series.js';

export interface GroupStageOutcome {
  /** Every group has a winner. */
  complete: boolean;
  /** Winners of finished groups, in group order. */
  winners: PlayerId[];
  /** Group-stage record per player: ranks the host's pick candidates and seeds the semifinals. */
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

export interface SemifinalSelection {
  /** Empty spots the host fills (21 → 2, 24 → 1) and winners the host leaves out (30 → 1). */
  fillInSpots: number;
  dropSpots: number;
  /** The host's picks that still fit the current results (an undone game can turn a fill-in into a winner). */
  fillIns: PlayerId[];
  dropped: PlayerId[];
  /** Who the host can pick, best group-stage record first: non-winners to fill a spot, winners to leave out. */
  fillInCandidates: PlayerId[];
  dropCandidates: PlayerId[];
  /** The nine semifinalists, once every group is decided and the picks are complete. */
  semifinalists?: PlayerId[];
}

/**
 * Applies the qualification rule: every group winner goes through, and the
 * host's picks make up the difference to 9. The host decides on purpose (no
 * runner-up ranking or play-in), so the candidate lists are only ordered by
 * record as a guide.
 */
export function semifinalSelection(tournament: Tournament): SemifinalSelection {
  const empty: SemifinalSelection = { fillInSpots: 0, dropSpots: 0, fillIns: [], dropped: [], fillInCandidates: [], dropCandidates: [] };
  if (!isSupportedCount(tournament.players.length)) return empty;
  const { fillInSpots, dropSpots } = formatFor(tournament.players.length);
  const outcome = groupStageOutcome(tournament);
  const winners = new Set(outcome.winners);
  const byRecord = (playerIds: PlayerId[]) => [...playerIds].sort((a, b) => compareRecords(recordOf(outcome.records, a), recordOf(outcome.records, b)));

  const fillInCandidates = fillInSpots > 0 ? byRecord(tournament.players.filter((playerId) => !winners.has(playerId))) : [];
  const dropCandidates = dropSpots > 0 ? byRecord(outcome.winners) : [];
  const picks = tournament.semifinalPicks;
  const fillIns = (picks?.fillIns ?? []).filter((playerId) => fillInCandidates.includes(playerId)).slice(0, fillInSpots);
  const dropped = (picks?.dropped ?? []).filter((playerId) => winners.has(playerId)).slice(0, dropSpots);

  const ready = outcome.complete && fillIns.length === fillInSpots && dropped.length === dropSpots;
  const semifinalists = ready ? [...outcome.winners.filter((playerId) => !dropped.includes(playerId)), ...fillIns] : undefined;
  return { fillInSpots, dropSpots, fillIns, dropped, fillInCandidates, dropCandidates, ...(semifinalists ? { semifinalists } : {}) };
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
 * picks and the seeding draws are all done. Viewers see this too.
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
export function semifinalSeriesFrom(groups: readonly PlayerId[][], lateRule: boolean): Series[] {
  return groups.map((playerIds, index) => ({
    id: `S${index + 1}`,
    stage: 'semi',
    label: `Semifinal ${index + 1}`,
    playerIds: [playerIds[0], playerIds[1], playerIds[2]],
    winsNeeded: lateRule ? 1 : 2,
    games: [],
  }));
}

/** Seeding ties blocking the semifinals. Known only once the host's picks are complete. */
export function pendingTies(tournament: Tournament): Tie[] {
  if (tournament.stage !== 'groups') return [];
  const { semifinalists } = semifinalSelection(tournament);
  return semifinalists ? seedingOrder(tournament, semifinalists).ties : [];
}
