import type { NodeId } from '@/types/reforge';

export const NODE_IDS: NodeId[] = [1, 2, 3, 4, 5];

// Node 5 is auto-gold/derived and is never rolled or locked.
export const AUTO_GOLD_NODE: NodeId = 5;
export const ROLLABLE_NODE_IDS: NodeId[] = [1, 2, 3, 4];

export const NODE_LABELS: Record<NodeId, string> = {
  1: 'Color',
  2: 'Part 1',
  3: 'Part 2',
  4: 'Part 3',
  5: 'Misc',
};

export const NODE_DESCRIPTIONS: Record<NodeId, string> = {
  1: 'Weapon color',
  2: '1st part of the weapon',
  3: '2nd part of the weapon',
  4: '3rd part of the weapon',
  5: 'Auto-gold once unlocked; follows the other nodes',
};

// Nodes that are unlocked from the very start of a session. Only the Color node
// (Node 1) is available before any rolls; the rest unlock via `unlock` milestones.
export const INITIALLY_ENABLED_NODE_IDS: NodeId[] = [1];

// Legacy per-node unlock thresholds (total rolls). These are NO LONGER used for
// live behavior: we learned the totals differ per weapon, so unlocking is now a
// manual milestone. Kept solely to migrate pre-manual sessions/exports - we
// synthesize `unlock` milestones where a session's rolls crossed these totals.
// See lib/migrate.ts.
export const LEGACY_UNLOCK_ROLLS: Record<NodeId, number> = {
  1: 0,
  2: 24,
  3: 40,
  4: 70,
  5: 99,
};

// Stone cost per roll, keyed by number of locked rollable nodes.
// Only nodes 1-4 are rollable/lockable, so the max while rolling is 3.
export const ROLL_COST_BY_LOCKED: Record<number, number> = {
  0: 1,
  1: 2,
  2: 5,
  3: 10,
};

// Observed soft-pity window and the guaranteed hard pity.
export const SOFT_PITY = { min: 30, max: 40 };
export const HARD_PITY = 90;

// Gold-luck cell coloring by how many rolls a node took to turn gold (its
// pity-at-gold). Bounds are inclusive: at/below `green` is lucky, at/below
// `yellow` is average, above `yellow` is unlucky. 30/50 line up with the
// size-5 GoldStats bucket edges.
export const GOLD_LUCK = { green: 30, yellow: 50 };

// A node is flagged "about to pop" once its pity reaches this (soft-pity floor).
export const SOON_PITY = SOFT_PITY.min;

// Width of each pity range in the gold-luck distribution stats. Gold hits are
// pooled into fixed buckets (1-5, 6-10, ... up to HARD_PITY) so players can see
// where their golds tend to land relative to the soft-pity window.
export const GOLD_BUCKET_SIZE = 5;
