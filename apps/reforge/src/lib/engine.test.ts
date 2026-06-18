import { createInitialNodes, currentNodes, goldPityColor, goldPityDistribution, isSoon, replay, rollableAfter } from '@/lib/engine';
import type { Milestone, MilestoneInput, NodeId, NodeSnapshot, RevertNodeInput } from '@/types/reforge';
import { describe, expect, it } from 'vitest';

// --- input builders (ids are irrelevant to replay, just unique) ---
let counter = 0;
const id = () => `m${counter++}`;
const roll = (rolls: number, goldHits: NodeId[] = []): MilestoneInput => ({ id: id(), type: 'roll', rolls, goldHits });
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

describe('unlock boundary (unlock roll counts as the first pity)', () => {
  it('enables Node 2 at exactly 24 rolls and gives it pity 1 (the unlock roll)', () => {
    const m = last(replay([roll(24)]));
    expect(nodeOf(m.nodes, 2).enabled).toBe(true);
    expect(nodeOf(m.nodes, 2).pity).toBe(1);
  });

  it('keeps accruing after the unlock roll', () => {
    // 24 to unlock (pity 1), then 10 more: Node 2 -> 11, Node 1 -> 34.
    const m = last(replay([roll(24), roll(10)]));
    expect(nodeOf(m.nodes, 2).pity).toBe(11);
    expect(nodeOf(m.nodes, 1).pity).toBe(34);
  });

  it('handles an unlock that happens mid-segment', () => {
    // One batch of 30 crosses Node 2's threshold (24): rolls 24..30 -> pity 7.
    const m = last(replay([roll(30)]));
    expect(nodeOf(m.nodes, 2).enabled).toBe(true);
    expect(nodeOf(m.nodes, 2).pity).toBe(7);
    expect(nodeOf(m.nodes, 1).pity).toBe(30);
  });

  it('lets a node that unlocks mid-batch be recorded as a gold hit', () => {
    // 30 rolls unlocks Node 2 (at 24) and it golds: pity-at-gold = rolls 24..30 = 7.
    const m = last(replay([roll(30, [2])]));
    expect(nodeOf(m.nodes, 2).tier).toBe('gold');
    expect(nodeOf(m.nodes, 2).pity).toBe(0);
    expect(m.goldPity?.[2]).toBe(7);
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
});

describe('Node 5 auto-gold', () => {
  it('is not enabled before 99 cumulative rolls', () => {
    expect(nodeOf(last(replay([roll(98)])).nodes, 5).enabled).toBe(false);
  });

  it('auto-golds at 99 with no pity', () => {
    const n5 = nodeOf(last(replay([roll(99)])).nodes, 5);
    expect(n5.enabled).toBe(true);
    expect(n5.tier).toBe('gold');
    expect(n5.pity).toBe(0);
  });
});

describe('rollableAfter', () => {
  it('includes nodes that unlock within the entered rolls', () => {
    const nodes = createInitialNodes(); // only Node 1 enabled at the start
    expect(rollableAfter(nodes, 0)).toEqual([1]);
    expect(rollableAfter(nodes, 24)).toEqual([1, 2]); // Node 2 unlocks at 24
    expect(rollableAfter(nodes, 70)).toEqual([1, 2, 3, 4]);
  });

  it('excludes locked nodes', () => {
    const nodes = createInitialNodes().map((n) => (n.id === 1 ? { ...n, locked: true } : n));
    expect(rollableAfter(nodes, 24)).toEqual([2]);
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
    // One batch of 30 golds Node 1 (pity 30 -> 26-30 bucket) and Node 2 (pity 7 -> 6-10).
    const dist = goldPityDistribution(replay([roll(30, [1, 2])]));
    expect(dist.total).toBe(2);
    expect(dist.buckets[1]).toMatchObject({ min: 6, max: 10, count: 1 });
    expect(dist.buckets[5]).toMatchObject({ min: 26, max: 30, count: 1 });
    // Node 5 auto-golds at 99 but contributes nothing to the distribution.
    expect(goldPityDistribution(replay([roll(99)])).total).toBe(0);
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
