import { UnauthorizedError, fetchTournament, saveTournament } from '@/lib/apiClient';
import { type Action, applyAction, createEmptyTournament } from '@/lib/reducer';
import type { Tournament } from '@/types/tournament';
import { useCallback, useEffect, useRef, useState } from 'react';

export type LoadStatus = 'loading' | 'ready' | 'unauthorized' | 'error';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved';

export interface HostMessage {
  tone: 'error' | 'info';
  text: string;
}

// Draws (groups, ties) must be unpredictable on the night; Math.random is fine
// in principle, but crypto makes "the host rigged the draw" a non-question.
function cryptoRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/**
 * Owns the host's copy of the tournament.
 *
 * Every action runs through the pure reducer locally first, so the screen
 * updates instantly, then the whole document is saved with the version it
 * was based on. Saves are serialized: changes made while a save is in flight
 * are sent right after it, against the new version. A 409 means another tab
 * saved first; the newer state replaces ours and the host is told to redo the
 * last change. Network failures keep the local state and offer a retry.
 */
export function useHostTournament(pin: string | null) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [message, setMessage] = useState<HostMessage | null>(null);

  const latest = useRef<Tournament | null>(null);
  const serverVersion = useRef(0);
  const saving = useRef(false);
  const pendingAgain = useRef(false);

  const show = useCallback((next: Tournament) => {
    latest.current = next;
    setTournament(next);
  }, []);

  const load = useCallback(async () => {
    if (!pin) return;
    setLoadStatus('loading');
    try {
      const stored = await fetchTournament({ pin });
      serverVersion.current = stored?.version ?? 0;
      show(stored ?? createEmptyTournament());
      setLoadStatus('ready');
      setSaveStatus('idle');
    } catch (error) {
      setLoadStatus(error instanceof UnauthorizedError ? 'unauthorized' : 'error');
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load the tournament.' });
    }
  }, [pin, show]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async () => {
    if (!pin) return;
    if (saving.current) {
      pendingAgain.current = true;
      return;
    }
    saving.current = true;
    try {
      do {
        pendingAgain.current = false;
        const snapshot = latest.current;
        if (!snapshot) break;
        setSaveStatus('saving');
        const outcome = await saveTournament(snapshot, serverVersion.current, pin);
        if (outcome.ok) {
          serverVersion.current = outcome.tournament.version;
          // Only adopt the server copy if nothing changed locally meanwhile; otherwise the loop saves again.
          if (latest.current === snapshot) show(outcome.tournament);
          setSaveStatus('saved');
        } else if (outcome.kind === 'conflict') {
          const newer = outcome.tournament ?? createEmptyTournament();
          serverVersion.current = newer.version;
          show(newer);
          setSaveStatus('saved');
          setMessage({ tone: 'error', text: 'Another tab saved a newer version, so it was loaded here. Please redo your last change.' });
          break;
        } else {
          setSaveStatus('unsaved');
          setMessage({ tone: 'error', text: outcome.message });
          if (outcome.kind === 'unauthorized') setLoadStatus('unauthorized');
          break;
        }
      } while (pendingAgain.current);
    } finally {
      saving.current = false;
    }
  }, [pin, show]);

  /** Applies an action locally and saves it. Returns false (and shows why) if the rules reject it. */
  const dispatch = useCallback(
    (action: Action): boolean => {
      const current = latest.current;
      if (!current) return false;
      const result = applyAction(current, action, { now: new Date().toISOString(), random: cryptoRandom });
      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error });
        return false;
      }
      show(result.value);
      setMessage(null);
      void persist();
      return true;
    },
    [persist, show]
  );

  /** Replaces the whole document (restore from history) and saves it as the newest version. */
  const replace = useCallback(
    (next: Tournament) => {
      show(next);
      setMessage({ tone: 'info', text: 'Restored. The restored state is now the latest version.' });
      void persist();
    },
    [persist, show]
  );

  return {
    tournament,
    loadStatus,
    saveStatus,
    message,
    dismissMessage: () => setMessage(null),
    dispatch,
    replace,
    retry: () => void persist(),
    reload: () => void load(),
  };
}

export type HostController = ReturnType<typeof useHostTournament>;
