import { parseTournament } from '../src/lib/validate.js';
import type { Tournament } from '../src/types/tournament.js';
import { isHostRequest } from './auth.js';
import { HISTORY_LIMIT, type TournamentStore } from './store.js';

// Framework-free request handling for /api/tournament, shared by the Vercel
// Function (api/tournament.ts) and the Vite dev middleware (server/dev.ts).
//
//   GET                  public; CDN-cached for 2 s so polling viewers rarely reach Redis
//   GET ?fresh=1         host only; never cached (the host page's initial load)
//   GET ?history=1       host only; recent saves for the restore tool
//   PUT { expectedVersion, tournament }   host only; 409 with the current state on conflict

export interface HandlerOptions {
  store: TournamentStore | null;
  hostPin: string | undefined;
  /** After the event: keep the results visible but refuse writes. */
  readOnly?: boolean;
  now?: () => string;
}

const MAX_BODY_CHARS = 256 * 1024;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Vercel-CDN-Cache-Control': 's-maxage=2, stale-while-revalidate=5',
};

async function handleGet(request: Request, store: TournamentStore, options: HandlerOptions): Promise<Response> {
  const params = new URL(request.url).searchParams;
  if (params.has('history')) {
    if (!isHostRequest(request, options.hostPin)) return json(401, { error: 'Wrong host PIN.' });
    return json(200, { history: await store.history(HISTORY_LIMIT) });
  }
  if (params.has('fresh')) {
    if (!isHostRequest(request, options.hostPin)) return json(401, { error: 'Wrong host PIN.' });
    return json(200, { tournament: await store.read() });
  }
  return json(200, { tournament: await store.read() }, PUBLIC_CACHE_HEADERS);
}

async function handlePut(request: Request, store: TournamentStore, options: HandlerOptions): Promise<Response> {
  if (!isHostRequest(request, options.hostPin)) return json(401, { error: 'Wrong host PIN.' });
  if (options.readOnly) return json(403, { error: 'The tournament is read-only now.' });

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return json(413, { error: 'The tournament document is too large.' });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'The request body is not valid JSON.' });
  }
  const { expectedVersion, tournament } = (body ?? {}) as { expectedVersion?: unknown; tournament?: unknown };
  if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    return json(400, { error: 'expectedVersion must be a whole number.' });
  }
  const parsed = parseTournament(tournament);
  if (!parsed.ok) return json(400, { error: parsed.error });

  const next: Tournament = { ...parsed.value, version: expectedVersion + 1, updatedAt: (options.now ?? (() => new Date().toISOString()))() };
  const saved = await store.save(next, expectedVersion);
  if (!saved.ok) return json(409, { error: 'A newer version was saved first.', tournament: saved.current });
  return json(200, { tournament: next });
}

export async function handleTournamentRequest(request: Request, options: HandlerOptions): Promise<Response> {
  const { store } = options;
  if (!store) return json(503, { error: 'Storage is not configured. Connect Upstash Redis to this project.' });
  try {
    if (request.method === 'GET') return await handleGet(request, store, options);
    if (request.method === 'PUT') return await handlePut(request, store, options);
    return json(405, { error: 'Method not allowed.' }, { Allow: 'GET, PUT' });
  } catch (error) {
    console.error('Tournament request failed', { method: request.method, error: error instanceof Error ? error.message : String(error) });
    return json(500, { error: 'The server could not reach storage. Try again in a moment.' });
  }
}
