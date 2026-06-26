import { createInitialNodes, currentNodes, goldPityColor, goldPityDistribution, isSoon, nextUnlockableNodeId, replay, rollableNodes } from '@/lib/engine';
import type { Milestone, MilestoneInput, NodeId, NodeSnapshot, RevertNodeInput } from '@/types/reforge';
import { describe, expect, it } from 'vitest';

// --- input builders (ids are irrelevant to replay, just unique) ---
let counter = 0;
const id = () => `m${counter++}`;
const roll = (rolls: number, goldHits: NodeId[] = []): MilestoneInput => ({ id: id(), type: 'roll', rolls, goldHits });
const unlock = (nodeId: NodeId): MilestoneInput => ({ id: id(), type: 'unlock', nodeId });
const lock = (nodeId: NodeId, locked: boolean): MilestoneInput => ({ id: id(), type: 'lock', nodeId, locked });
const revert = (nodes: RevertNodeInput[]): MilestoneInput => ({ id: id(), type: 'revert', nodes });

const nodeOf = (nodes: NodeSnapshot[], n: NodeId) => nodes.find((x) => x.id === n) as NodeSnapshot;
const last = (ms: Milestone[]) => ms[ms.length - 1];

describe('createInitialNodes', () => {
  it('enables only Node 1 and starts everything at pity 0', () => {
    const nodes = createInitialNodes();
    expect(nodeOf(nodes, 1).enabled).toBe(true);
    expect(nodeOf(nodes, 2).enabled).toBe(false);
    expect(nodes.every((n) => n.pity === 0 && n.tier === null && !n.locked)).toBe(true);
  });
});

describe('replay - rolls, pity and gold', () => {
  it('returns nothing for an empty session and falls back to initial nodes', () => {
    expect(replay([])).toEqual([]);
    expect(nodeOf(currentNodes([]), 1).enabled).toBe(true);
  });

  it('advances Node 1 pity and charges 1 stone/roll with nothing locked', () => {
    const m = last(replay([roll(10)]));
    expect(nodeOf(m.nodes, 1).pity).toBe(10);
    expect(m.cumulativeRolls).toBe(10);
    expect(m.stones).toBe(10);
  });

  it('records pity-at-gold and resets pity on a gold hit', () => {
    const m = last(replay([roll(20, [1])]));
    expect(nodeOf(m.nodes, 1).tier).toBe('gold');
    expect(nodeOf(m.nodes, 1).pity).toBe(0);
    expect(m.goldPity?.[1]).toBe(20);
  });
});

describe('manual unlock (unlock roll counts as the first pity)', () => {
  it('does NOT auto-enable a node from roll count alone', () => {
    // No more threshold-based unlocking: 30 rolls leaves Node 2 disabled.
    const m = last(replay([roll(30)]));
    expect(nodeOf(m.nodes, 2).enabled).toBe(false);
    expect(nodeOf(m.nodes, 1).pity).toBe(30);
  });

  it('enables a node at pity 1 when an unlock milestone is recorded', () => {
    const m = last(replay([roll(24), unlock(2)]));
    expect(nodeOf(m.nodes, 2).enabled).toBe(true);
    expect(nodeOf(m.nodes, 2).pity).toBe(1);
    expect(nodeOf(m.nodes, 1).pity).toBe(24); // unchanged by the unlock
  });

  it('accrues pity on rolls after the unlock', () => {
    // unlock (pity 1) then 10 more: Node 2 -> 11, Node 1 -> 34.
    const m = last(replay([roll(24), unlock(2), roll(10)]));
    expect(nodeOf(m.nodes, 2).pity).toBe(11);
    expect(nodeOf(m.nodes, 1).pity).toBe(34);
  });

  it('lets a freshly unlocked node be recorded as a gold hit on a later roll', () => {
    // unlock (pity 1), then 6 rolls and it golds: pity-at-gold = 7.
    const m = last(replay([roll(24), unlock(2), roll(6, [2])]));
    expect(nodeOf(m.nodes, 2).tier).toBe('gold');
    expect(nodeOf(m.nodes, 2).pity).toBe(0);
    expect(m.goldPity?.[2]).toBe(7);
  });

  it('is idempotent: re-unlocking an enabled node does not reset its pity', () => {
    const m = last(replay([roll(24), unlock(2), roll(5), unlock(2)]));
    expect(nodeOf(m.nodes, 2).pity).toBe(6); // 1 (unlock) + 5, not reset to 1
  });

  it('does not accrue pity for a still-locked (disabled) node', () => {
    const m = last(replay([roll(50)]));
    expect(nodeOf(m.nodes, 3).enabled).toBe(false);
    expect(nodeOf(m.nodes, 3).pity).toBe(0);
  });
});

