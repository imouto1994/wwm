/**
 * One-time migration from the old auto-unlock model to manual `unlock`
 * milestones (pure, framework- and window-free).
 *
 * The app used to derive a node's `enabled` flag from cumulative rolls vs a
 * fixed per-node threshold. We learned those totals differ per weapon, so
 * unlocking is now an explicit milestone. Sessions and exports created before
 * that change have no `unlock` milestones, so replaying them would leave nodes
 * 2-5 permanently disabled. `synthesizeUnlocks` repairs them by inserting the
 * missing unlocks where each session's rolls crossed the legacy thresholds.
 *
 * To keep per-node pity numerically faithful, a roll batch that crosses a
 * threshold mid-way is *split* at that point so the unlock lands on the exact
 * crossing roll (matching the old "the unlock roll is the first pity" rule).
 */
import { INITIALLY_ENABLED_NODE_IDS, LEGACY_UNLOCK_ROLLS, NODE_IDS } from '@/lib/constants';
import { uid } from '@/lib/id';
import type { MilestoneInput, NodeId } from '@/types/reforge';

/**
 * Insert synthetic `unlock` milestones into legacy inputs.
 *
 * Splits roll batches at legacy thresholds and attaches the batch's original
 * `goldHits` to its final roll piece (filtered to nodes already enabled during
 * that piece). The only case it cannot represent exactly is a node that both
 * unlocked and turned gold on the very same crossing roll - that single gold
 * marker is dropped; cumulative rolls, stones, every other gold, and all pity
 * stay exact.
 */
export function synthesizeUnlocks(inputs: MilestoneInput[]): MilestoneInput[] {
  // If explicit unlocks already exist the inputs are post-migration; leave them
  // untouched so we never double-insert (idempotent on already-migrated data).
  if (inputs.some((i) => i.type === 'unlock')) return inputs;

  const out: MilestoneInput[] = [];
  let cum = 0;
  const unlocked = new Set<NodeId>(INITIALLY_ENABLED_NODE_IDS);

  for (const input of inputs) {
    if (input.type !== 'roll') {
      out.push(input);
      continue;
    }

    const start = cum;
    const end = start + input.rolls;
    cum = end;

    // Legacy thresholds this batch crosses, for still-locked nodes, ascending.
    const crossings = NODE_IDS.filter((id) => !unlocked.has(id))
      .map((id) => ({ id, threshold: LEGACY_UNLOCK_ROLLS[id] }))
      .filter((c) => c.threshold > start && c.threshold <= end)
      .sort((a, b) => a.threshold - b.threshold);

    if (crossings.length === 0) {
      out.push(input);
      continue;
    }

    // Emit roll pieces separated by unlocks. Remember the last roll piece (and
    // which nodes were enabled while it rolled) so the original golds land there.
    let segStart = start;
    let lastRollPieceIndex = -1;
    let enabledDuringLastPiece = new Set<NodeId>(unlocked);

    const pushRollPiece = (rolls: number) => {
      if (rolls <= 0) return;
      enabledDuringLastPiece = new Set<NodeId>(unlocked);
      out.push({ id: uid(), type: 'roll', rolls, goldHits: [] });
      lastRollPieceIndex = out.length - 1;
    };

    for (const c of crossings) {
      pushRollPiece(c.threshold - segStart);
      out.push({ id: uid(), type: 'unlock', nodeId: c.id });
      unlocked.add(c.id);
      segStart = c.threshold;
    }
    pushRollPiece(end - segStart);

    if (lastRollPieceIndex >= 0 && input.goldHits.length > 0) {
      const piece = out[lastRollPieceIndex];
      if (piece.type === 'roll') {
        piece.goldHits = input.goldHits.filter((id) => enabledDuringLastPiece.has(id));
      }
    }
  }

  return out;
}
