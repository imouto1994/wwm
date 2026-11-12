// Player-count rules. The event only runs with counts divisible by 3 between
// 21 and 30, so every group is a full 1v1v1 and no fill-ins are ever needed.
//
// NOTE: modules in src/lib use relative imports with explicit `.js`
// extensions (not the `@/` alias) because the Vercel Function in api/
// imports them too, and Node's ESM loader needs real relative paths.

export const SUPPORTED_COUNTS = [21, 24, 27, 30] as const;
export const SEMIFINALISTS = 9;

export interface EventFormat {
  players: number;
  groups: number;
  /** Best runners-up who fill the semifinal spots left after the group winners (21 and 24 players). */
  runnerUpSpots: number;
  /** 30 players: 10 group winners for 9 spots, so the weakest two meet the best runner-up in a play-in. */
  hasPlayIn: boolean;
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
    runnerUpSpots: Math.max(0, SEMIFINALISTS - groups),
    hasPlayIn: groups > SEMIFINALISTS,
  };
}
