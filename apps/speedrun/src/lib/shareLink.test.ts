import { buildShareUrl, decodeLoadout, encodeLoadout } from '@/lib/shareLink';
import type { LoadoutResult, SkillEntry, WeaponEntry } from '@/types/randomizer';
import { describe, expect, it } from 'vitest';

function weapon(id: string): WeaponEntry {
  return { id, name: id, image: `/images/weapons/${id}.svg`, isDps: true };
}

function skill(id: string): SkillEntry {
  return { id, name: id, image: `/images/skills/${id}.svg` };
}

const WEAPONS: WeaponEntry[] = [weapon('w-1'), weapon('w-2'), weapon('w-3')];
const SKILLS: SkillEntry[] = Array.from({ length: 10 }, (_, i) => skill(`s-${i}`));

const LOADOUT: LoadoutResult = {
  weapon1Id: 'w-1',
  weapon2Id: 'w-2',
  skillIds: ['s-0', 's-1', 's-2', 's-3', 's-4', 's-5', 's-6', 's-7'],
};

describe('encodeLoadout / decodeLoadout round-trip', () => {
  it('decodes exactly what was encoded', () => {
    const params = encodeLoadout(LOADOUT);
    expect(decodeLoadout(params, WEAPONS, SKILLS)).toEqual(LOADOUT);
  });
});

describe('decodeLoadout invalid inputs', () => {
  it('returns null when a param is missing', () => {
    const params = encodeLoadout(LOADOUT);
    params.delete('w2');
    expect(decodeLoadout(params, WEAPONS, SKILLS)).toBeNull();
  });

  it('returns null when there are not exactly 8 skill ids', () => {
    const params = encodeLoadout({ ...LOADOUT, skillIds: LOADOUT.skillIds.slice(0, 7) });
    expect(decodeLoadout(params, WEAPONS, SKILLS)).toBeNull();
  });

  it('returns null when the skill list has a duplicate id', () => {
    const params = encodeLoadout({ ...LOADOUT, skillIds: ['s-0', 's-0', 's-1', 's-2', 's-3', 's-4', 's-5', 's-6'] });
    expect(decodeLoadout(params, WEAPONS, SKILLS)).toBeNull();
  });

  it('returns null when a skill id does not exist in the pool', () => {
    const params = encodeLoadout({ ...LOADOUT, skillIds: ['s-0', 's-1', 's-2', 's-3', 's-4', 's-5', 's-6', 'not-a-real-skill'] });
    expect(decodeLoadout(params, WEAPONS, SKILLS)).toBeNull();
  });

  it('returns null when a weapon id does not exist in the pool', () => {
    const params = encodeLoadout({ ...LOADOUT, weapon1Id: 'not-a-real-weapon' });
    expect(decodeLoadout(params, WEAPONS, SKILLS)).toBeNull();
  });

  it('returns null when weapon1 and weapon2 are the same', () => {
    const params = encodeLoadout({ ...LOADOUT, weapon2Id: LOADOUT.weapon1Id });
    expect(decodeLoadout(params, WEAPONS, SKILLS)).toBeNull();
  });

  it('returns null for an empty params object', () => {
    expect(decodeLoadout(new URLSearchParams(), WEAPONS, SKILLS)).toBeNull();
  });
});

describe('buildShareUrl', () => {
  it('builds a full, absolute, pasteable URL', () => {
    const url = buildShareUrl(LOADOUT, 'https://speedrun.example.com', '/');
    expect(url).toBe('https://speedrun.example.com/?w1=w-1&w2=w-2&s=s-0%2Cs-1%2Cs-2%2Cs-3%2Cs-4%2Cs-5%2Cs-6%2Cs-7');
    const params = new URL(url).searchParams;
    expect(decodeLoadout(params, WEAPONS, SKILLS)).toEqual(LOADOUT);
  });
});
