import { AUTO_GOLD_NODE, NODE_IDS } from '@/lib/constants';
import { createInitialNodes, goldPityColor, isSoon } from '@/lib/engine';
import type { Milestone, NodeId, NodeSnapshot } from '@/types/reforge';
/**
 * The milestone log rendered as a table: one row per milestone (plus a Start
 * baseline), one column per node. Two cell cues:
 *  - Gold-luck background on the row where a node turned gold, colored by how
 *    many rolls it took (green < 30, yellow < 50, red >= 50). The number is
 *    shown too so color is not the only signal.
 *  - A pulsing glow on the latest row for nodes that are about to pop.
 * Edit/Delete are offered on the latest row only (Edit hidden for lock rows).
 */
import { Circle, Lock, Pencil, Sparkles, Star, Trash2 } from 'lucide-react';

interface Props {
  milestones: Milestone[];
  onEditLatest: () => void;
  onDeleteLatest: () => void;
}

const SHORT_LABELS: Record<NodeId, string> = { 1: 'Color', 2: 'Part 1', 3: 'Part 2', 4: 'Part 3', 5: 'Misc' };

// Shared by the table cells, the Legend, and the GoldStats bars so the luck
// colors stay in lockstep.
export const LUCK_BG: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-green-600/30 text-green-200',
  yellow: 'bg-yellow-500/25 text-yellow-100',
  red: 'bg-red-600/30 text-red-200',
};

function NodeCell({ rowNodes, nodeId, goldPity, isLatest }: { rowNodes: NodeSnapshot[]; nodeId: NodeId; goldPity?: number; isLatest: boolean }) {
  const node = rowNodes.find((n) => n.id === nodeId);
  if (!node || !node.enabled) {
    return <td className='px-2 py-1.5 text-center text-muted'>-</td>;
  }

  // Node 5 is auto-gold; it never shows pity or luck color.
  if (nodeId === AUTO_GOLD_NODE) {
    return (
      <td className='px-2 py-1.5 text-center text-tier-gold'>
        <span className='inline-flex items-center gap-1'>
          <Sparkles size={11} /> Gold
        </span>
      </td>
    );
  }

  // This node turned gold in this milestone: color by how many rolls it took.
  if (goldPity != null) {
    return (
      <td className='px-1 py-1 text-center'>
        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold tabular-nums ${LUCK_BG[goldPityColor(goldPity)]}`}>
          <Star size={12} fill='currentColor' aria-hidden />
          <span>{goldPity}</span>
        </span>
      </td>
    );
  }

  const soon = isLatest && isSoon(node);
  const tierClass =
    node.tier === 'gold' ? 'text-tier-gold' : node.tier === 'purple' ? 'text-tier-purple' : node.tier === 'blue' ? 'text-tier-blue' : 'text-muted';

  return (
    <td className='px-2 py-1.5 text-center'>
      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 tabular-nums ${soon ? 'animate-soon' : ''}`}>
        <span className={tierClass}>
          {node.tier === 'gold' ? <Star size={12} fill='currentColor' aria-hidden /> : <Circle size={8} fill='currentColor' aria-hidden />}
        </span>
        <span className='text-muted'>{node.pity}</span>
        {node.locked && (
          <span title='locked' className='inline-flex text-gold'>
            <Lock size={11} aria-label='locked' />
          </span>
        )}
      </span>
    </td>
  );
}

// A roll that landed golds shows each node name followed by a gold star (e.g.
// "Color *, Part 1 *") instead of the longer "-> Gold" text. Other milestone
// types (plain rolls, lock, revert) fall back to the engine's label string.
function MilestoneLabel({ m }: { m: Milestone }) {
  if (m.input.type === 'roll' && m.input.goldHits.length > 0) {
    // Each "name + star" is its own items-center group so the star is vertically
    // centered with the text (vertical-align on an inline SVG sits slightly low).
    // Spacing is via margins so the comma hugs the previous star ("... *, ...").
    return (
      <span className='inline-flex flex-wrap items-center gap-y-0.5'>
        {m.input.goldHits.map((id, i) => (
          <span key={id} className='inline-flex items-center whitespace-nowrap'>
            {i > 0 && <span className='mr-1'>,</span>}
            {SHORT_LABELS[id]}
            <Star size={12} fill='currentColor' className='ml-1 text-tier-gold' aria-label='gold' />
          </span>
        ))}
      </span>
    );
  }
  return <>{m.label}</>;
}

