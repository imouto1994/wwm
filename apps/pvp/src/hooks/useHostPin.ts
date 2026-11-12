import { useCallback, useState } from 'react';

const STORAGE_KEY = 'wwm-pvp-host-pin';

function readPin(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * The host PIN for this tab. Session storage (not local storage) so it is
 * forgotten when the tab closes and never lingers on a shared computer.
 */
export function useHostPin() {
  const [pin, setPinState] = useState<string | null>(readPin);

  const setPin = useCallback((next: string) => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode can block storage; the PIN still works for this page load.
    }
    setPinState(next);
  }, []);

  const clearPin = useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up.
    }
    setPinState(null);
  }, []);

  return { pin, setPin, clearPin };
}
