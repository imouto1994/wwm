import { EXPORT_TYPE, EXPORT_VERSION, exportFileName, parseSessionExport, sanitizeMilestoneInputs, serializeSession } from '@/lib/sessionIo';
import type { MilestoneInput, Session } from '@/types/reforge';
import { describe, expect, it } from 'vitest';

// Inputs get fresh ids on sanitize/import, so compare everything except the id.
const withoutIds = (inputs: MilestoneInput[]) => inputs.map((i) => ({ ...i, id: '' }));

const FIXED = new Date('2026-06-17T10:00:00Z');

describe('serializeSession <-> parseSessionExport', () => {
  it('round-trips name and inputs (ids aside)', () => {
    const session: Session = {
      id: 'sess-1',
      name: 'My Session',
      inputs: [
        { id: 'a', type: 'roll', rolls: 20, goldHits: [1] },
        { id: 'd', type: 'unlock', nodeId: 2 },
        { id: 'b', type: 'lock', nodeId: 1, locked: true },
        { id: 'c', type: 'revert', nodes: [{ id: 1, gold: true, locked: false }] },
      ],
    };
    const result = parseSessionExport(serializeSession(session, FIXED));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.name).toBe('My Session');
      expect(withoutIds(result.inputs)).toEqual(withoutIds(session.inputs));
    }
  });

  it('omits the session id from the export envelope', () => {
    const json = serializeSession({ id: 'secret', name: 'X', inputs: [] }, FIXED);
    const envelope = JSON.parse(json);
    expect(envelope).toMatchObject({ type: EXPORT_TYPE, exportVersion: EXPORT_VERSION, name: 'X', inputs: [] });
    expect(envelope.id).toBeUndefined();
    expect(envelope.exportedAt).toBe(FIXED.toISOString());
  });
});

describe('parseSessionExport - rejections', () => {
  it('rejects non-JSON text', () => {
    const r = parseSessionExport('not json {');
    expect(r.ok).toBe(false);
  });

  it('rejects valid JSON that is not an object', () => {
    expect(parseSessionExport('null').ok).toBe(false);
    expect(parseSessionExport('5').ok).toBe(false);
    expect(parseSessionExport('"hi"').ok).toBe(false);
  });

  it('rejects a wrong or missing type marker', () => {
    expect(parseSessionExport(JSON.stringify({ type: 'other', exportVersion: 1, name: 'x', inputs: [] })).ok).toBe(false);
    expect(parseSessionExport(JSON.stringify({ exportVersion: 1, name: 'x', inputs: [] })).ok).toBe(false);
  });

  it('rejects an unsupported export version (newer than we understand, or not a number)', () => {
    expect(parseSessionExport(JSON.stringify({ type: EXPORT_TYPE, exportVersion: 3, name: 'x', inputs: [] })).ok).toBe(false);
    expect(parseSessionExport(JSON.stringify({ type: EXPORT_TYPE, exportVersion: 0, name: 'x', inputs: [] })).ok).toBe(false);
    expect(parseSessionExport(JSON.stringify({ type: EXPORT_TYPE, name: 'x', inputs: [] })).ok).toBe(false);
  });
});

