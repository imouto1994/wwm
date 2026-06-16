import { NODE_LABELS, UNLOCK_ROLLS } from '@/lib/constants';
import { lockedRollableCount, rollCost, rollableAfter } from '@/lib/engine';
import type { NodeId, NodeSnapshot } from '@/types/reforge';
/**
 * Form to record a roll milestone: how many rolls since the last milestone and
 * which nodes turned gold. Doubles as the edit form for the latest roll
 * milestone via `initial`.
 *
 * The list of tickable nodes is computed from the entered roll count: any
 * rollable, unlocked node that is enabled by the END of the batch is offered -
 * so if the batch is large enough to unlock Node 2/3/4, those appear too and can
 * be marked gold. No variant is asked for; this is a pure pity tracker.
 */
import { Dices } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Props {
  // Node state going into this segment (current state, or the state before the
  // latest milestone when editing).
  nodes: NodeSnapshot[];
  // Cumulative rolls going into this segment (drives mid-batch unlock detection).
  baseRolls: number;
  initial?: { rolls: number; goldHits: NodeId[] };
  onSubmit: (rolls: number, goldHits: NodeId[]) => void;
  onCancel: () => void;
}

export function RollMilestoneForm({ nodes, baseRolls, initial, onSubmit, onCancel }: Props) {
  const cost = rollCost(lockedRollableCount(nodes));
  const lockedLabels = nodes.filter((n) => n.locked).map((n) => NODE_LABELS[n.id]);

  const [rolls, setRolls] = useState<string>(initial ? String(initial.rolls) : '');
  const [gold, setGold] = useState<Record<number, boolean>>(() => {
    const seed: Record<number, boolean> = {};
    for (const id of initial?.goldHits ?? []) seed[id] = true;
    return seed;
  });
  const [error, setError] = useState<string | null>(null);

  const rollsNum = Number(rolls);
  const validRolls = Number.isInteger(rollsNum) && rollsNum > 0;
  const stonesPreview = validRolls ? rollsNum * cost : 0;

  // Tickable nodes depend on the entered rolls (so newly-unlocked nodes appear).
  const tickable = useMemo(() => rollableAfter(nodes, baseRolls + (validRolls ? rollsNum : 0)), [nodes, baseRolls, rollsNum, validRolls]);

  function handleSubmit() {
    if (!validRolls) {
      setError('Enter the number of rolls (at least 1) since the last milestone.');
      return;
    }
    const goldHits = tickable.filter((id) => gold[id]);
    onSubmit(rollsNum, goldHits);
  }

  return (
    <form
      className='flex flex-col gap-4 rounded-xl border border-gold/40 bg-surface p-4'
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <h2 className='font-semibold text-gold'>{initial ? 'Edit roll milestone' : 'Record rolls'}</h2>

      <label className='flex flex-col gap-1 text-sm'>
        <span className='text-muted'>Rolls since last milestone</span>
        <input
          type='number'
          min={1}
          step={1}
          value={rolls}
          onChange={(e) => {
            setRolls(e.target.value);
            setError(null);
          }}
          autoFocus
          className='w-32 rounded-lg border border-border bg-bg/40 px-3 py-2'
        />
      </label>

      <p className='text-xs text-muted'>
        Lock config this segment: {lockedLabels.length ? lockedLabels.join(', ') : 'none locked'} -{' '}
        <span className='text-fg'>
          {cost} stone{cost === 1 ? '' : 's'}/roll
        </span>
        {stonesPreview > 0 && <span> (= {stonesPreview} stones)</span>}. Record a lock milestone first if this is wrong.
      </p>

      {tickable.length > 0 ? (
        <div className='flex flex-col gap-2'>
          <span className='text-xs text-muted'>Tick any node that turned gold during these rolls:</span>
          {tickable.map((id) => {
            // A node enabled only because of the rolls just entered is highlighted.
            const unlocksThisBatch = baseRolls < UNLOCK_ROLLS[id];
            return (
              <label key={id} className='flex items-center gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm'>
                <input
                  type='checkbox'
                  checked={!!gold[id]}
                  onChange={(e) => setGold((g) => ({ ...g, [id]: e.target.checked }))}
                  className='size-4 accent-[var(--color-gold)]'
                />
                <span className='font-medium'>{NODE_LABELS[id]}</span>
                {unlocksThisBatch && <span className='text-xs text-muted'>(unlocks at {UNLOCK_ROLLS[id]} rolls)</span>}
              </label>
            );
          })}
        </div>
      ) : (
        <p className='text-xs text-muted'>No rollable nodes for this segment yet (all enabled nodes are locked).</p>
      )}

      {error && <p className='text-sm text-red'>{error}</p>}

      <div className='flex gap-2'>
        <button
          type='submit'
          className='inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-bg transition-opacity hover:opacity-90'
        >
          <Dices size={16} /> {initial ? 'Save' : 'Add milestone'}
        </button>
        <button type='button' onClick={onCancel} className='rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-hover'>
          Cancel
        </button>
      </div>
    </form>
  );
}
