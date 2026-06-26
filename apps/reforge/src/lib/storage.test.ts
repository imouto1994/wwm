import { coerceState } from '@/lib/storage';
import { describe, expect, it } from 'vitest';

// `coerceState` is the pure, window-free core of persistence: it migrates the
// legacy v2 and pre-manual-unlock v3 shapes, repairs/drops malformed entries, and
// always yields a valid state with at least one session and a resolvable
// activeSessionId.

describe('coerceState - v2 -> v4 migration', () => {
  it('wraps a v2 single-session payload into one active session', () => {
    const state = coerceState({ version: 2, inputs: [{ id: 'm1', type: 'roll', rolls: 10, goldHits: [] }] });
    expect(state.version).toBe(4);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].name).toBe('Session 1');
    expect(state.sessions[0].inputs).toHaveLength(1);
    expect(state.activeSessionId).toBe(state.sessions[0].id);
  });

  it('coerces legacy object-shaped goldHits to plain node ids during migration', () => {
    const state = coerceState({
      version: 2,
      inputs: [{ id: 'm1', type: 'roll', rolls: 20, goldHits: [{ id: 1, variant: 'A' }, 2] }],
    });
    expect(state.sessions[0].inputs[0]).toMatchObject({ type: 'roll', rolls: 20, goldHits: [1, 2] });
  });

  it('migrates a v2 payload with missing/invalid inputs to an empty session', () => {
    const state = coerceState({ version: 2 });
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].inputs).toEqual([]);
  });
});

describe('coerceState - v3 -> v4 migration', () => {
  it('upgrades a well-formed v3 payload to v4, synthesizing no unlocks when none are needed', () => {
    const payload = {
      version: 3 as const,
      sessions: [
        { id: 's1', name: 'Alpha', inputs: [] },
        { id: 's2', name: 'Beta', inputs: [{ id: 'm', type: 'lock', nodeId: 1, locked: true }] },
      ],
      activeSessionId: 's2',
    };
    // No roll crosses a threshold, so only the version changes.
    expect(coerceState(payload)).toEqual({ ...payload, version: 4 });
  });

  it('synthesizes unlock milestones where a v3 session crossed the legacy thresholds', () => {
    const state = coerceState({
      version: 3,
      sessions: [{ id: 's1', name: 'A', inputs: [{ id: 'm1', type: 'roll', rolls: 30, goldHits: [] }] }],
      activeSessionId: 's1',
    });
    expect(state.version).toBe(4);
    const types = state.sessions[0].inputs.map((i) => i.type);
    expect(types).toEqual(['roll', 'unlock', 'roll']); // 30 rolls split at Node 2's threshold (24)
  });
});

describe('coerceState - v4 happy path', () => {
  it('round-trips a well-formed v4 payload unchanged (no re-synthesis)', () => {
    const payload = {
      version: 4 as const,
      sessions: [
        { id: 's1', name: 'Alpha', inputs: [{ id: 'u', type: 'unlock', nodeId: 2 }] },
        { id: 's2', name: 'Beta', inputs: [{ id: 'm', type: 'lock', nodeId: 1, locked: true }] },
      ],
      activeSessionId: 's2',
    };
    expect(coerceState(payload)).toEqual(payload);
  });
});

describe('coerceState - v3 repairs and fallbacks', () => {
  it('falls back to the first session when activeSessionId is dangling', () => {
    const state = coerceState({ version: 3, sessions: [{ id: 's1', name: 'A', inputs: [] }], activeSessionId: 'gone' });
    expect(state.activeSessionId).toBe('s1');
  });

  it('treats an empty sessions array as a fresh default session', () => {
    const state = coerceState({ version: 3, sessions: [], activeSessionId: 'x' });
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].name).toBe('Session 1');
    expect(state.activeSessionId).toBe(state.sessions[0].id);
  });

  it('repairs sessions missing an id or name (by position)', () => {
    const state = coerceState({
      version: 3,
      sessions: [{ inputs: [] }, { id: 's2', name: '   ', inputs: [] }],
      activeSessionId: 'whatever',
    });
    expect(state.sessions).toHaveLength(2);
    expect(state.sessions[0].id).toBeTruthy();
    expect(state.sessions[0].name).toBe('Session 1');
    expect(state.sessions[1].name).toBe('Session 2');
    expect(state.activeSessionId).toBe(state.sessions[0].id);
  });

  it('drops non-object session entries but keeps the valid ones', () => {
    const state = coerceState({ version: 3, sessions: [null, 5, 'x', { id: 'ok', name: 'Keep', inputs: [] }], activeSessionId: 'ok' });
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].name).toBe('Keep');
    expect(state.activeSessionId).toBe('ok');
  });

  it('falls back to a default when no session entry is salvageable', () => {
    const state = coerceState({ version: 3, sessions: [null, 1, 'x'], activeSessionId: 'a' });
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].name).toBe('Session 1');
  });

  it('de-duplicates colliding session ids', () => {
    const state = coerceState({
      version: 3,
      sessions: [
        { id: 'dup', name: 'A', inputs: [] },
        { id: 'dup', name: 'B', inputs: [] },
      ],
      activeSessionId: 'dup',
    });
    expect(state.sessions).toHaveLength(2);
    expect(new Set(state.sessions.map((s) => s.id)).size).toBe(2);
    // The first session keeps the original id, so the active reference still resolves.
    expect(state.activeSessionId).toBe(state.sessions[0].id);
  });
});

describe('coerceState - malformed and unknown payloads', () => {
  const cases: unknown[] = [null, undefined, 42, 'str', [], {}, { version: 1, inputs: [] }, { version: 99 }, { inputs: [] }];

  for (const bad of cases) {
    it(`resets to a single default session for ${JSON.stringify(bad)}`, () => {
      const state = coerceState(bad);
      expect(state.version).toBe(4);
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].name).toBe('Session 1');
      expect(state.sessions[0].inputs).toEqual([]);
      expect(state.activeSessionId).toBe(state.sessions[0].id);
    });
  }
});
