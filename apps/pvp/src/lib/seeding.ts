import type { PlayerId } from '../types/tournament.js';

/**
 * 0-based seed positions for each semifinal group: seeds 3-4-9, 2-5-8 and
 * 1-6-7. Each group gets one seed from every tier of three, and the top
 * seed's group comes last so it plays as the headliner.
 */
export const SEMIFINAL_SEEDS = [
  [2, 3, 8],
  [1, 4, 7],
  [0, 5, 6],
] as const;

const PERMUTATIONS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
] as const;

// TIER_POSITIONS[tier][group] = the seed position that tier contributes to that group.
const TIER_POSITIONS = [0, 1, 2].map((tier) => SEMIFINAL_SEEDS.map((positions) => positions.find((position) => Math.floor(position / 3) === tier) ?? 0));

/**
 * Splits nine seeded players (best first) into three semifinal groups.
 *
 * Starts from the snake seeding; if that puts two players from the same
 * first-round group together (a group winner and its runner-up), it swaps
 * players within the same seed tier. Of all tier-preserving arrangements
 * (6^3 = 216), it picks the conflict-free one that moves the fewest players,
 * so the result stays as close to the snake as possible and is deterministic.
 */
export function seedSemifinalGroups(order: readonly PlayerId[], firstRoundGroupOf: (playerId: PlayerId) => string | undefined): PlayerId[][] {
  if (order.length !== 9) throw new Error(`Semifinal seeding needs 9 players, got ${order.length}.`);

  const build = (tierPermutations: readonly (readonly number[])[]) =>
    [0, 1, 2].map((group) => tierPermutations.map((permutation, tier) => TIER_POSITIONS[tier][permutation[group]]).sort((a, b) => a - b));

  const hasConflict = (groups: number[][]) =>
    groups.some((positions) => {
      const origins = positions.map((position) => firstRoundGroupOf(order[position])).filter((origin) => origin !== undefined);
      return new Set(origins).size < origins.length;
    });

  let best: number[][] | undefined;
  let bestMoves = Number.POSITIVE_INFINITY;
  for (const first of PERMUTATIONS) {
    for (const second of PERMUTATIONS) {
      for (const third of PERMUTATIONS) {
        const tierPermutations = [first, second, third];
        const moves = tierPermutations.reduce((sum, permutation) => sum + permutation.filter((group, index) => group !== index).length, 0);
        if (moves >= bestMoves) continue;
        const groups = build(tierPermutations);
        if (!hasConflict(groups)) {
          best = groups;
          bestMoves = moves;
        }
      }
    }
  }

  const positions = best ?? build([PERMUTATIONS[0], PERMUTATIONS[0], PERMUTATIONS[0]]);
  return positions.map((group) => group.map((position) => order[position]));
}
