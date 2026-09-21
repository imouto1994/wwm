import { randomizeLoadout } from '@/lib/randomize';
import type { SkillEntry, WeaponEntry } from '@/types/randomizer';
import { describe, expect, it } from 'vitest';

function weapon(id: string, isDps: boolean): WeaponEntry {
  return { id, name: id, image: `/images/weapons/${id}.svg`, isDps };
}

function skill(id: string): SkillEntry {
  return { id, name: id, image: `/images/skills/${id}.svg` };
}

const WEAPONS: WeaponEntry[] = [weapon('w-dps-1', true), weapon('w-dps-2', true), weapon('w-other-1', false), weapon('w-other-2', false)];

const SKILLS: SkillEntry[] = Array.from({ length: 10 }, (_, i) => skill(`s-${i}`));

// Cycles through a fixed sequence of [0, 1) values so a single small list can
// drive an arbitrarily long run of rng() calls deterministically.
function makeQueueRng(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

// Spreads `trial` (any non-negative integer) into a handful of distinct,
// well-formed [0, 1) rng() values via modulo - so every trial exercises a
// different draw sequence without ever violating rng()'s "< 1" contract
// (a naive formula like `(trial * 7 + 2) / 25` can exceed 1 for larger trials
// and corrupt index math in pickRandom/sampleUnique).
function fractionsForTrial(trial: number, denominator: number): number[] {
  return [1, 3, 7, 11, 13, 17].map((multiplier) => ((trial * multiplier) % denominator) / denominator);
}

describe('randomizeLoadout', () => {
  it('draws weapon 1 from the full pool (not restricted to DPS weapons)', () => {
    // isDps is currently inert (see randomize.ts) - this guards against
    // accidentally reintroducing a DPS-only filter for weapon 1. Runs enough
    // trials that a non-DPS weapon (w-other-1/w-other-2) should show up at
    // least once if weapon 1 truly draws from the whole pool.
    const drawnWeapon1Ids = new Set<string>();
    for (let trial = 0; trial < 100; trial++) {
      const rng = makeQueueRng(fractionsForTrial(trial, 100));
      const result = randomizeLoadout(WEAPONS, SKILLS, rng);
      drawnWeapon1Ids.add(result.weapon1Id);
    }
    expect(drawnWeapon1Ids.has('w-other-1') || drawnWeapon1Ids.has('w-other-2')).toBe(true);
  });

  it('always draws weapon 2 different from weapon 1, from the full pool', () => {
    for (let trial = 0; trial < 25; trial++) {
      const rng = makeQueueRng(fractionsForTrial(trial, 25));
      const result = randomizeLoadout(WEAPONS, SKILLS, rng);
      expect(result.weapon2Id).not.toBe(result.weapon1Id);
      expect(WEAPONS.some((w) => w.id === result.weapon2Id)).toBe(true);
    }
  });

  it('always draws exactly 8 unique skill ids, all from the pool', () => {
    for (let trial = 0; trial < 25; trial++) {
      const rng = makeQueueRng(fractionsForTrial(trial, 25));
      const result = randomizeLoadout(WEAPONS, SKILLS, rng);
      expect(result.skillIds).toHaveLength(8);
      expect(new Set(result.skillIds).size).toBe(8);
      for (const id of result.skillIds) {
        expect(SKILLS.some((s) => s.id === id)).toBe(true);
      }
    }
  });

  it('is deterministic for a given rng sequence', () => {
    const values = [0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6, 0.5, 0.15];
    const resultA = randomizeLoadout(WEAPONS, SKILLS, makeQueueRng(values));
    const resultB = randomizeLoadout(WEAPONS, SKILLS, makeQueueRng(values));
    expect(resultA).toEqual(resultB);
  });

  it('does not require any DPS-flagged weapon in the pool', () => {
    // isDps is currently inert for randomization - a pool with every weapon
    // flagged isDps: false must still work.
    const noDpsWeapons = [weapon('w-1', false), weapon('w-2', false), weapon('w-3', false)];
    expect(() => randomizeLoadout(noDpsWeapons, SKILLS)).not.toThrow();
  });

  it('throws a friendly error when there are fewer than 2 weapons', () => {
    const oneWeapon = [weapon('w-1', true)];
    expect(() => randomizeLoadout(oneWeapon, SKILLS)).toThrow(/2 weapons/i);
  });

  it('throws a friendly error when there are fewer than 8 skills', () => {
    const fewSkills = SKILLS.slice(0, 5);
    expect(() => randomizeLoadout(WEAPONS, fewSkills)).toThrow(/8 mystic skills/i);
  });
});
