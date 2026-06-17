import { currentNodes, nextRollCost, replay } from '@/lib/engine';
import { uid } from '@/lib/id';
import { loadState, saveState } from '@/lib/storage';
import type { MilestoneInput, NodeId, RevertNodeInput, Session } from '@/types/reforge';
/**
 * Session state hook.
 *
 * Holds every saved session plus the active one's id. Milestone actions operate
 * on the *active* session's inputs; session actions (create/switch/rename/delete)
 * manage the list. The active session's milestone table is derived via `replay`
 * and the whole list is persisted to localStorage. Within a session only the
 * latest milestone can be edited or deleted, so every milestone mutation stays a
 * trivial list operation followed by a re-replay.
 */
import { useCallback, useEffect, useMemo, useReducer } from 'react';

interface State {
  sessions: Session[];
  activeSessionId: string;
}

type Action =
  | { type: 'addRoll'; rolls: number; goldHits: NodeId[] }
  | { type: 'addLock'; nodeId: NodeId; locked: boolean }
  | { type: 'addRevert'; nodes: RevertNodeInput[] }
  | { type: 'editLatest'; input: MilestoneInput }
  | { type: 'deleteLatest' }
  | { type: 'reset' }
  | { type: 'createSession'; name?: string }
  | { type: 'importSession'; name: string; inputs: MilestoneInput[] }
  | { type: 'switchSession'; id: string }
  | { type: 'renameSession'; id: string; name: string }
  | { type: 'deleteSession'; id: string };

