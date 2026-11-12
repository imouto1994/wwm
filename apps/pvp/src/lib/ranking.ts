import type { PlayerId, TieDraw } from '../types/tournament.js';
import type { PlayerRecord } from './series.js';

/** Tied players whose order still needs a random draw. */
export interface Tie {
  key: string;
  playerIds: PlayerId[];
}

function pointsPerGame(record: PlayerRecord): number {
  return record.games === 0 ? 0 : record.points / record.games;
}

/**
 * Tiebreak order: more game wins, then more points per game. Negative means
 * `a` ranks above `b`. Points and games are small integers, so equal ratios
 * (4/3 vs 8/6) produce identical doubles and float comparison is exact enough.
 */
export function compareRecords(a: PlayerRecord, b: PlayerRecord): number {
  if (a.wins !== b.wins) return b.wins - a.wins;
  return pointsPerGame(b) - pointsPerGame(a);
}

/** Identifies one tie: where it happened plus who is in it, independent of order. */
export function tieKey(context: string, playerIds: readonly PlayerId[]): string {
  return `${context}:${[...playerIds].sort().join(',')}`;
}

/**
 * Ranks records best first. Players still level after the tiebreakers are
 * ordered by a recorded draw for that exact tie when one exists; otherwise
 * they keep their input order and are reported in `ties`.
 */
export function rankRecords(records: readonly PlayerRecord[], context: string, tieDraws: readonly TieDraw[]): { order: PlayerId[]; ties: Tie[] } {
  const sorted = [...records].sort(compareRecords);
  const order: PlayerId[] = [];
  const ties: Tie[] = [];
  let start = 0;
  while (start < sorted.length) {
    let end = start + 1;
    while (end < sorted.length && compareRecords(sorted[start], sorted[end]) === 0) end += 1;
    const group = sorted.slice(start, end).map((record) => record.playerId);
    if (group.length > 1) {
      const key = tieKey(context, group);
      const draw = tieDraws.find((candidate) => candidate.key === key);
      if (draw && draw.order.length === group.length && group.every((playerId) => draw.order.includes(playerId))) {
        order.push(...draw.order);
      } else {
        order.push(...group);
        ties.push({ key, playerIds: group });
      }
    } else {
      order.push(...group);
    }
    start = end;
  }
  return { order, ties };
}

/** Only ties that straddle a cut change who makes it; the rest don't need a draw. */
export function tiesAcrossCut(ties: readonly Tie[], order: readonly PlayerId[], cut: number): Tie[] {
  return ties.filter((tie) => {
    const positions = tie.playerIds.map((playerId) => order.indexOf(playerId));
    return positions.some((position) => position < cut) && positions.some((position) => position >= cut);
  });
}
