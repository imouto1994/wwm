/**
 * Pure reforge engine.
 *
 * The single source of truth for a session is an ordered `MilestoneInput[]`.
 * `replay` folds those inputs into a list of `Milestone` snapshots that the UI
 * renders as a table. Keeping this framework-free makes it trivial to unit-test
 * the subtle bits (pity accrual across unlock boundaries, stone cost, the
 * pity-at-gold used for cell coloring, clearing a re-rolled gold, revert).
 */
import {
  AUTO_GOLD_NODE,
  GOLD_BUCKET_SIZE,
  GOLD_LUCK,
  HARD_PITY,
  INITIALLY_ENABLED_NODE_IDS,
  NODE_IDS,
  NODE_LABELS,
  ROLLABLE_NODE_IDS,
  ROLL_COST_BY_LOCKED,
  SOON_PITY,
} from "@/lib/constants";
import type {
  Milestone,
  MilestoneInput,
  NodeId,
  NodeSnapshot,
} from "@/types/reforge";

// Opening state of a fresh session: only Node 1 is enabled, nothing locked,
// no pity, no results yet. Other nodes unlock via `unlock` milestones.
export function createInitialNodes(): NodeSnapshot[] {
  return NODE_IDS.map((id) => ({
    id,
    enabled: INITIALLY_ENABLED_NODE_IDS.includes(id),
    locked: false,
    pity: 0,
    tier: null,
  }));
}

// Locked rollable nodes drive the roll cost. Node 5 is auto-gold and never counted.
export function lockedRollableCount(nodes: NodeSnapshot[]): number {
  return nodes.filter(
    (n) => ROLLABLE_NODE_IDS.includes(n.id) && n.enabled && n.locked
  ).length;
}

// Stone cost of one roll given how many rollable nodes are locked. The table
// tops out at 3 (only nodes 1-4 are rollable), so clamp anything higher.
export function rollCost(lockedCount: number): number {
  return ROLL_COST_BY_LOCKED[lockedCount] ?? ROLL_COST_BY_LOCKED[3];
}

// Cost of the next roll given a node state (e.g. for the current-state header).
export function nextRollCost(nodes: NodeSnapshot[]): number {
  return rollCost(lockedRollableCount(nodes));
}

// Nodes a gold can be recorded for: rollable (1-4), enabled (already unlocked),
// and not locked. Unlocking is its own milestone now, so this no longer projects
// future unlocks - a node must be unlocked before its golds can be recorded.
export function rollableNodes(nodes: NodeSnapshot[]): NodeId[] {
  return nodes
    .filter((n) => ROLLABLE_NODE_IDS.includes(n.id) && n.enabled && !n.locked)
    .map((n) => n.id);
}

// The next node the player can unlock. In-game nodes unlock strictly in order
// (Node 2 -> Node 3 -> Node 4 -> Node 5), so the UI only offers the lowest-id
// not-yet-enabled node. Returns null once everything is unlocked. The engine
// itself stays permissive; this only drives the UI's sequential gating.
export function nextUnlockableNodeId(nodes: NodeSnapshot[]): NodeId | null {
  const next = NODE_IDS.find((id) => !nodes.find((n) => n.id === id)?.enabled);
  return next ?? null;
}

// Enabled nodes that can be locked or set in a revert (everything but Node 5).
export function lockableNodes(nodes: NodeSnapshot[]): NodeSnapshot[] {
  return nodes.filter((n) => n.id !== AUTO_GOLD_NODE && n.enabled);
}

// Maps a pity-at-gold value to a luck color for the cell background.
export function goldPityColor(pity: number): "green" | "yellow" | "red" {
  // Inclusive upper bounds (<= 30 green, <= 50 yellow, > 50 red) so the bands
  // line up with the size-5 GoldStats buckets that break at 30 and 50.
  if (pity <= GOLD_LUCK.green) return "green";
  if (pity <= GOLD_LUCK.yellow) return "yellow";
  return "red";
}

// Whether a node is "about to pop": actively rolling (enabled, unlocked,
// not yet gold) and at/over the soft-pity floor. Drives the current-state pulse.
export function isSoon(node: NodeSnapshot): boolean {
  return (
    node.id !== AUTO_GOLD_NODE &&
    node.enabled &&
    !node.locked &&
    node.tier !== "gold" &&
    node.pity >= SOON_PITY
  );
}

