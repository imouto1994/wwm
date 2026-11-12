import type { Tournament } from '../types/tournament.js';
import { parseTournament } from './validate.js';

// Browser-side calls to /api/tournament. Kept separate from the pure rules so
// the rest of src/lib stays free of network code. Every response is run
// through parseTournament before the UI sees it.

const ENDPOINT = '/api/tournament';
const PIN_HEADER = 'x-host-pin';

export class UnauthorizedError extends Error {}

function toTournament(data: unknown): Tournament | null {
  if (data === null || data === undefined) return null;
  const parsed = parseTournament(data);
  if (!parsed.ok) throw new Error(`The server sent an invalid tournament: ${parsed.error}`);
  return parsed.value;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') return body.error;
  } catch {
    // Fall through to the generic message.
  }
  return `The server answered ${response.status}.`;
}

/** The public state, or the host's uncached copy when `pin` is given. */
export async function fetchTournament(options: { pin?: string; signal?: AbortSignal } = {}): Promise<Tournament | null> {
  const url = options.pin ? `${ENDPOINT}?fresh=1` : ENDPOINT;
  const response = await fetch(url, {
    cache: 'no-store',
    headers: options.pin ? { [PIN_HEADER]: options.pin } : undefined,
    signal: options.signal,
  });
  if (response.status === 401) throw new UnauthorizedError(await errorMessage(response));
  if (!response.ok) throw new Error(await errorMessage(response));
  const body = (await response.json()) as { tournament?: unknown };
  return toTournament(body.tournament);
}

export type SaveOutcome =
  | { ok: true; tournament: Tournament }
  | { ok: false; kind: 'conflict'; tournament: Tournament | null }
  | { ok: false; kind: 'unauthorized' | 'error'; message: string };

export async function saveTournament(tournament: Tournament, expectedVersion: number, pin: string): Promise<SaveOutcome> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', [PIN_HEADER]: pin },
      body: JSON.stringify({ expectedVersion, tournament }),
    });
  } catch {
    return { ok: false, kind: 'error', message: 'Could not reach the server. Check the connection and retry.' };
  }
  if (response.status === 409) {
    const body = (await response.json()) as { tournament?: unknown };
    return { ok: false, kind: 'conflict', tournament: toTournament(body.tournament) };
  }
  if (response.status === 401) return { ok: false, kind: 'unauthorized', message: await errorMessage(response) };
  if (!response.ok) return { ok: false, kind: 'error', message: await errorMessage(response) };
  const body = (await response.json()) as { tournament?: unknown };
  const saved = toTournament(body.tournament);
  return saved ? { ok: true, tournament: saved } : { ok: false, kind: 'error', message: 'The server did not return the saved tournament.' };
}

/** Recent saves, newest first, for the host's restore tool. */
export async function fetchHistory(pin: string): Promise<Tournament[]> {
  const response = await fetch(`${ENDPOINT}?history=1`, { cache: 'no-store', headers: { [PIN_HEADER]: pin } });
  if (response.status === 401) throw new UnauthorizedError(await errorMessage(response));
  if (!response.ok) throw new Error(await errorMessage(response));
  const body = (await response.json()) as { history?: unknown };
  if (!Array.isArray(body.history)) return [];
  return body.history.flatMap((entry) => {
    const parsed = parseTournament(entry);
    return parsed.ok ? [parsed.value] : [];
  });
}
