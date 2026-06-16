import { nextSessionName } from '@/hooks/useReforgeSession';
import type { Session } from '@/types/reforge';
import { describe, expect, it } from 'vitest';

const session = (name: string): Session => ({ id: name, name, inputs: [] });

describe('nextSessionName', () => {
  it('starts at "Session 1" for an empty list', () => {
    expect(nextSessionName([])).toBe('Session 1');
  });

  it('uses one past the highest existing number, not the count', () => {
    // Length-based naming would collide here; this skips to 4.
    expect(nextSessionName([session('Session 3'), session('My weapon')])).toBe('Session 4');
  });

  it('ignores custom names when finding the next number', () => {
    expect(nextSessionName([session('Alpha'), session('Beta')])).toBe('Session 1');
  });
});
