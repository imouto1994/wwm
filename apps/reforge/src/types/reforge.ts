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
  // Whether the node has been unlocked yet. Flipped on by an `unlock` milestone
  // (Node 1 starts enabled); once true it stays true (unlocks are permanent
  // in-game). The unlock roll totals vary per weapon, so this is recorded
  // manually rather than derived from a fixed threshold.
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
 * - `unlock`: enable a node. The unlock roll counts as the node's first pity, so
 *   it starts at pity 1 (Misc turns gold). Unlocks are permanent, so there is no
 *   `enabled` flag - recording the milestone *is* the unlock. The roll totals
 *   that gate unlocking vary per weapon, so the player records it manually when
 *   the node lights up in-game rather than the app deriving it from a threshold.
 * - `lock`: toggle one node's locked flag (0 rolls, 0 stones).
 * - `revert`: roll back to a saved look; the user supplies gold/lock per node and
 *   ALL pity resets to 0 (mirrors the in-game anti-stacking behavior).
 */
export type MilestoneInput =
  | { id: string; type: 'roll'; rolls: number; goldHits: NodeId[] }
  | { id: string; type: 'unlock'; nodeId: NodeId }
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

/**
 * A single tracked reforge session: a user-given name plus its ordered
 * milestone inputs. As with the whole app, only the inputs are persisted; the
 * per-node table for a session is derived by replaying `inputs`.
 */
export interface Session {
  id: string;
  name: string;
  inputs: MilestoneInput[];
}

/**
 * Shape persisted to localStorage. Gated by `version` for safe migrations.
 *
 * v4 holds many named sessions plus the id of the active one, with explicit
 * `unlock` milestones. Older shapes are migrated on load (see
 * `storage.ts#coerceState`): v2 (`{ version: 2, inputs }`, a single unnamed
 * session) and v3 (multi-session but pre-manual-unlock) both have their unlocks
 * synthesized from the legacy thresholds.
 */
export interface PersistedState {
  version: 4;
  sessions: Session[];
  activeSessionId: string;
}

/**
 * JSON envelope for a single exported/imported session (one file = one session).
 *
 * `exportVersion` is the file-format version, intentionally separate from
 * `PersistedState.version` so the on-disk and on-file schemas can evolve apart.
 * v2 carries explicit `unlock` milestones; v1 files are migrated on import. The
 * session `id` is intentionally omitted - a fresh one is minted on import so an
 * imported session never collides with an existing one. See `lib/sessionIo.ts`.
 */
export interface SessionExport {
  type: 'wwm-reforge-session';
  exportVersion: 2;
  exportedAt: string; // ISO timestamp, informational only
  name: string;
  inputs: MilestoneInput[];
}
