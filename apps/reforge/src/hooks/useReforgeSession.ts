import { currentNodes, nextRollCost, replay } from '@/lib/engine';
import { loadState, saveState } from '@/lib/storage';
import type { MilestoneInput, NodeId, RevertNodeInput } from '@/types/reforge';
/**
 * Session state hook.
 *
 * Holds the ordered milestone inputs, derives the milestone table via `replay`,
 * and persists the inputs to localStorage. Only the latest milestone can be
 * edited or deleted - that keeps the mental model simple and makes every
 * mutation a trivial list operation followed by a re-replay.
 */
import { useCallback, useEffect, useMemo, useReducer } from 'react';

interface State {
  inputs: MilestoneInput[];
}

type Action =
  | { type: 'addRoll'; rolls: number; goldHits: NodeId[] }
  | { type: 'addLock'; nodeId: NodeId; locked: boolean }
  | { type: 'addRevert'; nodes: RevertNodeInput[] }
  | { type: 'editLatest'; input: MilestoneInput }
  | { type: 'deleteLatest' }
  | { type: 'reset' };

function uid(): string {
  return crypto.randomUUID();
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addRoll':
      return { inputs: [...state.inputs, { id: uid(), type: 'roll', rolls: action.rolls, goldHits: action.goldHits }] };
    case 'addLock':
      return { inputs: [...state.inputs, { id: uid(), type: 'lock', nodeId: action.nodeId, locked: action.locked }] };
    case 'addRevert':
      return { inputs: [...state.inputs, { id: uid(), type: 'revert', nodes: action.nodes }] };
    case 'editLatest': {
      if (state.inputs.length === 0) return state;
      // Preserve the latest input's id so it stays the "same" milestone.
      const latestId = state.inputs[state.inputs.length - 1].id;
      const replacement = { ...action.input, id: latestId };
      return { inputs: [...state.inputs.slice(0, -1), replacement] };
    }
    case 'deleteLatest':
      return state.inputs.length === 0 ? state : { inputs: state.inputs.slice(0, -1) };
    case 'reset':
      return { inputs: [] };
    default:
      return state;
  }
}

function init(): State {
  return { inputs: loadState().inputs };
}

export function useReforgeSession() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Persist inputs on every change; the derived table is never stored.
  useEffect(() => {
    saveState({ version: 2, inputs: state.inputs });
  }, [state.inputs]);

  const milestones = useMemo(() => replay(state.inputs), [state.inputs]);
  const nodes = useMemo(() => currentNodes(milestones), [milestones]);
  const latest = milestones.length > 0 ? milestones[milestones.length - 1] : null;

  return {
    milestones,
    nodes,
    totalRolls: latest?.cumulativeRolls ?? 0,
    totalStones: latest?.cumulativeStones ?? 0,
    nextCost: nextRollCost(nodes),
    canEditLatest: state.inputs.length > 0,
    latestType: latest?.input.type ?? null,
    addRoll: useCallback((rolls: number, goldHits: NodeId[]) => dispatch({ type: 'addRoll', rolls, goldHits }), []),
    addLock: useCallback((nodeId: NodeId, locked: boolean) => dispatch({ type: 'addLock', nodeId, locked }), []),
    addRevert: useCallback((revertNodes: RevertNodeInput[]) => dispatch({ type: 'addRevert', nodes: revertNodes }), []),
    editLatest: useCallback((input: MilestoneInput) => dispatch({ type: 'editLatest', input }), []),
    deleteLatest: useCallback(() => dispatch({ type: 'deleteLatest' }), []),
    reset: useCallback(() => dispatch({ type: 'reset' }), []),
  };
}
