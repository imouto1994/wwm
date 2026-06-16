import { AUTO_GOLD_NODE, HARD_PITY, NODE_LABELS, UNLOCK_ROLLS } from '@/lib/constants';
import { isSoon } from '@/lib/engine';
import type { NodeId, NodeSnapshot, Tier } from '@/types/reforge';
/**
 * Current-state header: session totals, the next-roll cost, the per-node chips
 * (with an inline lock toggle and the "about to pop" pulse), and the buttons
 * that open the milestone forms. This reflects the latest milestone - the live
 * state of the reforge.
 */
import { Coins, Dices, Lock, LockOpen, RotateCcw, Sparkles } from 'lucide-react';

interface Props {
  totalRolls: number;
  totalStones: number;
  nextCost: number;
  nodes: NodeSnapshot[];
  onToggleLock: (id: NodeId, locked: boolean) => void;
  onRecordRoll: () => void;
  onRevert: () => void;
  onReset: () => void;
}

const TIER_TEXT: Record<Tier, string> = {
  gold: 'text-tier-gold',
  purple: 'text-tier-purple',
  blue: 'text-tier-blue',
};

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className='flex items-center gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2'>
      <span className='text-gold'>{icon}</span>
      <div>
        <div className='text-[10px] uppercase tracking-wide text-muted'>{label}</div>
        <div className='font-semibold tabular-nums'>{value}</div>
      </div>
    </div>
  );
}

function NodeChip({ node, onToggleLock }: { node: NodeSnapshot; onToggleLock: Props['onToggleLock'] }) {
  const isAuto = node.id === AUTO_GOLD_NODE;
  const soon = isSoon(node);

  if (!node.enabled) {
    return (
      <div className='flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-surface/50 px-3 py-2 text-xs text-muted'>
        <span>{NODE_LABELS[node.id]}</span>
        <span>@ {UNLOCK_ROLLS[node.id]}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2 ${soon ? 'animate-soon' : ''}`}>
      <div className='min-w-0'>
        <div className='truncate text-xs font-medium'>{NODE_LABELS[node.id]}</div>
        {isAuto ? (
          <div className='flex items-center gap-1 text-xs text-tier-gold'>
            <Sparkles size={11} /> Gold
          </div>
        ) : (
          <div className='flex items-center gap-2 text-xs'>
            <span className={node.tier ? TIER_TEXT[node.tier] : 'text-muted'}>{node.tier ?? 'no result'}</span>
            <span className='tabular-nums text-muted'>
              {node.pity}/{HARD_PITY}
            </span>
          </div>
        )}
      </div>
      {!isAuto && (
        <button
          type='button'
          onClick={() => onToggleLock(node.id, !node.locked)}
          aria-pressed={node.locked}
          aria-label={node.locked ? `Unlock ${NODE_LABELS[node.id]}` : `Lock ${NODE_LABELS[node.id]}`}
          className={`rounded-md border p-1 transition-colors ${
            node.locked ? 'border-gold/50 bg-gold/10 text-gold' : 'border-border text-muted hover:bg-surface-hover'
          }`}
        >
          {node.locked ? <Lock size={13} /> : <LockOpen size={13} />}
        </button>
      )}
    </div>
  );
}

export function CurrentStateBar({ totalRolls, totalStones, nextCost, nodes, onToggleLock, onRecordRoll, onRevert, onReset }: Props) {
  return (
    <section className='flex flex-col gap-4 rounded-xl border border-border bg-surface p-4'>
      <div className='grid grid-cols-3 gap-2'>
        <Stat icon={<Dices size={18} />} label='Total rolls' value={totalRolls} />
        <Stat icon={<Coins size={18} />} label='Stones spent' value={totalStones} />
        <Stat icon={<Coins size={18} />} label='Next roll' value={`${nextCost}`} />
      </div>

      <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'>
        {nodes.map((node) => (
          <NodeChip key={node.id} node={node} onToggleLock={onToggleLock} />
        ))}
      </div>

      <div className='flex flex-wrap gap-2'>
        <button
          type='button'
          onClick={onRecordRoll}
          className='inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-bg transition-opacity hover:opacity-90'
        >
          <Dices size={16} /> Record rolls / gold
        </button>
        <button
          type='button'
          onClick={onRevert}
          className='inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-hover'
        >
          <RotateCcw size={16} /> Revert
        </button>
        <button
          type='button'
          onClick={onReset}
          className='inline-flex items-center gap-2 rounded-lg border border-red/40 px-3 py-2 text-sm text-red transition-colors hover:bg-red/10'
        >
          Reset
        </button>
      </div>
    </section>
  );
}
