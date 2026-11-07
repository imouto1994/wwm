import { SKILLS } from '@/data/skills';
import { WEAPONS } from '@/data/weapons';
import { replaceSkill, replaceWeapon, type WeaponSlot } from '@/lib/editLoadout';
import { randomizeLoadout } from '@/lib/randomize';
import { buildShareUrl, decodeLoadout, encodeLoadout } from '@/lib/shareLink';
import type { LoadoutResult } from '@/types/randomizer';
import { useCallback, useState } from 'react';

interface LoadoutState {
  loadout: LoadoutResult | null;
  // Fixed once at mount from whether the URL already had a valid, decodable
  // loadout - never re-evaluated afterward. A page load is either "fresh"
  // (host mode) or "a shared result" (viewer mode) for its whole lifetime.
  // See docs/speedrun-app.md, "Host vs. viewer mode".
  isViewerMode: boolean;
}

function initLoadoutState(): LoadoutState {
  if (typeof window === 'undefined') return { loadout: null, isViewerMode: false };
  const decoded = decodeLoadout(new URLSearchParams(window.location.search), WEAPONS, SKILLS);
  return { loadout: decoded, isViewerMode: decoded !== null };
}

// Mirrors a loadout into the address bar the same way randomize() does, so a
// manual edit and a re-roll leave the URL in the same shape. Shared so the
// two mutation paths can't drift.
function syncUrl(loadout: LoadoutResult): void {
  if (typeof window === 'undefined') return;
  const params = encodeLoadout(loadout);
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

interface UseLoadoutResult {
  loadout: LoadoutResult | null;
  isViewerMode: boolean;
  shareUrl: string | null;
  error: string | null;
  randomize: () => void;
  setWeapon: (slot: WeaponSlot, weaponId: string) => void;
  setSkill: (currentSkillId: string, newSkillId: string) => void;
}

/**
 * Owns the current loadout and the host/viewer mode split.
 *
 * Host mode: `randomize()` computes a new loadout, stores it in React state,
 * and mirrors it into the address bar via `history.replaceState` (not
 * `pushState` - rerolling for the next participant should not pile up
 * browser-history entries). Because this is a `replaceState`, a page refresh
 * always re-decodes to exactly what's on screen.
 *
 * Viewer mode: `randomize()` is a no-op guard (the UI never wires up a
 * Randomize button in this mode anyway, but the hook stays safe either way).
 * Manual edits via `setWeapon`/`setSkill` (Edit Mode) ARE allowed in viewer
 * mode - Alt+P is a hidden host feature that works on any already-loaded
 * result, including a shared link the host themselves opened.
 */
export function useLoadout(): UseLoadoutResult {
  const [state, setState] = useState<LoadoutState>(initLoadoutState);
  const [error, setError] = useState<string | null>(null);

  const randomize = useCallback(() => {
    setState((prev) => {
      if (prev.isViewerMode) return prev;
      try {
        const next = randomizeLoadout(WEAPONS, SKILLS);
        syncUrl(next);
        setError(null);
        return { ...prev, loadout: next };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong while randomizing.');
        return prev;
      }
    });
  }, []);

  // Manual slot edits (Edit Mode). Unlike randomize(), these are allowed in
  // viewer mode so a host who opened their own shared link can still tweak
  // it. Invalid replacements (unknown id, duplicate weapon/skill) are no-ops
  // - replaceWeapon/replaceSkill already return null for those cases.
  const setWeapon = useCallback((slot: WeaponSlot, weaponId: string) => {
    setState((prev) => {
      if (!prev.loadout) return prev;
      const next = replaceWeapon(prev.loadout, slot, weaponId, WEAPONS);
      if (!next) return prev;
      syncUrl(next);
      setError(null);
      return { ...prev, loadout: next };
    });
  }, []);

  const setSkill = useCallback((currentSkillId: string, newSkillId: string) => {
    setState((prev) => {
      if (!prev.loadout) return prev;
      const next = replaceSkill(prev.loadout, currentSkillId, newSkillId, SKILLS);
      if (!next) return prev;
      syncUrl(next);
      setError(null);
      return { ...prev, loadout: next };
    });
  }, []);

  const shareUrl = state.loadout && typeof window !== 'undefined' ? buildShareUrl(state.loadout, window.location.origin, window.location.pathname) : null;

  return {
    loadout: state.loadout,
    isViewerMode: state.isViewerMode,
    shareUrl,
    error,
    randomize,
    setWeapon,
    setSkill,
  };
}
