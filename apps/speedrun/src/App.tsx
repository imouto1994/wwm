import { LoadoutResult } from '@/components/LoadoutResult';
import { RandomizeButton } from '@/components/RandomizeButton';
import { ShareLink } from '@/components/ShareLink';
import { useLoadout } from '@/hooks/useLoadout';
/**
 * Speedrun Loadout Randomizer.
 *
 * Host mode (opened the bare URL): click Randomize to draw a DPS weapon, a
 * 2nd (different) weapon, and 8 unique mystic skills; the result and its
 * shareable URL stay on screen, and Randomize can be clicked again for each
 * next participant.
 *
 * Viewer mode (opened a URL that already decoded a valid result): read-only
 * - no Randomize button, just the shared result plus a link to start a fresh
 * (host-mode) run. Mode is fixed for the page's whole lifetime; see
 * useLoadout and docs/speedrun-app.md.
 */
import { Swords } from 'lucide-react';

export default function App() {
  const { loadout, isViewerMode, shareUrl, error, randomize } = useLoadout();

  return (
    <div className='mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8'>
      <header>
        <h1 className='flex items-center gap-2 text-2xl font-bold text-gold'>
          <Swords size={24} /> Speedrun Loadout Randomizer
        </h1>
        <p className='mt-1 text-sm text-muted'>Randomize a DPS weapon, a second weapon, and 8 mystic skills for the guild speedrun event.</p>
      </header>

      {isViewerMode && (
        <div className='rounded-lg border border-gold/40 bg-surface px-4 py-3 text-sm text-fg'>
          You're viewing a shared result.{' '}
          <a href={window.location.pathname} className='font-semibold text-gold underline'>
            Start a new randomization
          </a>
          .
        </div>
      )}

      {error && <div className='rounded-lg border border-red/40 bg-surface px-4 py-3 text-sm text-red'>{error}</div>}

      {!isViewerMode && <RandomizeButton hasResult={loadout !== null} onClick={randomize} />}

      {loadout && <LoadoutResult loadout={loadout} />}

      {!isViewerMode && !loadout && !error && <p className='text-muted'>Click Randomize to draw a DPS weapon, a second weapon, and 8 mystic skills.</p>}

      {!isViewerMode && shareUrl && <ShareLink url={shareUrl} />}

      <footer className='pt-2 text-center text-xs text-muted'>
        Unofficial fan tool for the Where Winds Meet guild, not affiliated with Everstone Studios.
      </footer>
    </div>
  );
}