// Human-readable summary shown in the table's Note column.
function labelFor(input: MilestoneInput): string {
  switch (input.type) {
    case "roll": {
      if (input.goldHits.length === 0) {
        return `${input.rolls} roll${input.rolls === 1 ? "" : "s"}`;
      }
      return input.goldHits
        .map((id) => `${NODE_LABELS[id]} -> Gold`)
        .join(", ");
    }
    case "unlock":
      return `Unlock ${NODE_LABELS[input.nodeId]}`;
    case "lock":
      return `${input.locked ? "Lock" : "Unlock"} ${NODE_LABELS[input.nodeId]}`;
    case "revert":
      return "Restore";
  }
}

interface RollResult {
  nodes: NodeSnapshot[];
  stones: number;
  goldPity?: Partial<Record<NodeId, number>>;
}

/**
 * Apply a batch of `rolls` (ending in the recorded gold node ids) to the
 * previous node state. Lock config is constant across the batch (lock changes
 * are their own milestones), so the cost is simply `rolls * cost(lockedCount)`.
 */
function applyRoll(
  prevNodes: NodeSnapshot[],
  rolls: number,
  goldHits: NodeId[]
): RollResult {
  const stones = rolls * rollCost(lockedRollableCount(prevNodes));
  const golds = new Set<NodeId>(goldHits);
  const goldPity: Partial<Record<NodeId, number>> = {};

  const nodes = prevNodes.map((node) => {
    // Node 5 is auto-gold while enabled; it is never rolled and has no pity. Its
    // `enabled` is set by an unlock milestone, so leave it untouched here.
    if (node.id === AUTO_GOLD_NODE) {
      return {
        ...node,
        tier: node.enabled ? ("gold" as const) : null,
        pity: 0,
      };
    }

    // A node accrues one pity per roll while it is unlocked (enabled) and not
    // locked. Unlocking is its own milestone that already grants the first pity,
    // so the accrual here is simply the batch size - no unlock-threshold clamp.
    const accruing = node.locked || !node.enabled ? 0 : rolls;
    const reached = node.pity + accruing;

    // Only an enabled node can turn gold; ignore stray hits for disabled nodes
    // (the form never offers them, but imports are untrusted).
    if (node.enabled && golds.has(node.id)) {
      // Record how many rolls it took to reach this gold (for cell coloring),
      // then reset pity to 0 and mark it gold.
      goldPity[node.id] = reached;
      return { ...node, tier: "gold" as const, pity: 0 };
    }

    if (accruing > 0) {
      // The node was actively re-rolled this segment without turning gold, so any
      // prior gold has been gambled away - clear the gold marker. (A node a player
      // wants to keep should be locked; a locked node never reaches this branch.)
      return { ...node, tier: null, pity: reached };
    }

    // Locked, disabled, or not active this segment: state is frozen, so a locked
    // gold keeps its star into later rows.
    return { ...node, pity: reached };
  });

  return {
    nodes,
    stones,
    goldPity: Object.keys(goldPity).length > 0 ? goldPity : undefined,
  };
}

// Toggle one node's locked flag; nothing else changes.
function applyLock(
  prevNodes: NodeSnapshot[],
  nodeId: NodeId,
  locked: boolean
): NodeSnapshot[] {
  return prevNodes.map((node) =>
    node.id === nodeId ? { ...node, locked } : { ...node }
  );
}

/**
 * Enable a node. The unlock roll counts as the node's first pity, so a freshly
 * unlocked node reads pity 1; Misc (Node 5) has no pity and turns gold instead.
 * Idempotent: re-unlocking an already-enabled node is a no-op (so we never reset
 * a node's pity by accident). Unlocks are permanent.
 */
function applyUnlock(
  prevNodes: NodeSnapshot[],
  nodeId: NodeId
): NodeSnapshot[] {
  return prevNodes.map((node) => {
    if (node.id !== nodeId || node.enabled) return { ...node };
    if (node.id === AUTO_GOLD_NODE) {
      return { ...node, enabled: true, tier: "gold" as const, pity: 0 };
    }
    return { ...node, enabled: true, pity: 1 };
  });
}

/**
 * Revert to a saved look. The user supplies gold + lock per enabled node (no
 * variant - this is a pity tracker). ALL pity resets to 0. Enabled status,
 * cumulative rolls, and cumulative stones are preserved (unlocks are permanent
 * and already-spent stones are not refunded).
 */
