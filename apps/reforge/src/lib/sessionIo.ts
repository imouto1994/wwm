/**
 * Session JSON import/export (pure, framework- and window-free).
 *
 * Export wraps a single session in a small typed envelope; import validates that
 * envelope and, crucially, *strictly sanitizes* the milestone inputs. The engine
 * `replay` switches on `input.type` with no default case, so an untrusted file
 * with a malformed input could otherwise produce broken snapshots - sanitizing
 * here is the safety net. Roll/lock/revert node references are constrained to the
 * rollable nodes (1-4); an `unlock` may also target Node 5 (Misc), which is
 * auto-gold once unlocked.
 */
import { NODE_IDS, ROLLABLE_NODE_IDS } from '@/lib/constants';
import { uid } from '@/lib/id';
import { synthesizeUnlocks } from '@/lib/migrate';
import type { MilestoneInput, NodeId, RevertNodeInput, Session, SessionExport } from '@/types/reforge';

export const EXPORT_TYPE = 'wwm-reforge-session' as const;
// v2 added manual `unlock` milestones; v1 files are migrated on import.
export const EXPORT_VERSION = 2 as const;
// Earliest file format we still accept (and migrate forward) on import.
const MIN_EXPORT_VERSION = 1 as const;

export type ParseResult = { ok: true; name: string; inputs: MilestoneInput[] } | { ok: false; error: string };

// Serialize one session into the export envelope (pretty-printed for humans).
// The session `id` is omitted; a fresh one is minted on import.
export function serializeSession(session: Session, now: Date = new Date()): string {
  const payload: SessionExport = {
    type: EXPORT_TYPE,
    exportVersion: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    name: session.name,
    inputs: session.inputs,
  };
  return JSON.stringify(payload, null, 2);
}

function isRollableNodeId(value: unknown): value is NodeId {
  return typeof value === 'number' && (ROLLABLE_NODE_IDS as number[]).includes(value);
}

// Any valid node id (1-5). Used for `unlock`, which - unlike lock/revert - may
// target Node 5 (Misc).
function isNodeId(value: unknown): value is NodeId {
  return typeof value === 'number' && (NODE_IDS as number[]).includes(value);
}

// Accept a plain node id or a legacy `{ id }` object (mirrors storage#normalizeInputs).
function toNodeId(hit: unknown): unknown {
  return typeof hit === 'number' ? hit : (hit as { id?: unknown })?.id;
}

function sanitizeRoll(r: Record<string, unknown>): MilestoneInput | null {
  const { rolls } = r;
  if (typeof rolls !== 'number' || !Number.isInteger(rolls) || rolls <= 0) return null;
  const goldHits = Array.isArray(r.goldHits) ? r.goldHits.map(toNodeId).filter(isRollableNodeId) : [];
  return { id: uid(), type: 'roll', rolls, goldHits };
}

function sanitizeUnlock(r: Record<string, unknown>): MilestoneInput | null {
  if (!isNodeId(r.nodeId)) return null;
  return { id: uid(), type: 'unlock', nodeId: r.nodeId };
}

function sanitizeLock(r: Record<string, unknown>): MilestoneInput | null {
  if (!isRollableNodeId(r.nodeId) || typeof r.locked !== 'boolean') return null;
  return { id: uid(), type: 'lock', nodeId: r.nodeId, locked: r.locked };
}

function sanitizeRevert(r: Record<string, unknown>): MilestoneInput | null {
  if (!Array.isArray(r.nodes)) return null;
  const nodes: RevertNodeInput[] = [];
  for (const entry of r.nodes) {
    if (typeof entry !== 'object' || entry === null) continue;
    const n = entry as Record<string, unknown>;
    if (isRollableNodeId(n.id) && typeof n.gold === 'boolean' && typeof n.locked === 'boolean') {
      nodes.push({ id: n.id, gold: n.gold, locked: n.locked });
    }
  }
  return { id: uid(), type: 'revert', nodes };
}

/**
 * Strictly validate untrusted milestone inputs, dropping anything malformed and
 * minting a fresh id per surviving entry. A non-array yields an empty list.
 */
export function sanitizeMilestoneInputs(inputs: unknown): MilestoneInput[] {
  if (!Array.isArray(inputs)) return [];
  const result: MilestoneInput[] = [];
  for (const raw of inputs) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const sanitized =
      r.type === 'roll'
        ? sanitizeRoll(r)
        : r.type === 'unlock'
          ? sanitizeUnlock(r)
          : r.type === 'lock'
            ? sanitizeLock(r)
            : r.type === 'revert'
              ? sanitizeRevert(r)
              : null;
    if (sanitized) result.push(sanitized);
  }
  return result;
}

/**
 * Parse and validate raw file text into a session payload. Takes the raw text so
 * the malformed-JSON path lives here (one testable place). The returned `name`
 * may be empty - the hook applies its own default - and `inputs` are sanitized.
 */
export function parseSessionExport(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Could not read this file as JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'This is not a valid session file.' };
  }
  const r = parsed as Record<string, unknown>;
  if (r.type !== EXPORT_TYPE) {
    return { ok: false, error: 'This file is not a Reforge session export.' };
  }
  if (typeof r.exportVersion !== 'number' || r.exportVersion < MIN_EXPORT_VERSION || r.exportVersion > EXPORT_VERSION) {
    return { ok: false, error: 'Unsupported export version.' };
  }
  const name = typeof r.name === 'string' ? r.name : '';
  const inputs = sanitizeMilestoneInputs(r.inputs);
  // Pre-manual-unlock files (v1) have no unlock milestones; synthesize them so an
  // old backup replays correctly. v2+ already carries explicit unlocks.
  return { ok: true, name, inputs: r.exportVersion < EXPORT_VERSION ? synthesizeUnlocks(inputs) : inputs };
}

// Safe download filename, e.g. "reforge-session-1-2026-06-17.json".
export function exportFileName(name: string, now: Date = new Date()): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const date = now.toISOString().slice(0, 10);
  return `reforge-${slug || 'session'}-${date}.json`;
}
