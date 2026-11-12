import type { Placement, PlayerId, Series } from '../types/tournament.js';

/** Points per finishing place, used only for tiebreaks (1st, 2nd, 3rd). */
export const PLACE_POINTS = [3, 1, 0] as const;

/** One player's results within a set of games. */
export interface PlayerRecord {
  playerId: PlayerId;
  wins: number;
  points: number;
  games: number;
}

/** Records for the three players of a series, in `series.playerIds` order. */
export function seriesRecords(series: Series): PlayerRecord[] {
  const records = series.playerIds.map((playerId) => ({ playerId, wins: 0, points: 0, games: 0 }));
  const byId = new Map(records.map((record) => [record.playerId, record]));
  for (const game of series.games) {
    game.placement.forEach((playerId, place) => {
      const record = byId.get(playerId);
      if (!record) return;
      record.games += 1;
      record.points += PLACE_POINTS[place];
      if (place === 0) record.wins += 1;
    });
  }
  return records;
}

/**
 * The series winner: a host override if there is one, otherwise the first
 * player to reach `winsNeeded` game wins.
 */
export function seriesWinner(series: Series): PlayerId | undefined {
  if (series.winnerOverride) return series.winnerOverride.playerId;
  const wins = new Map<PlayerId, number>();
  for (const game of series.games) {
    const winner = game.placement[0];
    const total = (wins.get(winner) ?? 0) + 1;
    if (total >= series.winsNeeded) return winner;
    wins.set(winner, total);
  }
  return undefined;
}

export function isSeriesComplete(series: Series): boolean {
  return seriesWinner(series) !== undefined;
}

/** A placement must list each of the series' three players exactly once. */
export function isValidPlacement(series: Series, placement: readonly PlayerId[]): placement is Placement {
  if (placement.length !== 3) return false;
  const players = new Set(series.playerIds);
  return new Set(placement).size === 3 && placement.every((playerId) => players.has(playerId));
}

/** Game wins per player so far, in `series.playerIds` order. */
export function seriesWins(series: Series): number[] {
  return seriesRecords(series).map((record) => record.wins);
}