function applyRevert(
  prevNodes: NodeSnapshot[],
  input: Extract<MilestoneInput, { type: "revert" }>
): NodeSnapshot[] {
  const byId = new Map(input.nodes.map((n) => [n.id, n]));
  return prevNodes.map((node) => {
    // `enabled` is carried state (set by unlock milestones), not re-derived here.
    if (node.id === AUTO_GOLD_NODE) {
      return {
        ...node,
        tier: node.enabled ? ("gold" as const) : null,
        pity: 0,
      };
    }
    const r = byId.get(node.id);
    if (!r) return { ...node, pity: 0 };
    return {
      ...node,
      locked: r.locked,
      tier: r.gold ? ("gold" as const) : null,
      pity: 0,
    };
  });
}

/**
 * Fold the ordered milestone inputs into derived snapshots. This is the heart
 * of the app: the table renders the result and the current state is the last
 * entry (or the initial nodes when empty).
 */
export function replay(inputs: MilestoneInput[]): Milestone[] {
  const milestones: Milestone[] = [];
  let prevNodes = createInitialNodes();
  let cumulativeRolls = 0;
  let cumulativeStones = 0;

  inputs.forEach((input, i) => {
    let rolls = 0;
    let stones = 0;
    let goldPity: Partial<Record<NodeId, number>> | undefined;
    let nodes: NodeSnapshot[];

    switch (input.type) {
      case "roll": {
        rolls = input.rolls;
        const result = applyRoll(prevNodes, rolls, input.goldHits);
        nodes = result.nodes;
        stones = result.stones;
        goldPity = result.goldPity;
        cumulativeRolls += rolls;
        break;
      }
      case "unlock":
        nodes = applyUnlock(prevNodes, input.nodeId);
        break;
      case "lock":
        nodes = applyLock(prevNodes, input.nodeId, input.locked);
        break;
      case "revert":
        nodes = applyRevert(prevNodes, input);
        break;
    }

    cumulativeStones += stones;
    milestones.push({
      input,
      index: i + 1,
      rolls,
      cumulativeRolls,
      stones,
      cumulativeStones,
      nodes,
      label: labelFor(input),
      goldPity,
    });
    prevNodes = nodes;
  });

  return milestones;
}

// Convenience: the current node state for a session (last milestone or initial).
export function currentNodes(milestones: Milestone[]): NodeSnapshot[] {
  return milestones.length > 0
    ? milestones[milestones.length - 1].nodes
    : createInitialNodes();
}

// One fixed pity range in the gold-luck distribution (inclusive bounds).
export interface PityBucket {
  min: number;
  max: number;
  count: number;
}

/**
 * Aggregate every recorded gold hit into fixed-width pity ranges, so the UI can
 * show where a session's golds tend to land relative to the soft-pity window.
 *
 * We read each milestone's `goldPity` (the pity-at-gold captured when a node
 * golded), pooling all rollable nodes together. Node 5 is auto-gold with no
 * pity, so it never appears in `goldPity` and is naturally excluded. Because it
 * is derived from `goldPity`, the distribution counts every gold *event* in the
 * session (even ones later gambled away) and re-derives on edit/delete.
 *
 * Buckets are `size`-wide and span 1..HARD_PITY (e.g. 1-5, 6-10, ... 86-90); a
 * gold at pity `p` lands in `floor((p - 1) / size)`. `p` is clamped to that
 * range defensively, though in practice it is always 1..HARD_PITY.
 */
export function goldPityDistribution(
  milestones: Milestone[],
  size: number = GOLD_BUCKET_SIZE
): { buckets: PityBucket[]; total: number } {
  const bucketCount = Math.ceil(HARD_PITY / size);
  const buckets: PityBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    min: i * size + 1,
    max: Math.min((i + 1) * size, HARD_PITY),
    count: 0,
  }));

  let total = 0;
  for (const m of milestones) {
    if (!m.goldPity) continue;
    for (const id of NODE_IDS) {
      const pity = m.goldPity[id];
      if (pity == null) continue;
      const clamped = Math.min(Math.max(pity, 1), HARD_PITY);
      const index = Math.min(Math.floor((clamped - 1) / size), bucketCount - 1);
      buckets[index].count += 1;
      total += 1;
    }
  }

  return { buckets, total };
}
