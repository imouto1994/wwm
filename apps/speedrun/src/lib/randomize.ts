import type { LoadoutResult, SkillEntry, WeaponEntry } from '@/types/randomizer';

// Injectable random source so tests can drive the engine deterministically.
// Must return a value in [0, 1), matching Math.random's contract.
export type Rng = () => number;

// Picks one random element from a non-empty pool. Callers must guard emptiness.
function pickRandom<T>(pool: readonly T[], rng: Rng): T {
  const index = Math.floor(rng() * pool.length);
  // Clamp defensively: rng() is contractually < 1, but a misbehaving caller
  // returning exactly 1 would otherwise index one past the end.
  return pool[Math.min(index, pool.length - 1)];
}

// Draws `count` unique elements from `pool` without replacement via a partial
// Fisher-Yates shuffle. Does not mutate the input array. Every permutation of
// every `count`-sized subset is equally likely, given an unbiased `rng`.
function sampleUnique<T>(pool: readonly T[], count: number, rng: Rng): T[] {
  const working = [...pool];
  const picked: T[] = [];
  for (let i = 0; i < count; i++) {
    const remaining = working.length - i;
    // Clamp defensively: rng() is contractually < 1, but a misbehaving
    // caller-supplied rng returning a value >= 1 would otherwise push `j`
    // out of bounds and silently corrupt the draw (see randomize.test.ts's
    // fractionsForTrial helper for why this matters even for test rngs).
    const j = Math.min(i + Math.floor(rng() * remaining), working.length - 1);
    [working[i], working[j]] = [working[j], working[i]];
    picked.push(working[i]);
  }
  return picked;
}

/**
 * Randomizes one full speedrun loadout:
 * - Weapon 1 and Weapon 2 are both drawn uniformly from the full weapons
 *   pool, guaranteed different from each other.
 * - 8 unique mystic skills are drawn from the full skills pool.
 *
 * `WeaponEntry.isDps` is intentionally NOT used here - a past version of
 * this event restricted Weapon 1 to DPS-only weapons, but that restriction
 * was removed. The flag is kept on the data model (not deleted) in case a
 * future event wants it back; see the "future: reintroduce a DPS-only slot"
 * note below for how to do that without touching the data files.
 *
 * Pure and framework-free: no randomness escapes except through `rng`, so
 * this is fully deterministic (and testable) when `rng` is seeded/mocked.
 *
 * Throws a descriptive error if a pool is too small to satisfy the rules,
 * rather than silently returning an incomplete/invalid result. Callers
 * (the UI) should catch this and show a friendly message.
 */
export function randomizeLoadout(weapons: readonly WeaponEntry[], skills: readonly SkillEntry[], rng: Rng = Math.random): LoadoutResult {
  if (weapons.length < 2) {
    throw new Error('Need at least 2 weapons in the pool to randomize a loadout.');
  }
  if (skills.length < 8) {
    throw new Error(`Need at least 8 mystic skills in the pool to randomize a loadout (currently ${skills.length}).`);
  }

  const weapon1 = pickRandom(weapons, rng);
  // Excluding weapon1's id from the 2nd pick's pool enforces "must differ".
  // Future: reintroduce a DPS-only slot 1 by passing
  // `weapons.filter((w) => w.isDps)` as the pool for weapon1 here instead of
  // the full `weapons` array - everything else (weapon2's exclusion, the
  // skill draw) stays the same.
  const weapon2Pool = weapons.filter((weapon) => weapon.id !== weapon1.id);
  const weapon2 = pickRandom(weapon2Pool, rng);
  const mysticSkills = sampleUnique(skills, 8, rng);

  return {
    weapon1Id: weapon1.id,
    weapon2Id: weapon2.id,
    skillIds: mysticSkills.map((skill) => skill.id),
  };
}
