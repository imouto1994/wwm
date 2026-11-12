import { fetchTournament } from '@/lib/apiClient';
import type { Tournament } from '@/types/tournament';
import { useEffect, useState } from 'react';

const POLL_MS = 4000;

export type FeedStatus = 'loading' | 'live' | 'offline';

interface FeedState {
  tournament: Tournament | null;
  status: FeedStatus;
  /** When the last successful read finished (ms since epoch). */
  updatedAt: number | null;
}

/**
 * Viewer polling. Reads the public, CDN-cached state every 4 seconds while
 * the tab is visible and pauses in background tabs. On a failed read it keeps
 * showing the last good state and reports "offline" until the next success.
 */
export function useTournamentFeed(): FeedState {
  const [state, setState] = useState<FeedState>({ tournament: null, status: 'loading', updatedAt: null });

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;

    const poll = async () => {
      window.clearTimeout(timer);
      if (document.visibilityState === 'visible') {
        controller?.abort();
        controller = new AbortController();
        try {
          const tournament = await fetchTournament({ signal: controller.signal });
          if (!cancelled) setState({ tournament, status: 'live', updatedAt: Date.now() });
        } catch (error) {
          if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
            setState((previous) => ({ ...previous, status: 'offline' }));
          }
        }
      }
      if (!cancelled) timer = window.setTimeout(poll, POLL_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void poll();
    };

    void poll();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return state;
}
