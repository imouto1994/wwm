import { useEffect, useState } from 'react';

/**
 * Hidden Edit Mode toggle, activated with Alt/Option+P (no visible entry point).
 *
 * Kept as its own hook so the keyboard listener stays out of useLoadout -
 * edit mode is orthogonal to the host/viewer split and shouldn't couple to
 * loadout state. The listener ignores the shortcut when the user is typing
 * in an input/textarea so it can't fire while copying the share URL.
 *
 * Match on `event.code` (`KeyP`), not `event.key`. On macOS, Option+P
 * inserts "π", so `event.key` is "π" rather than "p" and a key-based check
 * never fires.
 */
export function useEditMode(): { isEditMode: boolean } {
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.code !== 'KeyP') return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }

      event.preventDefault();
      setIsEditMode((prev) => !prev);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { isEditMode };
}
