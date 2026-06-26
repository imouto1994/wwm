import { replay } from '@/lib/engine';
import { synthesizeUnlocks } from '@/lib/migrate';
import type { Milestone, MilestoneInput, NodeId, NodeSnapshot } from '@/types/reforge';
import { describe, expect, it } from 'vitest';

// `synthesizeUnlocks` upgrades pre-manual-unlock inputs (no `unlock` milestones)
// by inserting the unlocks the old auto-unlock model left implicit, splitting
// roll batches at the legacy thresholds (Node 2 @ 24, 3 @ 40, 4 @ 70, 5 @ 99).

let counter = 0;
const mid = () => `m${counter++}`;
const roll = (rolls: number, goldHits: NodeId[] = []): MilestoneInput => ({ id: mid(), type: 'roll', rolls, goldHits });
const lock = (nodeId: NodeId, locked: boolean): MilestoneInput => ({ id: mid(), type: 'lock', nodeId, locked });

const nodeOf = (nodes: NodeSnapshot[], n: NodeId) => nodes.find((x) => x.id === n) as NodeSnapshot;
const last = (ms: Milestone[]) => ms[ms.length - 1];
// Compact, id-agnostic view of the synthesized inputs for structural assertions.
const shape = (inputs: MilestoneInput[]) =>
  inputs.map((i) =>
    i.type === 'roll'
      ? { type: i.type, rolls: i.rolls, goldHits: i.goldHits }
      : i.type === 'unlock'
        ? { type: i.type, nodeId: i.nodeId }
        : i.type === 'lock'
          ? { type: i.type, nodeId: i.nodeId, locked: i.locked }
          : { type: i.type, nodes: i.nodes }
  );

describe('synthesizeUnlocks - no-ops', () => {
  it('leaves a batch that crosses no threshold untouched', () => {
    const out = synthesizeUnlocks([roll(10)]);
    expect(shape(out)).toEqual([{ type: 'roll', rolls: 10, goldHits: [] }]);
  });

  it('is idempotent when unlock milestones already exist', () => {
    const inputs: MilestoneInput[] = [roll(24), { id: 'u', type: 'unlock', nodeId: 2 }, roll(6)];
    expect(synthesizeUnlocks(inputs)).toBe(inputs); // returned unchanged
  });

  it('passes non-roll milestones through', () => {
    const out = synthesizeUnlocks([roll(10), lock(1, true)]);
    expect(shape(out)).toEqual([
      { type: 'roll', rolls: 10, goldHits: [] },
      { type: 'lock', nodeId: 1, locked: true },
    ]);
  });
});

describe('synthesizeUnlocks - splitting and fidelity', () => {
  it('splits a batch at a single mid-batch crossing and reproduces the old pity', () => {
    const out = synthesizeUnlocks([roll(30)]);
    expect(shape(out)).toEqual([
      { type: 'roll', rolls: 24, goldHits: [] },
      { type: 'unlock', nodeId: 2 },
      { type: 'roll', rolls: 6, goldHits: [] },
    ]);
    const m = last(replay(out));
    expect(nodeOf(m.nodes, 1).pity).toBe(30);
    expect(nodeOf(m.nodes, 2).pity).toBe(7); // 1 (unlock) + 6, matches old engine
  });

  it('attaches the original golds to the final piece (gold after a mid-batch unlock)', () => {
    const out = synthesizeUnlocks([roll(30, [2])]);
    expect(shape(out)).toEqual([
      { type: 'roll', rolls: 24, goldHits: [] },
      { type: 'unlock', nodeId: 2 },
      { type: 'roll', rolls: 6, goldHits: [2] },
    ]);
    const m = last(replay(out));
    expect(nodeOf(m.nodes, 2).tier).toBe('gold');
    expect(m.goldPity?.[2]).toBe(7);
  });

  it('keeps an already-enabled node gold when the batch ends exactly on a threshold', () => {
    // 24 rolls land exactly on Node 2's threshold; Node 1 golded at pity 24.
    const out = synthesizeUnlocks([roll(24, [1])]);
    expect(shape(out)).toEqual([
      { type: 'roll', rolls: 24, goldHits: [1] },
      { type: 'unlock', nodeId: 2 },
    ]);
    const ms = replay(out);
    expect(ms[0].goldPity?.[1]).toBe(24); // the gold is recorded on the roll piece
    expect(nodeOf(last(ms).nodes, 1).tier).toBe('gold'); // and still held afterward
    expect(nodeOf(last(ms).nodes, 2).pity).toBe(1);
  });

  it('handles a batch crossing several thresholds at once', () => {
    const out = synthesizeUnlocks([roll(100)]);
    expect(shape(out)).toEqual([
      { type: 'roll', rolls: 24, goldHits: [] },
      { type: 'unlock', nodeId: 2 },
      { type: 'roll', rolls: 16, goldHits: [] },
      { type: 'unlock', nodeId: 3 },
      { type: 'roll', rolls: 30, goldHits: [] },
      { type: 'unlock', nodeId: 4 },
      { type: 'roll', rolls: 29, goldHits: [] },
      { type: 'unlock', nodeId: 5 },
      { type: 'roll', rolls: 1, goldHits: [] },
    ]);
    const m = last(replay(out));
    expect(m.cumulativeRolls).toBe(100);
    expect(nodeOf(m.nodes, 5).tier).toBe('gold'); // Misc auto-gold once unlocked
    expect(nodeOf(m.nodes, 4).pity).toBe(31); // 1 (unlock at 70) + 30 remaining
  });

  it('preserves totals across multiple batches', () => {
    const out = synthesizeUnlocks([roll(20), roll(30, [1]), roll(25)]);
    const m = last(replay(out));
    expect(m.cumulativeRolls).toBe(75); // 20 + 30 + 25, unchanged by splitting
  });
});

describe('synthesizeUnlocks - documented edge', () => {
  it('drops a gold for a node that unlocked on the exact final roll', () => {
    // 24 rolls land exactly on Node 2 and the batch claims Node 2 golded - Node 2
    // is not enabled during the (only) roll piece, so that single gold is lost.
    const out = synthesizeUnlocks([roll(24, [2])]);
    const m = last(replay(out));
    expect(nodeOf(m.nodes, 2).tier).toBeNull();
    expect(nodeOf(m.nodes, 2).pity).toBe(1); // still correctly unlocked
  });
});