function MilestoneRow({
  m,
  isLatest,
  onEditLatest,
  onDeleteLatest,
}: { m: Milestone; isLatest: boolean; onEditLatest: () => void; onDeleteLatest: () => void }) {
  return (
    <tr className={isLatest ? 'bg-surface-hover/40' : ''}>
      <td className='sticky left-0 z-10 bg-surface px-2 py-1.5 text-center text-muted tabular-nums'>{m.index}</td>
      <td className='px-2 py-1.5 whitespace-nowrap'>
        <MilestoneLabel m={m} />
      </td>
      {NODE_IDS.map((id) => (
        <NodeCell key={id} rowNodes={m.nodes} nodeId={id} goldPity={m.goldPity?.[id]} isLatest={isLatest} />
      ))}
      <td className='px-2 py-1.5 text-center tabular-nums'>{m.rolls || '-'}</td>
      <td className='px-2 py-1.5 text-center tabular-nums text-muted'>{m.cumulativeRolls}</td>
      <td className='px-2 py-1.5 text-center tabular-nums'>{m.stones || '-'}</td>
      <td className='px-2 py-1.5 text-center tabular-nums text-muted'>{m.cumulativeStones}</td>
      <td className='px-2 py-1.5 text-center whitespace-nowrap'>
        {isLatest ? (
          <span className='inline-flex gap-1'>
            {m.input.type !== 'lock' && (
              <button
                type='button'
                onClick={onEditLatest}
                aria-label='Edit latest milestone'
                className='rounded border border-border p-1 text-muted transition-colors hover:bg-surface-hover'
              >
                <Pencil size={13} />
              </button>
            )}
            <button
              type='button'
              onClick={onDeleteLatest}
              aria-label='Delete latest milestone'
              className='rounded border border-red/40 p-1 text-red transition-colors hover:bg-red/10'
            >
              <Trash2 size={13} />
            </button>
          </span>
        ) : (
          <span className='text-muted'>-</span>
        )}
      </td>
    </tr>
  );
}

export function MilestoneTable({ milestones, onEditLatest, onDeleteLatest }: Props) {
  const startNodes = createInitialNodes();

  return (
    <section className='flex flex-col gap-2'>
      <h2 className='font-semibold text-gold'>Milestones</h2>
      <div className='overflow-x-auto rounded-xl border border-border'>
        <table className='w-full min-w-[640px] border-collapse text-sm'>
          <thead>
            <tr className='border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted'>
              <th className='sticky left-0 z-10 bg-surface px-2 py-2 text-center'>#</th>
              <th className='px-2 py-2'>Milestone</th>
              {NODE_IDS.map((id) => (
                <th key={id} className='px-2 py-2 text-center'>
                  {SHORT_LABELS[id]}
                </th>
              ))}
              <th className='px-2 py-2 text-center'>Rolls</th>
              <th className='px-2 py-2 text-center'>Σ</th>
              <th className='px-2 py-2 text-center'>Stones</th>
              <th className='px-2 py-2 text-center'>Σ</th>
              <th className='px-2 py-2 text-center'>Edit</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-border'>
            {/* Start baseline row */}
            <tr>
              <td className='sticky left-0 z-10 bg-surface px-2 py-1.5 text-center text-muted'>0</td>
              <td className='px-2 py-1.5 text-muted'>Start</td>
              {NODE_IDS.map((id) => (
                <NodeCell key={id} rowNodes={startNodes} nodeId={id} isLatest={false} />
              ))}
              <td className='px-2 py-1.5 text-center text-muted'>-</td>
              <td className='px-2 py-1.5 text-center text-muted'>0</td>
              <td className='px-2 py-1.5 text-center text-muted'>-</td>
              <td className='px-2 py-1.5 text-center text-muted'>0</td>
              <td className='px-2 py-1.5 text-center text-muted'>-</td>
            </tr>
            {milestones.map((m, i) => (
              <MilestoneRow key={m.input.id} m={m} isLatest={i === milestones.length - 1} onEditLatest={onEditLatest} onDeleteLatest={onDeleteLatest} />
            ))}
          </tbody>
        </table>
      </div>
      {milestones.length === 0 && <p className='text-sm text-muted'>No milestones yet. Use "Add Rolls" each time a node turns gold so nothing is missed.</p>}
    </section>
  );
}
