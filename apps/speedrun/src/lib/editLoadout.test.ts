import { replaceSkill, replaceWeapon, skillPickerOptions, weaponPickerOptions } from '@/lib/editLoadout';
import type { LoadoutResult, SkillEntry, WeaponEntry } from '@/types/randomizer';
import { describe, expect, it } from 'vitest';

function weapon(id: string): WeaponEntry {
  return { id, name: id, image: `/images/weapons/${id}.png`, isDps: true };
}

function skill(id: string): SkillEntry {
  return { id, name: id, image: `/images/skills/${id}.png` };
}

const WEAPONS: WeaponEntry[] = [weapon('w-1'), weapon('w-2'), weapon('w-3'), weapon('w-4')];
const SKILLS: SkillEntry[] = Array.from({ length: 10 }, (_, i) => skill(`s-${i}`));

const LOADOUT: LoadoutResult = {
  weapon1Id: 'w-1',
  weapon2Id: 'w-2',
  skillIds: ['s-0', 's-1', 's-2', 's-3', 's-4', 's-5', 's-6', 's-7'],
};

describe('replaceWeapon', () => {
  it('replaces slot 1 with a different valid weapon', () => {
    expect(replaceWeapon(LOADOUT, 1, 'w-3', WEAPONS)).toEqual({
      ...LOADOUT,
      weapon1Id: 'w-3',
    });
  });

  it('replaces slot 2 with a different valid weapon', () => {
    expect(replaceWeapon(LOADOUT, 2, 'w-4', WEAPONS)).toEqual({
      ...LOADOUT,
      weapon2Id: 'w-4',
    });
  });

  it('allows replacing a slot with its own current id (no-op keep)', () => {
    expect(replaceWeapon(LOADOUT, 1, 'w-1', WEAPONS)).toEqual(LOADOUT);
  });

  it('rejects making the two weapon slots identical', () => {
    expect(replaceWeapon(LOADOUT, 1, 'w-2', WEAPONS)).toBeNull();
    expect(replaceWeapon(LOADOUT, 2, 'w-1', WEAPONS)).toBeNull();
  });

  it('rejects an unknown weapon id', () => {
    expect(replaceWeapon(LOADOUT, 1, 'not-real', WEAPONS)).toBeNull();
  });
});

describe('replaceSkill', () => {
  it('replaces one skill and keeps the other seven in place', () => {
    expect(replaceSkill(LOADOUT, 's-2', 's-8', SKILLS)).toEqual({
      ...LOADOUT,
      skillIds: ['s-0', 's-1', 's-8', 's-3', 's-4', 's-5', 's-6', 's-7'],
    });
  });

  it('allows replacing a skill with itself (no-op keep)', () => {
    expect(replaceSkill(LOADOUT, 's-2', 's-2', SKILLS)).toEqual(LOADOUT);
  });

  it('rejects a duplicate of another slot', () => {
    expect(replaceSkill(LOADOUT, 's-2', 's-5', SKILLS)).toBeNull();
  });

  it('rejects an unknown current or new skill id', () => {
    expect(replaceSkill(LOADOUT, 'not-in-loadout', 's-8', SKILLS)).toBeNull();
    expect(replaceSkill(LOADOUT, 's-2', 'not-real', SKILLS)).toBeNull();
  });
});

describe('weaponPickerOptions', () => {
  it('excludes the other slot but keeps the current slot selectable', () => {
    const options = weaponPickerOptions(LOADOUT, 1, WEAPONS);
    expect(options.map((w) => w.id)).toEqual(['w-1', 'w-3', 'w-4']);
  });
});

describe('skillPickerOptions', () => {
  it('excludes skills taken by other slots but keeps the current skill', () => {
    const options = skillPickerOptions(LOADOUT, 's-2', SKILLS);
    expect(options.map((s) => s.id)).toEqual(['s-2', 's-8', 's-9']);
  });
});
