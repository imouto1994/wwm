/**
 * localStorage persistence for the session.
 *
 * Only the milestone *inputs* are stored (the table is derived via replay). The
 * payload is gated by a `version` field; anything that does not match the
 * current version - including the previous per-roll v1 schema - is treated as
 * empty so we never feed a stale shape into the engine.
 */
import type { PersistedState } from '@/types/reforge';

// New key for the v2 schema; the old `wwm-reforge:v1` payload is simply ignored.
const STORAGE_KEY = 'wwm-reforge';
const VERSION = 2 as const;

function emptyState(): PersistedState {
  return { version: VERSION, inputs: [] };
}

// In-memory fallback used when localStorage is unavailable (e.g. private mode).
let memoryFallback: PersistedState | null = null;

// Earlier builds stored roll `goldHits` as objects ({ id, variant }); the variant
// has since been dropped, so coerce any legacy entries to plain node ids. This
// preserves an in-progress session across that schema change without a version bump.
function normalizeInputs(inputs: unknown): PersistedState['inputs'] {
  if (!Array.isArray(inputs)) return [];
  return inputs.map((input) => {
    if (input?.type === 'roll' && Array.isArray(input.goldHits)) {
      const goldHits = input.goldHits
        .map((h: unknown) => (typeof h === 'number' ? h : (h as { id?: number })?.id))
        .filter((id: unknown) => typeof id === 'number');
      return { ...input, goldHits };
    }
    return input;
  });
}

function storageAvailable(): boolean {
  try {
    const probe = '__wwm_reforge_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function loadState(): PersistedState {
  if (!storageAvailable()) {
    return memoryFallback ?? emptyState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as PersistedState;
    // Reset on a version mismatch or a malformed payload.
    if (parsed.version !== VERSION || !Array.isArray(parsed.inputs)) return emptyState();
    return { version: VERSION, inputs: normalizeInputs(parsed.inputs) };
  } catch {
    return emptyState();
  }
}

export function saveState(state: PersistedState): void {
  if (!storageAvailable()) {
    memoryFallback = state;
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    memoryFallback = state;
  }
}
