// Player-count rules. The event only runs with counts divisible by 3 between
// 21 and 30, so every group is a full 1v1v1 and nobody plays twice in a stage.
//
// NOTE: modules in src/lib use relative imports with explicit `.js`
// extensions (not the `@/` alias) because the Vercel Function in api/
// imports them too, and Node's ESM loader needs real relative paths.

export const SUPPORTED_COUNTS = [21, 24, 27, 30] as const;
export const SEMIFINALISTS = 9;

export interface EventFormat {
  players: number;
  groups: number;
  /** Semifinal spots the group winners leave empty, filled by host picks (21 → 2, 24 → 1). */
  fillInSpots: number;
  /** Group winners beyond the 9 semifinal spots, left out by host pick (30 → 1). */
  dropSpots: number;
}

/**
 * Over/under lines the host can set for the "how many games?" prediction. A
 * first-to-2 series lasts 2 to 4 games, so 2.5 is the natural default; whole
 * numbers are allowed and can end exactly on the line (a push).
 */
export const GAMES_LINE_OPTIONS = [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
export const DEFAULT_GAMES_LINE = 2.5;

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
