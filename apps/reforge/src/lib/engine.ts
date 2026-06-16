/**
 * Pure reforge engine.
 *
 * The single source of truth for a session is an ordered `MilestoneInput[]`.
 * `replay` folds those inputs into a list of `Milestone` snapshots that the UI
 * renders as a table. Keeping this framework-free makes it trivial to unit-test
 * the subtle bits (pity accrual across unlock boundaries, stone cost, the
 * pity-at-gold used for cell coloring, clearing a re-rolled gold, revert).
 */
import { AUTO_GOLD_NODE, GOLD_LUCK, NODE_IDS, NODE_LABELS, ROLLABLE_NODE_IDS, ROLL_COST_BY_LOCKED, SOON_PITY, UNLOCK_ROLLS } from '@/lib/constants';
import type { Milestone, MilestoneInput, NodeId, NodeSnapshot } from '@/types/reforge';

// Opening state of a fresh session: only Node 1 is enabled, nothing locked,
// no pity, no results yet.
export function createInitialNodes(): NodeSnapshot[] {
  return NODE_IDS.map((id) => ({
    id,
    enabled: UNLOCK_ROLLS[id] === 0,
    locked: false,
    pity: 0,
    tier: null,
  }));
}

// A node is enabled once cumulative rolls reach its unlock threshold.
export function isNodeEnabled(id: NodeId, cumulativeRolls: number): boolean {
  return cumulativeRolls >= UNLOCK_ROLLS[id];
}

// Locked rollable nodes drive the roll cost. Node 5 is auto-gold and never counted.
export function lockedRollableCount(nodes: NodeSnapshot[]): number {
  return nodes.filter((n) => ROLLABLE_NODE_IDS.includes(n.id) && n.enabled && n.locked).length;
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

// Nodes a gold can be recorded for, given the cumulative rolls *after* the batch
// being entered. Rollable (1-4), not locked, and enabled at that point - so a
// node that unlocks part-way through the entered rolls is offered too.
export function rollableAfter(nodes: NodeSnapshot[], cumulativeAfter: number): NodeId[] {
  return nodes.filter((n) => ROLLABLE_NODE_IDS.includes(n.id) && !n.locked && isNodeEnabled(n.id, cumulativeAfter)).map((n) => n.id);
}

// Enabled nodes that can be locked or set in a revert (everything but Node 5).
export function lockableNodes(nodes: NodeSnapshot[]): NodeSnapshot[] {
  return nodes.filter((n) => n.id !== AUTO_GOLD_NODE && n.enabled);
}

// Maps a pity-at-gold value to a luck color for the cell background.
export function goldPityColor(pity: number): 'green' | 'yellow' | 'red' {
  if (pity < GOLD_LUCK.green) return 'green';
  if (pity < GOLD_LUCK.yellow) return 'yellow';
  return 'red';
}

// Whether a node is "about to pop": actively rolling (enabled, unlocked,
// not yet gold) and at/over the soft-pity floor. Drives the current-state pulse.
export function isSoon(node: NodeSnapshot): boolean {
  return node.id !== AUTO_GOLD_NODE && node.enabled && !node.locked && node.tier !== 'gold' && node.pity >= SOON_PITY;
}

// Human-readable summary shown in the table's Note column.
function labelFor(input: MilestoneInput): string {
  switch (input.type) {
    case 'roll': {
      if (input.goldHits.length === 0) {
        return `${input.rolls} roll${input.rolls === 1 ? '' : 's'}`;
      }
      return input.goldHits.map((id) => `${NODE_LABELS[id]} -> Gold`).join(', ');
    }
    case 'lock':
      return `${input.locked ? 'Lock' : 'Unlock'} ${NODE_LABELS[input.nodeId]}`;
    case 'revert':
      return 'Revert';
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
function applyRoll(prevNodes: NodeSnapshot[], prevCum: number, rolls: number, goldHits: NodeId[]): RollResult {
  const cum = prevCum + rolls;
  const stones = rolls * rollCost(lockedRollableCount(prevNodes));
  const golds = new Set<NodeId>(goldHits);
  const goldPity: Partial<Record<NodeId, number>> = {};

  const nodes = prevNodes.map((node) => {
    const enabled = isNodeEnabled(node.id, cum);

    // Node 5 is auto-gold once enabled; it is never rolled and has no pity.
    if (node.id === AUTO_GOLD_NODE) {
      return { ...node, enabled, tier: enabled ? ('gold' as const) : null, pity: 0 };
    }

    // Rolls during which this node was actually active: enabled going into the
    // roll (the +1 offset: a node unlocked at threshold T first rolls at T+1, so
    // we clamp the segment start to max(prevCum, T)) and not locked.
    const threshold = UNLOCK_ROLLS[node.id];
    const accruing = node.locked ? 0 : Math.max(0, cum - Math.max(prevCum, threshold));
    const reached = node.pity + accruing;

    if (golds.has(node.id)) {
      // Record how many rolls it took to reach this gold (for cell coloring),
      // then reset pity to 0 and mark it gold.
      goldPity[node.id] = reached;
      return { ...node, enabled, tier: 'gold' as const, pity: 0 };
    }

    if (accruing > 0) {
      // The node was actively re-rolled this segment without turning gold, so any
      // prior gold has been gambled away - clear the gold marker. (A node a player
      // wants to keep should be locked; a locked node never reaches this branch.)
      return { ...node, enabled, tier: null, pity: reached };
    }

    // Locked, disabled, or not yet active this segment: state is frozen, so a
    // locked gold keeps its star into later rows.
    return { ...node, enabled, pity: reached };
  });

  return { nodes, stones, goldPity: Object.keys(goldPity).length > 0 ? goldPity : undefined };
}

// Toggle one node's locked flag; nothing else changes.
function applyLock(prevNodes: NodeSnapshot[], nodeId: NodeId, locked: boolean): NodeSnapshot[] {
  return prevNodes.map((node) => (node.id === nodeId ? { ...node, locked } : { ...node }));
}

/**
 * Revert to a saved look. The user supplies gold + lock per enabled node (no
 * variant - this is a pity tracker). ALL pity resets to 0. Enabled status,
 * cumulative rolls, and cumulative stones are preserved (unlocks are permanent
 * and already-spent stones are not refunded).
 */
function applyRevert(prevNodes: NodeSnapshot[], cum: number, input: Extract<MilestoneInput, { type: 'revert' }>): NodeSnapshot[] {
  const byId = new Map(input.nodes.map((n) => [n.id, n]));
  return prevNodes.map((node) => {
    const enabled = isNodeEnabled(node.id, cum);
    if (node.id === AUTO_GOLD_NODE) {
      return { ...node, enabled, tier: enabled ? ('gold' as const) : null, pity: 0 };
    }
    const r = byId.get(node.id);
    if (!r) return { ...node, enabled, pity: 0 };
    return { ...node, enabled, locked: r.locked, tier: r.gold ? ('gold' as const) : null, pity: 0 };
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
      case 'roll': {
        rolls = input.rolls;
        const result = applyRoll(prevNodes, cumulativeRolls, rolls, input.goldHits);
        nodes = result.nodes;
        stones = result.stones;
        goldPity = result.goldPity;
        cumulativeRolls += rolls;
        break;
      }
      case 'lock':
        nodes = applyLock(prevNodes, input.nodeId, input.locked);
        break;
      case 'revert':
        nodes = applyRevert(prevNodes, cumulativeRolls, input);
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
  return milestones.length > 0 ? milestones[milestones.length - 1].nodes : createInitialNodes();
}
