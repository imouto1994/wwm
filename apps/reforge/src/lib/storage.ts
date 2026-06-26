import { uid } from '@/lib/id';
/**
 * localStorage persistence for sessions.
 *
 * Only the milestone *inputs* of each session are stored (every table is derived
 * via replay). The payload is gated by a `version` field and run through
 * `coerceState`, which migrates the older single-session v2 and pre-manual-unlock
 * v3 shapes and repairs or discards anything malformed, so the engine is never
 * fed a stale/invalid shape.
 */
import { synthesizeUnlocks } from '@/lib/migrate';
import type { MilestoneInput, PersistedState, Session } from '@/types/reforge';

// Shared key across schema versions; the payload's `version` disambiguates.
const STORAGE_KEY = 'wwm-reforge';
// v4 added manual `unlock` milestones; v2/v3 are migrated by synthesizing them.
const VERSION = 4 as const;

const DEFAULT_SESSION_NAME = 'Session 1';

function makeSession(name: string, inputs: MilestoneInput[] = []): Session {
  return { id: uid(), name, inputs };
}

// A valid-but-empty state always has exactly one session, so the app never has
// to handle a "no active session" case.
function emptyState(): PersistedState {
  const session = makeSession(DEFAULT_SESSION_NAME);
  return { version: VERSION, sessions: [session], activeSessionId: session.id };
}

// In-memory fallback used when localStorage is unavailable (e.g. private mode).
let memoryFallback: PersistedState | null = null;

// Earlier builds stored roll `goldHits` as objects ({ id, variant }); the variant
// has since been dropped, so coerce any legacy entries to plain node ids. This
// preserves an in-progress session across that schema change without a version bump.
function normalizeInputs(inputs: unknown): MilestoneInput[] {
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

// Coerce one untrusted entry into a valid Session, repairing a missing id/name
// and normalizing its inputs. Returns null if it is not an object at all.
function coerceSession(raw: unknown, index: number): Session | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as { id?: unknown; name?: unknown; inputs?: unknown };
  const id = typeof r.id === 'string' && r.id ? r.id : uid();
  const name = typeof r.name === 'string' && r.name.trim() ? r.name : `Session ${index + 1}`;
  return { id, name, inputs: normalizeInputs(r.inputs) };
}

// A loosely-typed view of a possibly-legacy parsed payload so we can probe
// fields (v2 `inputs`, v3 `sessions`) without fighting the typed shape.
interface RawState {
  version?: unknown;
  inputs?: unknown;
  sessions?: unknown;
  activeSessionId?: unknown;
}

/**
 * Turn an untrusted, possibly-legacy parsed payload into a valid v3 state.
 *
 * Pure (no `window`) so it is unit-testable. Guarantees at least one session and
 * an `activeSessionId` that resolves to a real session. Exported for tests.
 */
export function coerceState(parsed: unknown): PersistedState {
  if (typeof parsed !== 'object' || parsed === null) return emptyState();
  const raw = parsed as RawState;

  // v2 -> v4: wrap the single inputs array into one named session, synthesizing
  // the unlock milestones the old auto-unlock model left implicit.
  if (raw.version === 2) {
    const session = makeSession(DEFAULT_SESSION_NAME, synthesizeUnlocks(normalizeInputs(raw.inputs)));
    return { version: VERSION, sessions: [session], activeSessionId: session.id };
  }

  // v3 (pre-manual-unlock) and v4 share the multi-session shape. v3 inputs lack
  // unlock milestones, so synthesize them per session; v4 is already migrated.
  if (raw.version === 3 || raw.version === VERSION) {
    if (!Array.isArray(raw.sessions)) return emptyState();
    const migrate = raw.version === 3;
    const sessions = raw.sessions
      .map((s, i) => coerceSession(s, i))
      .filter((s): s is Session => s !== null)
      .map((s) => (migrate ? { ...s, inputs: synthesizeUnlocks(s.inputs) } : s));
    if (sessions.length === 0) return emptyState();

    // Defensive: ensure ids are unique so a switch/update targets exactly one
    // session (duplicate ids would otherwise update or match several).
    const seen = new Set<string>();
    for (const s of sessions) {
      if (seen.has(s.id)) s.id = uid();
      seen.add(s.id);
    }

    const active = typeof raw.activeSessionId === 'string' && sessions.some((s) => s.id === raw.activeSessionId) ? raw.activeSessionId : sessions[0].id;
    return { version: VERSION, sessions, activeSessionId: active };
  }

  // v1, missing/unknown version, or any other shape: start fresh.
  return emptyState();
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
    // The fallback already holds a valid v3 object, so no coercion is needed.
    return memoryFallback ?? emptyState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return coerceState(JSON.parse(raw));
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