describe('re-rolling a gold node', () => {
  it('clears the gold when an UNLOCKED gold node is re-rolled', () => {
    const ms = replay([roll(20, [1]), roll(5)]);
    const n1 = nodeOf(last(ms).nodes, 1);
    expect(n1.tier).toBeNull(); // gold gambled away
    expect(n1.pity).toBe(5); // pity climbs from 0 again
  });

  it('keeps the gold when the node is LOCKED before re-rolling', () => {
    const ms = replay([roll(20, [1]), lock(1, true), roll(5)]);
    const n1 = nodeOf(last(ms).nodes, 1);
    expect(n1.tier).toBe('gold');
    expect(n1.pity).toBe(0); // frozen while locked
  });
});

describe('locks: cost and frozen pity', () => {
  it('raises cost to 2/roll and freezes pity for a locked node', () => {
    const ms = replay([roll(10), lock(1, true), roll(5)]);
    const lockSegment = ms[2];
    expect(lockSegment.stones).toBe(10); // 5 rolls * 2 stones
    expect(lockSegment.cumulativeStones).toBe(20);
    expect(nodeOf(lockSegment.nodes, 1).pity).toBe(10); // frozen while locked
  });
});

describe('revert', () => {
  it('zeroes all pity but keeps cumulative rolls and stones', () => {
    const ms = replay([roll(30), revert([{ id: 1, gold: false, locked: false }])]);
    const reverted = last(ms);
    expect(nodeOf(reverted.nodes, 1).pity).toBe(0);
    expect(nodeOf(reverted.nodes, 1).tier).toBeNull();
    expect(reverted.cumulativeRolls).toBe(30); // unlocks/rolls are permanent
    expect(reverted.stones).toBe(0); // no stones for the revert itself
    expect(reverted.cumulativeStones).toBe(30); // earlier rolls not refunded
  });

  it('can set a node gold + locked', () => {
    const ms = replay([roll(30), revert([{ id: 1, gold: true, locked: true }])]);
    const n1 = nodeOf(last(ms).nodes, 1);
    expect(n1.tier).toBe('gold');
    expect(n1.locked).toBe(true);
  });

  it('keeps a node enabled (unlocks are permanent) through a revert', () => {
    const n2 = nodeOf(last(replay([roll(24), unlock(2), revert([{ id: 2, gold: false, locked: false }])])).nodes, 2);
    expect(n2.enabled).toBe(true);
    expect(n2.pity).toBe(0);
  });
});

describe('Node 5 (Misc) manual unlock', () => {
  it('stays disabled no matter how many rolls without an unlock milestone', () => {
    expect(nodeOf(last(replay([roll(120)])).nodes, 5).enabled).toBe(false);
  });

  it('turns gold with no pity when unlocked', () => {
    const n5 = nodeOf(last(replay([roll(99), unlock(5)])).nodes, 5);
    expect(n5.enabled).toBe(true);
    expect(n5.tier).toBe('gold');
    expect(n5.pity).toBe(0);
  });
});

describe('rollableNodes', () => {
  it('returns only enabled, unlocked rollable nodes', () => {
    expect(rollableNodes(createInitialNodes())).toEqual([1]); // only Node 1 enabled
    expect(rollableNodes(currentNodes(replay([roll(24), unlock(2)])))).toEqual([1, 2]);
    expect(rollableNodes(currentNodes(replay([unlock(2), unlock(3), unlock(4)])))).toEqual([1, 2, 3, 4]);
  });

  it('excludes locked nodes', () => {
    const nodes = createInitialNodes().map((n) => (n.id === 1 ? { ...n, locked: true } : n));
    expect(rollableNodes(nodes)).toEqual([]);
  });
});

