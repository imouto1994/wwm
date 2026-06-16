/**
 * Domain types for the milestone-based reforge pity tracker.
 *
 * The session is stored as an ordered list of `MilestoneInput`s. The full
 * per-node status table is *derived* by replaying those inputs (see
 * `engine.ts#replay`). Nothing computed (pity, stones, snapshots) is persisted
 * - only the inputs - so the table is always a pure function of the inputs and
 * editing/deleting the latest milestone is just a list mutation + re-replay.
 *
 * This is a *pure pity tracker*: it records which nodes turned gold and how many
 * rolls that took, but it does NOT track which gold variant (Set A / Set B /
 * unique color) a node landed on - that is cosmetic and irrelevant to pity.
 */

export type NodeId = 1 | 2 | 3 | 4 | 5;

export type Tier = 'blue' | 'purple' | 'gold';

/**
 * The full state of a single node at a point in time. This is *derived* output
 * (produced by replay), never authored directly except via the revert input.
 */
export interface NodeSnapshot {
  id: NodeId;
  // Whether the node has been unlocked yet. Derived from cumulative rolls vs the
  // unlock threshold; once true it stays true (unlocks are permanent in-game).
  enabled: boolean;
  // A locked node is not rolled: its pity is frozen and it raises the roll cost.
  locked: boolean;
  // Rolls accumulated toward this node's next gold. Resets to 0 on gold.
  // Always 0 for Node 5 (it has no pity).
  pity: number;
  // 'gold' once the node is gold (and held there by a lock), otherwise null.
  // In this tracker tier is only ever 'gold' or null - blue/purple are not
  // distinguished because they do not affect pity. Node 5 is 'gold' once enabled.
  tier: Tier | null;
}

/** Per-node manual state captured by a revert milestone (pity-only, no variant). */
export interface RevertNodeInput {
  id: NodeId;
  gold: boolean;
  locked: boolean;
}

/**
 * The user-authored unit of a session. Everything else is derived from an
 * ordered array of these.
 *
 * - `roll`: a batch of `rolls` since the previous milestone, ending in the ids
 *   of any nodes that turned gold (`goldHits`). Lock config is constant across
 *   the batch because lock changes are their own milestones.
 * - `lock`: toggle one node's locked flag (0 rolls, 0 stones).
 * - `revert`: roll back to a saved look; the user supplies gold/lock per node and
 *   ALL pity resets to 0 (mirrors the in-game anti-stacking behavior).
 */
export type MilestoneInput =
  | { id: string; type: 'roll'; rolls: number; goldHits: NodeId[] }
  | { id: string; type: 'lock'; nodeId: NodeId; locked: boolean }
  | { id: string; type: 'revert'; nodes: RevertNodeInput[] };

export type MilestoneType = MilestoneInput['type'];

/**
 * A derived milestone row: the input plus the running totals and the full node
 * snapshot *after* applying it. `goldPity` records, for each node that turned
 * gold in this milestone, how many rolls it took (pity-at-gold) - needed for
 * cell coloring because the snapshot pity is 0 after the reset.
 */
export interface Milestone {
  input: MilestoneInput;
  index: number; // 1-based position among user milestones
  rolls: number; // rolls in this segment (0 for lock/revert)
  cumulativeRolls: number;
  stones: number; // stones spent this segment
  cumulativeStones: number;
  nodes: NodeSnapshot[]; // full state after this milestone
  label: string; // human-readable summary, e.g. "Color Node -> Gold"
  goldPity?: Partial<Record<NodeId, number>>;
}

/** Shape persisted to localStorage. Gated by `version` for safe migrations. */
export interface PersistedState {
  version: 2;
  inputs: MilestoneInput[];
}
