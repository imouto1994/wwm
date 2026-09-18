import { SKILLS } from '@/data/skills';
import { WEAPONS } from '@/data/weapons';
import { describe, expect, it } from 'vitest';

/**
 * Guards the hand-maintained data pools (src/data/weapons.ts, src/data/skills.ts)
 * against mistakes that would silently break URL decoding or the randomizer:
 * a duplicate/blank id, a missing name/image, or an empty DPS pool. Anyone
 * adding a new weapon or skill gets a fast, clear failure here instead of a
 * confusing runtime bug during the event.
 */
describe('WEAPONS pool', () => {
  it('has every entry with a non-empty id, name, and image', () => {
    for (const weapon of WEAPONS) {
      expect(weapon.id.trim()).not.toBe('');
      expect(weapon.name.trim()).not.toBe('');
      expect(weapon.image.trim()).not.toBe('');
    }
  });

  it('has unique ids', () => {
    const ids = WEAPONS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least one DPS weapon and at least 2 weapons total', () => {
    expect(WEAPONS.length).toBeGreaterThanOrEqual(2);
    expect(WEAPONS.some((w) => w.isDps)).toBe(true);
  });
});

describe('SKILLS pool', () => {
  it('has every entry with a non-empty id, name, and image', () => {
    for (const skill of SKILLS) {
      expect(skill.id.trim()).not.toBe('');
      expect(skill.name.trim()).not.toBe('');
      expect(skill.image.trim()).not.toBe('');
    }
  });

  it('has unique ids', () => {
    const ids = SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least 8 entries (the randomizer draws 8 unique skills)', () => {
    expect(SKILLS.length).toBeGreaterThanOrEqual(8);
  });
});
