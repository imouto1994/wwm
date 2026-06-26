import { AUTO_GOLD_NODE, HARD_PITY, NODE_LABELS } from '@/lib/constants';
import { isSoon, nextUnlockableNodeId } from '@/lib/engine';
import type { NodeId, NodeSnapshot } from '@/types/reforge';
/**
 * Current-state header: session totals, the next-roll cost, the per-node chips
 * (with an inline lock toggle and the "about to pop" pulse), and the buttons
 * that open the milestone forms. This reflects the latest milestone - the live
 * state of the reforge.
 */
import { Coins, Dices, Lock, LockOpen, RotateCcw, Sparkles, Star, Tag } from 'lucide-react';

interface Props {
  totalRolls: number;
  totalStones: number;
  nextCost: number;
  nodes: NodeSnapshot[];
  onToggleLock: (id: NodeId, locked: boolean) => void;
  onUnlock: (id: NodeId) => void;
  onRecordRoll: () => void;
  onRevert: () => void;
  onReset: () => void;
}

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

function NodeChip({
  node,
  isNextUnlock,
  onToggleLock,
  onUnlock,
}: { node: NodeSnapshot; isNextUnlock: boolean; onToggleLock: Props['onToggleLock']; onUnlock: Props['onUnlock'] }) {
  const isAuto = node.id === AUTO_GOLD_NODE;
  const isGold = node.tier === 'gold';
  const soon = isSoon(node);

  if (!node.enabled) {
    // Nodes unlock sequentially in-game, so only the next one is actionable; the
    // rest show which node must unlock first.
    return (
      <div className='flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-surface/50 px-3 py-2 text-xs'>
        <span className='text-muted'>{NODE_LABELS[node.id]}</span>
        {isNextUnlock ? (
          <button
            type='button'
            onClick={() => onUnlock(node.id)}
            aria-label={`Unlock ${NODE_LABELS[node.id]}`}
            className='inline-flex items-center gap-1 rounded-md border border-gold/50 bg-gold/15 px-2 py-1 text-gold transition-colors hover:bg-gold/25'
          >
            <LockOpen size={12} /> Unlock
          </button>
        ) : (
          <span className='text-muted/70'>after {NODE_LABELS[(node.id - 1) as NodeId]}</span>
        )}
      </div>
    );
  }

  // Gold is signalled by a gold border + gold label/star (no tier word, no fill).
  // A held gold always has pity 0, so the pity readout is dropped for gold and
  // replaced by a star.
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border bg-bg/40 px-3 py-2 ${isGold ? 'border-gold/50' : 'border-border'} ${soon ? 'animate-soon' : ''}`}
    >
      <div className='min-w-0'>
        <div className={`truncate text-xs font-medium ${isGold ? 'text-gold' : ''}`}>{NODE_LABELS[node.id]}</div>
        {isGold ? (
          <div className='text-tier-gold'>
            {isAuto ? <Sparkles size={12} aria-label='auto-gold' /> : <Star size={12} fill='currentColor' aria-label='gold' />}
          </div>
        ) : (
          <div className='text-xs tabular-nums text-muted'>
            {node.pity}/{HARD_PITY}
          </div>
        )}
      </div>
      {!isAuto && (
        <button
          type='button'
          onClick={() => onToggleLock(node.id, !node.locked)}
          aria-pressed={node.locked}
          aria-label={node.locked ? `Unlock ${NODE_LABELS[node.id]}` : `Lock ${NODE_LABELS[node.id]}`}
          className={`shrink-0 rounded-md border p-1.5 transition-colors ${
            node.locked
              ? 'border-gold/60 bg-gold/25 text-gold hover:bg-gold/30'
              : 'border-border bg-surface-hover text-fg hover:border-gold/40 hover:bg-gold/15 hover:text-gold'
          }`}
        >
          {node.locked ? <Lock size={13} /> : <LockOpen size={13} />}
        </button>
      )}
    </div>
  );
}

export function CurrentStateBar({ totalRolls, totalStones, nextCost, nodes, onToggleLock, onUnlock, onRecordRoll, onRevert, onReset }: Props) {
  const nextUnlock = nextUnlockableNodeId(nodes);
  return (
    <section className='flex flex-col gap-4 rounded-xl border border-border bg-surface p-4'>
      <div className='grid grid-cols-3 gap-2'>
        <Stat icon={<Dices size={18} />} label='Total rolls' value={totalRolls} />
        <Stat icon={<Coins size={18} />} label='Stones spent' value={totalStones} />
        <Stat icon={<Tag size={18} />} label='Roll Cost' value={`${nextCost}`} />
      </div>

      <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'>
        {nodes.map((node) => (
          <NodeChip key={node.id} node={node} isNextUnlock={node.id === nextUnlock} onToggleLock={onToggleLock} onUnlock={onUnlock} />
        ))}
      </div>

      <div className='flex flex-wrap gap-2'>
        <button
          type='button'
          onClick={onRecordRoll}
          className='inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-bg transition-opacity hover:opacity-90'
        >
          <Dices size={16} /> Add Rolls
        </button>
        <button
          type='button'
          onClick={onRevert}
          className='inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-hover'
        >
          <RotateCcw size={16} /> Restore Plan
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