describe('nextUnlockableNodeId (sequential gating)', () => {
  it('points at the lowest not-yet-enabled node and is null when all are enabled', () => {
    expect(nextUnlockableNodeId(createInitialNodes())).toBe(2);
    expect(nextUnlockableNodeId(currentNodes(replay([unlock(2)])))).toBe(3);
    expect(nextUnlockableNodeId(currentNodes(replay([unlock(2), unlock(3), unlock(4), unlock(5)])))).toBeNull();
  });
});

describe('goldPityColor', () => {
  it('maps pity-at-gold to luck colors at the inclusive 30/50 thresholds', () => {
    expect(goldPityColor(1)).toBe('green');
    expect(goldPityColor(30)).toBe('green');
    expect(goldPityColor(31)).toBe('yellow');
    expect(goldPityColor(50)).toBe('yellow');
    expect(goldPityColor(51)).toBe('red');
    expect(goldPityColor(90)).toBe('red');
  });
});

describe('goldPityDistribution', () => {
  it('returns 18 zeroed size-5 buckets (1..90) and total 0 for no golds', () => {
    const empty = goldPityDistribution([]);
    expect(empty.total).toBe(0);
    expect(empty.buckets).toHaveLength(18);
    expect(empty.buckets[0]).toMatchObject({ min: 1, max: 5 });
    expect(empty.buckets[17]).toMatchObject({ min: 86, max: 90 });
    expect(goldPityDistribution(replay([roll(10)])).total).toBe(0); // rolls, no golds
  });

  it('buckets a gold by its pity-at-gold, with 5 and 6 on either side of a boundary', () => {
    const atFive = goldPityDistribution(replay([roll(5, [1])]));
    expect(atFive.total).toBe(1);
    expect(atFive.buckets[0]).toMatchObject({ min: 1, max: 5, count: 1 });

    const atSix = goldPityDistribution(replay([roll(6, [1])]));
    expect(atSix.buckets[0].count).toBe(0);
    expect(atSix.buckets[1]).toMatchObject({ min: 6, max: 10, count: 1 });
  });

  it('sums multiple golds that fall in the same range', () => {
    // Node 1 golds at pity 3, then is re-rolled and golds again at pity 4 - both in 1-5.
    const dist = goldPityDistribution(replay([roll(3, [1]), roll(4, [1])]));
    expect(dist.total).toBe(2);
    expect(dist.buckets[0].count).toBe(2);
  });

  it('pools golds across nodes and ignores Node 5 (auto-gold, no pity)', () => {
    // Node 1 golds at pity 30 (26-30 bucket); Node 2, unlocked then rolled 6, golds
    // at pity 7 (6-10 bucket).
    const dist = goldPityDistribution(replay([roll(24), unlock(2), roll(6, [1, 2])]));
    expect(dist.total).toBe(2);
    expect(dist.buckets[1]).toMatchObject({ min: 6, max: 10, count: 1 });
    expect(dist.buckets[5]).toMatchObject({ min: 26, max: 30, count: 1 });
    // Node 5 golds on unlock but has no pity, so it contributes nothing.
    expect(goldPityDistribution(replay([roll(99), unlock(5)])).total).toBe(0);
  });
});

describe('isSoon', () => {
  const n = (overrides: Partial<NodeSnapshot>): NodeSnapshot => ({
    id: 2,
    enabled: true,
    locked: false,
    pity: 30,
    tier: null,
    ...overrides,
  });

  it('is true for an active node at/over the soft-pity floor', () => {
    expect(isSoon(n({ pity: 30 }))).toBe(true);
    expect(isSoon(n({ pity: 29 }))).toBe(false);
  });

  it('is false when locked, gold, or Node 5', () => {
    expect(isSoon(n({ locked: true }))).toBe(false);
    expect(isSoon(n({ tier: 'gold' }))).toBe(false);
    expect(isSoon(n({ id: 5 }))).toBe(false);
  });
});

describe('edit/delete latest via re-replay', () => {
  it('deleting the latest input is just replaying the shorter list', () => {
    const inputs = [roll(10), roll(10, [1])];
    const full = replay(inputs);
    const afterDelete = replay(inputs.slice(0, -1));
    expect(full).toHaveLength(2);
    expect(afterDelete).toHaveLength(1);
    expect(nodeOf(last(afterDelete).nodes, 1).pity).toBe(10);
  });

  it('editing the latest input changes only the derived tail', () => {
    const edited = last(replay([roll(10), roll(40, [])]));
    expect(nodeOf(edited.nodes, 1).pity).toBe(50);
  });
});
