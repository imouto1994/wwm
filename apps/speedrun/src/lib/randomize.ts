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
 * - Weapon 1 comes from the DPS-only pool (`isDps: true`).
 * - Weapon 2 comes from the full pool, excluding whichever weapon was just
 *   picked for slot 1 (the two martial arts must differ).
 * - 8 unique mystic skills are drawn from the full skills pool.
 *
 * Pure and framework-free: no randomness escapes except through `rng`, so
 * this is fully deterministic (and testable) when `rng` is seeded/mocked.
 *
 * Throws a descriptive error if a pool is too small to satisfy the rules,
 * rather than silently returning an incomplete/invalid result. Callers
 * (the UI) should catch this and show a friendly message.
 */
export function randomizeLoadout(weapons: readonly WeaponEntry[], skills: readonly SkillEntry[], rng: Rng = Math.random): LoadoutResult {
  const dpsPool = weapons.filter((weapon) => weapon.isDps);
  if (dpsPool.length === 0) {
    throw new Error('No DPS weapons in the pool yet - add at least one weapon with isDps: true to src/data/weapons.ts.');
  }
  if (weapons.length < 2) {
    throw new Error('Need at least 2 weapons in the pool (1 DPS + 1 other) to randomize a loadout.');
  }
  if (skills.length < 8) {
    throw new Error(`Need at least 8 mystic skills in the pool to randomize a loadout (currently ${skills.length}).`);
  }

  const weapon1 = pickRandom(dpsPool, rng);
  // Excluding weapon1's id from the 2nd pick's pool enforces "must differ"
  // even though the DPS pool is a subset of the full pool.
  const weapon2Pool = weapons.filter((weapon) => weapon.id !== weapon1.id);
  const weapon2 = pickRandom(weapon2Pool, rng);
  const mysticSkills = sampleUnique(skills, 8, rng);

  return {
    weapon1Id: weapon1.id,
    weapon2Id: weapon2.id,
    skillIds: mysticSkills.map((skill) => skill.id),
  };
}