describe('parseSessionExport - version migration', () => {
  it('accepts a current (v2) file without synthesizing unlocks', () => {
    const r = parseSessionExport(JSON.stringify({ type: EXPORT_TYPE, exportVersion: 2, name: 'new', inputs: [{ type: 'roll', rolls: 30, goldHits: [] }] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.inputs.map((i) => i.type)).toEqual(['roll']);
  });

  it('accepts a legacy (v1) file and synthesizes its missing unlocks', () => {
    const r = parseSessionExport(JSON.stringify({ type: EXPORT_TYPE, exportVersion: 1, name: 'old', inputs: [{ type: 'roll', rolls: 30, goldHits: [] }] }));
    expect(r.ok).toBe(true);
    // 30 rolls crossed Node 2's legacy threshold (24), so it is split around an unlock.
    if (r.ok) expect(r.inputs.map((i) => i.type)).toEqual(['roll', 'unlock', 'roll']);
  });
});

describe('parseSessionExport - lenient fields', () => {
  it('returns an empty name when missing/blank (the hook supplies the default)', () => {
    const r = parseSessionExport(JSON.stringify({ type: EXPORT_TYPE, exportVersion: EXPORT_VERSION, inputs: [] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.name).toBe('');
  });

  it('treats missing inputs as an empty session', () => {
    const r = parseSessionExport(JSON.stringify({ type: EXPORT_TYPE, exportVersion: EXPORT_VERSION, name: 'x' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.inputs).toEqual([]);
  });
});

describe('sanitizeMilestoneInputs', () => {
  it('keeps valid inputs and assigns fresh, unique ids', () => {
    const out = sanitizeMilestoneInputs([
      { id: 'x', type: 'roll', rolls: 10, goldHits: [1, 2] },
      { type: 'lock', nodeId: 3, locked: true },
      { type: 'revert', nodes: [{ id: 1, gold: true, locked: false }] },
    ]);
    expect(out).toHaveLength(3);
    expect(out.every((i) => typeof i.id === 'string' && i.id.length > 0)).toBe(true);
    expect(new Set(out.map((i) => i.id)).size).toBe(3);
  });

  it('coerces legacy object goldHits and drops out-of-range / Node 5 ids', () => {
    const out = sanitizeMilestoneInputs([{ type: 'roll', rolls: 5, goldHits: [{ id: 1 }, 2, 5, 9, 'x'] }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'roll', rolls: 5, goldHits: [1, 2] });
  });

  it('drops unknown types, invalid rolls, and bad locks', () => {
    const out = sanitizeMilestoneInputs([
      { type: 'roll', rolls: 0, goldHits: [] },
      { type: 'roll', rolls: -3, goldHits: [] },
      { type: 'roll', rolls: 2.5, goldHits: [] },
      { type: 'mystery' },
      null,
      5,
      { type: 'lock', nodeId: 5, locked: true },
      { type: 'lock', nodeId: 2, locked: 'yes' },
    ]);
    expect(out).toHaveLength(0);
  });

  it('keeps unlock milestones (including Node 5) and drops ones with a bad node id', () => {
    const out = sanitizeMilestoneInputs([
      { type: 'unlock', nodeId: 2 },
      { type: 'unlock', nodeId: 5 }, // Misc is unlockable, unlike lock/revert
      { type: 'unlock', nodeId: 9 },
      { type: 'unlock', nodeId: 'x' },
      { type: 'unlock' },
    ]);
    expect(out.map((i) => (i.type === 'unlock' ? i.nodeId : null))).toEqual([2, 5]);
  });

  it('filters revert nodes to valid rollable entries', () => {
    const out = sanitizeMilestoneInputs([
      {
        type: 'revert',
        nodes: [{ id: 1, gold: true, locked: false }, { id: 5, gold: true, locked: true }, { id: 2, gold: 'x', locked: false }, null],
      },
    ]);
    expect(out).toHaveLength(1);
    if (out[0].type === 'revert') expect(out[0].nodes).toEqual([{ id: 1, gold: true, locked: false }]);
  });

  it('returns an empty array for non-array input', () => {
    expect(sanitizeMilestoneInputs('nope')).toEqual([]);
    expect(sanitizeMilestoneInputs(null)).toEqual([]);
  });
});

describe('exportFileName', () => {
  it('slugs the name and appends the date', () => {
    expect(exportFileName('Session 1', FIXED)).toBe('reforge-session-1-2026-06-17.json');
  });

  it('falls back to "session" for empty or non-ASCII names', () => {
    expect(exportFileName('   ', FIXED)).toBe('reforge-session-2026-06-17.json');
    expect(exportFileName('日本語', FIXED)).toBe('reforge-session-2026-06-17.json');
  });
});