// Next "Session N" name: one past the highest existing numbered session, so it
// stays unique even after deletions (a length-based name would collide, e.g.
// deleting "Session 1" of [1,2] then creating would re-make "Session 2").
export function nextSessionName(sessions: Session[]): string {
  let max = 0;
  for (const s of sessions) {
    const match = /^Session (\d+)$/.exec(s.name.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `Session ${max + 1}`;
}

// Apply a change to the active session's inputs, leaving every other session
// (and crucially their `inputs` array identity) untouched so unrelated replays
// are not invalidated.
function updateActiveInputs(state: State, fn: (inputs: MilestoneInput[]) => MilestoneInput[]): State {
  return {
    ...state,
    sessions: state.sessions.map((s) => (s.id === state.activeSessionId ? { ...s, inputs: fn(s.inputs) } : s)),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addRoll':
      return updateActiveInputs(state, (inputs) => [...inputs, { id: uid(), type: 'roll', rolls: action.rolls, goldHits: action.goldHits }]);
    case 'addLock':
      return updateActiveInputs(state, (inputs) => [...inputs, { id: uid(), type: 'lock', nodeId: action.nodeId, locked: action.locked }]);
    case 'addRevert':
      return updateActiveInputs(state, (inputs) => [...inputs, { id: uid(), type: 'revert', nodes: action.nodes }]);
    case 'editLatest':
      return updateActiveInputs(state, (inputs) => {
        if (inputs.length === 0) return inputs;
        // Preserve the latest input's id so it stays the "same" milestone.
        const latestId = inputs[inputs.length - 1].id;
        return [...inputs.slice(0, -1), { ...action.input, id: latestId }];
      });
    case 'deleteLatest':
      return updateActiveInputs(state, (inputs) => (inputs.length === 0 ? inputs : inputs.slice(0, -1)));
    case 'reset':
      // Clear the active session's milestones but keep the session itself.
      return updateActiveInputs(state, () => []);
    case 'createSession': {
      const session: Session = { id: uid(), name: action.name?.trim() || nextSessionName(state.sessions), inputs: [] };
      return { sessions: [...state.sessions, session], activeSessionId: session.id };
    }
    case 'importSession': {
      // Inputs are already sanitized by sessionIo; mint a fresh id and switch to it.
      const session: Session = { id: uid(), name: action.name.trim() || nextSessionName(state.sessions), inputs: action.inputs };
      return { sessions: [...state.sessions, session], activeSessionId: session.id };
    }
    case 'switchSession':
      return state.sessions.some((s) => s.id === action.id) ? { ...state, activeSessionId: action.id } : state;
    case 'renameSession': {
      const name = action.name.trim();
      if (!name || !state.sessions.some((s) => s.id === action.id)) return state;
      return { ...state, sessions: state.sessions.map((s) => (s.id === action.id ? { ...s, name } : s)) };
    }
    case 'deleteSession': {
      const idx = state.sessions.findIndex((s) => s.id === action.id);
      if (idx === -1) return state;
      const remaining = state.sessions.filter((s) => s.id !== action.id);
      // Never leave the app without a session to show.
      if (remaining.length === 0) {
        const fresh: Session = { id: uid(), name: nextSessionName([]), inputs: [] };
        return { sessions: [fresh], activeSessionId: fresh.id };
      }
      // If the active session was deleted, activate its neighbor (previous index,
      // clamped to the new bounds).
      const activeSessionId = action.id === state.activeSessionId ? remaining[Math.min(idx, remaining.length - 1)].id : state.activeSessionId;
      return { sessions: remaining, activeSessionId };
    }
    default:
      return state;
  }
}

function init(): State {
  const { sessions, activeSessionId } = loadState();
  return { sessions, activeSessionId };
}

export function useReforgeSession() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Persist the whole session list on every change; derived tables are not stored.
  // The first run also writes back any v2 -> v3 migration done on load.
  useEffect(() => {
    saveState({ version: 3, sessions: state.sessions, activeSessionId: state.activeSessionId });
  }, [state.sessions, state.activeSessionId]);

  // The reducer guarantees a non-empty list and a resolvable id, but fall back to
  // the first session defensively so the rest of the hook never sees undefined.
  const active = state.sessions.find((s) => s.id === state.activeSessionId) ?? state.sessions[0];

  // Only the active session's inputs feed replay; switching changes this array by
  // reference (recompute), while renaming another session does not.
  const milestones = useMemo(() => replay(active.inputs), [active.inputs]);
  const nodes = useMemo(() => currentNodes(milestones), [milestones]);
  const latest = milestones.length > 0 ? milestones[milestones.length - 1] : null;

  return {
    sessions: state.sessions,
    activeSessionId: active.id,
    milestones,
    nodes,
    totalRolls: latest?.cumulativeRolls ?? 0,
    totalStones: latest?.cumulativeStones ?? 0,
    nextCost: nextRollCost(nodes),
    canEditLatest: active.inputs.length > 0,
    latestType: latest?.input.type ?? null,
    addRoll: useCallback((rolls: number, goldHits: NodeId[]) => dispatch({ type: 'addRoll', rolls, goldHits }), []),
    addLock: useCallback((nodeId: NodeId, locked: boolean) => dispatch({ type: 'addLock', nodeId, locked }), []),
    addRevert: useCallback((revertNodes: RevertNodeInput[]) => dispatch({ type: 'addRevert', nodes: revertNodes }), []),
    editLatest: useCallback((input: MilestoneInput) => dispatch({ type: 'editLatest', input }), []),
    deleteLatest: useCallback(() => dispatch({ type: 'deleteLatest' }), []),
    reset: useCallback(() => dispatch({ type: 'reset' }), []),
    createSession: useCallback((name?: string) => dispatch({ type: 'createSession', name }), []),
    importSession: useCallback((name: string, inputs: MilestoneInput[]) => dispatch({ type: 'importSession', name, inputs }), []),
    switchSession: useCallback((id: string) => dispatch({ type: 'switchSession', id }), []),
    renameSession: useCallback((id: string, name: string) => dispatch({ type: 'renameSession', id, name }), []),
    deleteSession: useCallback((id: string) => dispatch({ type: 'deleteSession', id }), []),
  };
}
