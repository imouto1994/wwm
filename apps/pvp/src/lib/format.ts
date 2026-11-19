// Player-count rules. The event only runs with counts divisible by 3 between
// 21 and 30, so every group is a full 1v1v1 and nobody plays twice in a stage.
//
// NOTE: modules in src/lib use relative imports with explicit `.js`
// extensions (not the `@/` alias) because the Vercel Function in api/
// imports them too, and Node's ESM loader needs real relative paths.

import type { SeriesStage } from '../types/tournament.js';

export const SUPPORTED_COUNTS = [21, 24, 27, 30] as const;
export const SEMIFINALISTS = 9;

export interface EventFormat {
  players: number;
  groups: number;
  /** Semifinal spots the group winners leave empty, filled by host picks (21 → 2, 24 → 1). */
  fillInSpots: number;
  /** Group winners beyond the 9 semifinal spots (30 → 1); the survival game decides who goes out. */
  dropSpots: number;
}

/** Game wins needed to take a series in each phase: first to 2, a single game for the survival game, first to 3 for the grand final. */
export const WINS_NEEDED: Record<SeriesStage, 1 | 2 | 3> = { group: 2, survival: 1, semi: 2, final: 3 };

/**
 * Fixed over/under lines for the "how many games?" prediction, chosen so the
 * two answers are as close to a coin flip as possible. With three players, a
 * first-to-2 series lasts 2 to 4 games and a first-to-3 final 3 to 7. Under
 * the event plan's skill model (200,000 simulated events) the splits are:
 *   group stage, first to 2, line 2.5: 48% under / 52% over (3.5 would be 88% under)
 *   semifinals,  first to 2, line 2.5: 49% / 51%
 *   grand final, first to 3, line 4.5: 47% / 53% (5.5 would be 76% under)
 * Across the range from evenly matched to one clear favourite these lines stay
 * between 33% and 53% under, closer to even than any other half-line. Half
 * lines also mean no vote is ever voided by a game count landing on the line;
 * whole numbers (3, or 5 for the final) would void 27-44% of votes that way.
 */
// The survival game is always one game, so it has no over/under poll (see hasGamesPrediction); its entry only completes the record.
export const GAMES_LINES: Record<SeriesStage, number> = { group: 2.5, survival: 0.5, semi: 2.5, final: 4.5 };

export function isValidGamesLine(line: unknown): line is number {
  return typeof line === 'number' && Number.isFinite(line) && line >= 0.5 && line <= 10 && Number.isInteger(line * 2);
}

export function isSupportedCount(count: number): boolean {
  return (SUPPORTED_COUNTS as readonly number[]).includes(count);
}

export function formatFor(count: number): EventFormat {
  if (!isSupportedCount(count)) {
    throw new Error(`Unsupported player count ${count}; expected one of ${SUPPORTED_COUNTS.join(', ')}.`);
  }
  const groups = count / 3;
  return {
    players: count,
    groups,
    fillInSpots: Math.max(0, SEMIFINALISTS - groups),
    dropSpots: Math.max(0, groups - SEMIFINALISTS),
  };
}
