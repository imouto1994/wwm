import { handleTournamentRequest } from './handler.js';
import { type TournamentStore, createMemoryStore, storeFromEnv } from './store.js';

// Dev-only entry used by the Vite middleware in vite.config.ts, so
// `pnpm dev:pvp` serves /api/tournament without the Vercel CLI. It uses the
// real Redis store when Upstash credentials are in .env.local (keys prefixed
// "pvp:development"), otherwise an in-memory store.

/** PIN used locally when HOST_PIN isn't set in .env.local. Never used in production. */
export const DEV_HOST_PIN = 'dev';

// Kept on globalThis so editing server code (which reloads this module) doesn't wipe the in-memory tournament.
const holder = globalThis as { __pvpDevStore?: TournamentStore };

export function handleDevRequest(request: Request, env: Record<string, string | undefined>): Promise<Response> {
  holder.__pvpDevStore ??= storeFromEnv(env) ?? createMemoryStore();
  return handleTournamentRequest(request, {
    store: holder.__pvpDevStore,
    hostPin: env.HOST_PIN || DEV_HOST_PIN,
    readOnly: env.READ_ONLY === '1',
  });
}
