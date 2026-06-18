import { NODE_LABELS } from '@/lib/constants';
import { lockableNodes } from '@/lib/engine';
import type { NodeSnapshot, RevertNodeInput } from '@/types/reforge';
/**
 * Form to record a revert milestone. Reverting to a saved look resets ALL pity
 * to 0; the user just tells us, per enabled node, whether it is gold and whether
 * it is locked. No variant is captured - this is a pity tracker. Doubles as the
 * edit form for the latest revert milestone via `initial`.
 */
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';

interface Props {
  nodes: NodeSnapshot[];
  initial?: RevertNodeInput[];
  onSubmit: (nodes: RevertNodeInput[]) => void;
  onCancel: () => void;
}

interface Draft {
  gold: boolean;
  locked: boolean;
}

export function RevertMilestoneForm({ nodes, initial, onSubmit, onCancel }: Props) {
  const editable = lockableNodes(nodes); // enabled, non-Node-5 nodes
  const [draft, setDraft] = useState<Record<number, Draft>>(() => {
    const initialMap = new Map((initial ?? []).map((n) => [n.id, n]));
    const result: Record<number, Draft> = {};
    for (const node of editable) {
      const seed = initialMap.get(node.id);
      // Default to the current look so a revert to "now" is one click away.
      result[node.id] = seed ? { gold: seed.gold, locked: seed.locked } : { gold: node.tier === 'gold', locked: node.locked };
    }
    return result;
  });

  const update = (id: number, patch: Partial<Draft>) => setDraft((d) => ({ ...d, [id]: { ...(d[id] ?? { gold: false, locked: false }), ...patch } }));

  function handleSubmit() {
    const revertNodes: RevertNodeInput[] = editable.map((node) => ({
      id: node.id,
      gold: draft[node.id]?.gold ?? false,
      locked: draft[node.id]?.locked ?? false,
    }));
    onSubmit(revertNodes);
  }

  return (
    <form
      className='flex flex-col gap-4 rounded-xl border border-gold/40 bg-surface p-4'
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <h2 className='font-semibold text-gold'>{initial ? 'Edit restore' : 'Restore a saved plan'}</h2>
      <p className='text-xs text-muted'>
        Restoring a plan resets every node's pity to 0. Set each node's gold/lock state for the look you rolled back to. Stones spent and total rolls are kept.
      </p>

      <div className='flex flex-col gap-2'>
        {editable.map((node) => {
          const d = draft[node.id] ?? { gold: false, locked: false };
          return (
            <div key={node.id} className='flex flex-wrap items-center gap-4 rounded-lg border border-border bg-bg/40 px-3 py-2'>
              <span className='min-w-24 font-medium'>{NODE_LABELS[node.id]}</span>
              <label className='flex items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  checked={d.gold}
                  onChange={(e) => update(node.id, { gold: e.target.checked })}
                  className='size-4 accent-[var(--color-gold)]'
                />
                Gold
              </label>
              <label className='flex items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  checked={d.locked}
                  onChange={(e) => update(node.id, { locked: e.target.checked })}
                  className='size-4 accent-[var(--color-gold)]'
                />
                Locked
              </label>
            </div>
          );
        })}
        {editable.length === 0 && <p className='text-sm text-muted'>No enabled nodes to set yet.</p>}
      </div>

      <div className='flex gap-2'>
        <button
          type='submit'
          className='inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 font-semibold text-bg transition-opacity hover:opacity-90'
        >
          <RotateCcw size={16} /> {initial ? 'Save' : 'Restore Plan'}
        </button>
        <button type='button' onClick={onCancel} className='rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-hover'>
          Cancel
        </button>
      </div>
    </form>
  );
}
