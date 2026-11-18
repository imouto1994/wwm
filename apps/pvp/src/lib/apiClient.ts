import type { Tournament } from '../types/tournament.js';
import type { Translatable } from './i18n.js';
import { parseTournament } from './validate.js';

// Browser-side calls to /api/tournament. Kept separate from the pure rules so
// the rest of src/lib stays free of network code. Every response is run
// through parseTournament before the UI sees it.

const ENDPOINT = '/api/tournament';
const PIN_HEADER = 'x-host-pin';

/**
 * A failed call. `status` is the HTTP status, 0 when the server couldn't be
 * reached, or -1 when it answered with data the app can't read. `detail` is
 * the server's own (English) explanation, shown only where it adds something.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail = ''
  ) {
    super(detail || `HTTP ${status}`);
  }
}

export class UnauthorizedError extends ApiError {}

/** What to tell the host about a failed call, in the selected language. */
export function describeApiError(error: unknown): Translatable {
  if (!(error instanceof ApiError)) return (t) => t.api.unreachable;
  const { status, detail } = error;
  return (t) => {
    if (status === 0) return t.api.unreachable;
    if (status === -1) return t.api.invalidData;
    if (status === 401) return t.api.wrongPin;
    if (status === 403) return t.api.readOnly;
    if (status === 413) return t.api.tooLarge;
    if (status === 503) return t.api.noStorage;
    if (status === 500) return t.api.storageDown;
    if (status === 400) return t.api.rejected(detail);
    return t.api.status(status);
  };
}

function toTournament(data: unknown): Tournament | null {
  if (data === null || data === undefined) return null;
  const parsed = parseTournament(data);
  if (!parsed.ok) throw new ApiError(-1, parsed.error);
  return parsed.value;
}

async function failure(response: Response): Promise<ApiError> {
  let detail = '';
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') detail = body.error;
  } catch {
    // No JSON body; the status alone has to do.
  }
  return response.status === 401 ? new UnauthorizedError(401, detail) : new ApiError(response.status, detail);
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0);
  }
}

/** The public state, or the host's uncached copy when `pin` is given. */
export async function fetchTournament(options: { pin?: string; signal?: AbortSignal } = {}): Promise<Tournament | null> {
  const url = options.pin ? `${ENDPOINT}?fresh=1` : ENDPOINT;
  const response = await request(url, {
    cache: 'no-store',
    headers: options.pin ? { [PIN_HEADER]: options.pin } : undefined,
    signal: options.signal,
  });
  if (!response.ok) throw await failure(response);
  const body = (await response.json()) as { tournament?: unknown };
  return toTournament(body.tournament);
}

export type SaveOutcome =
  | { ok: true; tournament: Tournament }
  | { ok: false; kind: 'conflict'; tournament: Tournament | null }
  | { ok: false; kind: 'unauthorized' | 'error'; error: ApiError };

export async function saveTournament(tournament: Tournament, expectedVersion: number, pin: string): Promise<SaveOutcome> {
  try {
    const response = await request(ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', [PIN_HEADER]: pin },
      body: JSON.stringify({ expectedVersion, tournament }),
    });
    if (response.status === 409) {
      const body = (await response.json()) as { tournament?: unknown };
      return { ok: false, kind: 'conflict', tournament: toTournament(body.tournament) };
    }
    if (!response.ok) {
      const error = await failure(response);
      return { ok: false, kind: error instanceof UnauthorizedError ? 'unauthorized' : 'error', error };
    }
    const body = (await response.json()) as { tournament?: unknown };
    const saved = toTournament(body.tournament);
    return saved ? { ok: true, tournament: saved } : { ok: false, kind: 'error', error: new ApiError(-1) };
  } catch (error) {
    return { ok: false, kind: 'error', error: error instanceof ApiError ? error : new ApiError(0) };
  }
}

/** Recent saves, newest first, for the host's restore tool. */
export async function fetchHistory(pin: string): Promise<Tournament[]> {
  const response = await request(`${ENDPOINT}?history=1`, { cache: 'no-store', headers: { [PIN_HEADER]: pin } });
  if (!response.ok) throw await failure(response);
  const body = (await response.json()) as { history?: unknown };
  if (!Array.isArray(body.history)) return [];
  return body.history.flatMap((entry) => {
    const parsed = parseTournament(entry);
    return parsed.ok ? [parsed.value] : [];
  });
}
