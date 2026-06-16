import { CurrentStateBar } from '@/components/CurrentStateBar';
import { MilestoneTable } from '@/components/MilestoneTable';
import { RevertMilestoneForm } from '@/components/RevertMilestoneForm';
import { RollMilestoneForm } from '@/components/RollMilestoneForm';
import { useReforgeSession } from '@/hooks/useReforgeSession';
import { createInitialNodes } from '@/lib/engine';
/**
 * Reforge Pity Tracker - milestone log.
 *
 * The user records a milestone each time nodes turn gold (rolls-since + which
 * nodes), locks/unlocks a node, or reverts. The full per-node table is derived
 * from those milestone inputs. App orchestrates the current-state header, the
 * (add/edit) milestone forms, and the milestone table.
 */
import { Hammer } from 'lucide-react';
import { useState } from 'react';

type FormState = { kind: 'roll' | 'revert'; edit: boolean } | null;

export default function App() {
  const session = useReforgeSession();
  const { milestones, nodes } = session;
  const latest = milestones.length > 0 ? milestones[milestones.length - 1] : null;

  const [form, setForm] = useState<FormState>(null);

  // The state a form operates against. When adding, that is the current state
  // (after the last milestone). When editing the latest, it is the state going
  // INTO that milestone (the milestone before it) so its gold/lock options match.
  const prevMilestone = milestones.length >= 2 ? milestones[milestones.length - 2] : null;
  const formBaseNodes = form?.edit ? (prevMilestone ? prevMilestone.nodes : createInitialNodes()) : nodes;
  // Cumulative rolls going into the segment the form edits/adds (drives the
  // form's "which nodes unlock within these rolls" detection).
  const formBaseRolls = form?.edit ? (prevMilestone ? prevMilestone.cumulativeRolls : 0) : session.totalRolls;

  function openEditLatest() {
    if (!latest || latest.input.type === 'lock') return;
    setForm({ kind: latest.input.type, edit: true });
  }

  function handleReset() {
    if (window.confirm('Clear the whole session and start over?')) {
      setForm(null);
      session.reset();
    }
  }

  const rollInitial =
    form?.kind === 'roll' && form.edit && latest?.input.type === 'roll' ? { rolls: latest.input.rolls, goldHits: latest.input.goldHits } : undefined;

  const revertInitial = form?.kind === 'revert' && form.edit && latest?.input.type === 'revert' ? latest.input.nodes : undefined;

  return (
    <div className='mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8'>
      <header className='flex flex-col gap-1'>
        <h1 className='flex items-center gap-2 text-2xl font-bold text-gold'>
          <Hammer size={24} /> Reforge Pity Tracker
        </h1>
        <p className='text-sm text-muted'>
          Where Winds Meet &mdash; log a milestone whenever a node turns gold; the table tracks pity, locks, and stones across all five nodes.
        </p>
      </header>

      <CurrentStateBar
        totalRolls={session.totalRolls}
        totalStones={session.totalStones}
        nextCost={session.nextCost}
        nodes={nodes}
        onToggleLock={session.addLock}
        onRecordRoll={() => setForm({ kind: 'roll', edit: false })}
        onRevert={() => setForm({ kind: 'revert', edit: false })}
        onReset={handleReset}
      />

      {form?.kind === 'roll' && (
        <RollMilestoneForm
          nodes={formBaseNodes}
          baseRolls={formBaseRolls}
          initial={rollInitial}
          onSubmit={(rolls, goldHits) => {
            if (form.edit) session.editLatest({ id: '', type: 'roll', rolls, goldHits });
            else session.addRoll(rolls, goldHits);
            setForm(null);
          }}
          onCancel={() => setForm(null)}
        />
      )}

      {form?.kind === 'revert' && (
        <RevertMilestoneForm
          nodes={formBaseNodes}
          initial={revertInitial}
          onSubmit={(revertNodes) => {
            if (form.edit) session.editLatest({ id: '', type: 'revert', nodes: revertNodes });
            else session.addRevert(revertNodes);
            setForm(null);
          }}
          onCancel={() => setForm(null)}
        />
      )}

      <MilestoneTable milestones={milestones} onEditLatest={openEditLatest} onDeleteLatest={session.deleteLatest} />

      <footer className='pt-2 text-center text-xs text-muted'>
        Saved locally in your browser. Unofficial fan tool, not affiliated with Everstone Studios.
      </footer>
    </div>
  );
}
