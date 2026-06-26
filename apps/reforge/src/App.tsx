import { CurrentStateBar } from '@/components/CurrentStateBar';
import { GoldStats } from '@/components/GoldStats';
import { Legend } from '@/components/Legend';
import { MilestoneTable } from '@/components/MilestoneTable';
import { RevertMilestoneForm } from '@/components/RevertMilestoneForm';
import { RollMilestoneForm } from '@/components/RollMilestoneForm';
import { SessionBar } from '@/components/SessionBar';
import { useReforgeSession } from '@/hooks/useReforgeSession';
import { createInitialNodes } from '@/lib/engine';
import type { MilestoneInput } from '@/types/reforge';
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

  function openEditLatest() {
    // Lock and unlock rows are not editable (they carry no roll/revert data).
    if (!latest || latest.input.type === 'lock' || latest.input.type === 'unlock') return;
    setForm({ kind: latest.input.type, edit: true });
  }

  function handleReset() {
    if (window.confirm("Clear this session's milestones and start over? Other sessions are kept.")) {
      setForm(null);
      session.reset();
    }
  }

  // Switching, creating, or deleting a session changes the state a form operates
  // against, so close any open form first to avoid applying it to the wrong session.
  function handleSwitchSession(id: string) {
    setForm(null);
    session.switchSession(id);
  }

  function handleCreateSession() {
    setForm(null);
    session.createSession();
  }

  function handleDeleteSession(id: string) {
    setForm(null);
    session.deleteSession(id);
  }

  function handleImportSession(name: string, inputs: MilestoneInput[]) {
    setForm(null);
    session.importSession(name, inputs);
  }

  const rollInitial =
    form?.kind === 'roll' && form.edit && latest?.input.type === 'roll' ? { rolls: latest.input.rolls, goldHits: latest.input.goldHits } : undefined;

  const revertInitial = form?.kind === 'revert' && form.edit && latest?.input.type === 'revert' ? latest.input.nodes : undefined;

  return (
    <div className='mx-auto flex max-w-[96rem] flex-col gap-6 px-4 py-8'>
      <header>
        <h1 className='flex items-center gap-2 text-2xl font-bold text-gold'>
          <Hammer size={24} className='animate-hammer' /> Reforge Pity Tracker
        </h1>
      </header>

      <div className='flex flex-col gap-6 lg:flex-row'>
        {/* Center: the live tracker. min-w-0 lets the table scroll inside the flex row. */}
        <div className='flex min-w-0 flex-1 flex-col gap-6'>
          <SessionBar
            sessions={session.sessions}
            activeSessionId={session.activeSessionId}
            onSwitch={handleSwitchSession}
            onCreate={handleCreateSession}
            onRename={session.renameSession}
            onDelete={handleDeleteSession}
            onImport={handleImportSession}
          />

          <CurrentStateBar
            totalRolls={session.totalRolls}
            totalStones={session.totalStones}
            nextCost={session.nextCost}
            nodes={nodes}
            onToggleLock={session.addLock}
            onUnlock={session.addUnlock}
            onRecordRoll={() => setForm({ kind: 'roll', edit: false })}
            onRevert={() => setForm({ kind: 'revert', edit: false })}
            onReset={handleReset}
          />

          {form?.kind === 'roll' && (
            <RollMilestoneForm
              nodes={formBaseNodes}
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
        </div>

        {/* Left on desktop (order-first), below the tracker on mobile. self-start keeps it sticky-able. */}
        <aside className='lg:order-first lg:sticky lg:top-8 lg:w-60 lg:shrink-0 lg:self-start'>
          <Legend />
        </aside>

        {/* Right on desktop (order-last), bottom on mobile. */}
        <aside className='lg:order-last lg:sticky lg:top-8 lg:w-64 lg:shrink-0 lg:self-start'>
          <GoldStats milestones={milestones} />
        </aside>
      </div>

      <footer className='pt-2 text-center text-xs text-muted'>
        Saved locally in your browser. Unofficial fan tool, not affiliated with Everstone Studios.
      </footer>
    </div>
  );
}
