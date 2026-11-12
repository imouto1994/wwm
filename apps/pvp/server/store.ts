import { Redis } from '@upstash/redis';
import { parseTournament } from '../src/lib/validate.js';
import type { Tournament } from '../src/types/tournament.js';

// Persistence for the single tournament document.
//
// Production uses Upstash Redis (provisioned through the Vercel Marketplace):
// one key holds the JSON, one holds its version, and a capped list keeps
// recent saves for restore. Saves are compare-and-set in a Lua script so a
// stale host tab can never overwrite a newer state. Local dev uses the
// in-memory store instead.

export type SaveResult = { ok: true } | { ok: false; current: Tournament | null };

export interface TournamentStore {
  read(): Promise<Tournament | null>;
  /** Writes `next` only if the stored version still equals `expectedVersion`. */
  save(next: Tournament, expectedVersion: number): Promise<SaveResult>;
  /** Most recent saves first, for the host's restore tool. */
  history(limit: number): Promise<Tournament[]>;
}

export const HISTORY_LIMIT = 50;

function decode(raw: unknown): Tournament | null {
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    const parsed = parseTournament(JSON.parse(raw));
    return parsed.ok ? parsed.value : null;
  } catch {
    return null;
  }
}

export function createMemoryStore(): TournamentStore {
  let current: Tournament | null = null;
  let past: Tournament[] = [];
  return {
    async read() {
      return current ? structuredClone(current) : null;
    },
    async save(next, expectedVersion) {
      if ((current?.version ?? 0) !== expectedVersion) return { ok: false, current: current ? structuredClone(current) : null };
      current = structuredClone(next);
      past = [structuredClone(next), ...past].slice(0, HISTORY_LIMIT);
      return { ok: true };
    },
    async history(limit) {
      return past.slice(0, limit).map((entry) => structuredClone(entry));
    },
  };
}

// KEYS: state, version, history. ARGV: expected version, new version, new JSON.
// Returns {1} on success, or {0, currentJson} when the version moved on.
const SAVE_SCRIPT = `
local current = redis.call('GET', KEYS[2]) or '0'
if current ~= ARGV[1] then
  return {0, redis.call('GET', KEYS[1]) or ''}
end
redis.call('SET', KEYS[1], ARGV[3])
redis.call('SET', KEYS[2], ARGV[2])
redis.call('LPUSH', KEYS[3], ARGV[3])
redis.call('LTRIM', KEYS[3], 0, ${HISTORY_LIMIT - 1})
return {1}
`;

export function createRedisStore(redis: Redis, prefix: string): TournamentStore {
  const keys = { state: `${prefix}:state`, version: `${prefix}:version`, history: `${prefix}:history` };
  return {
    async read() {
      return decode(await redis.get<string>(keys.state));
    },
    async save(next, expectedVersion) {
      const result = await redis.eval<string[], [number, string?]>(
        SAVE_SCRIPT,
        [keys.state, keys.version, keys.history],
        [String(expectedVersion), String(next.version), JSON.stringify(next)]
      );
      return Number(result[0]) === 1 ? { ok: true } : { ok: false, current: decode(result[1]) };
    },
    async history(limit) {
      const entries = await redis.lrange<string>(keys.history, 0, Math.min(limit, HISTORY_LIMIT) - 1);
      return entries.map(decode).filter((entry): entry is Tournament => entry !== null);
    },
  };
}

/**
 * Builds the Redis store from the environment, or returns null when it isn't
 * configured. Accepts both the Upstash names and the `KV_REST_API_*` names the
 * Vercel Marketplace integration injects. Keys are prefixed by `VERCEL_ENV`
 * because the free plan allows one database: without the prefix, a rehearsal
 * on a preview deployment would overwrite the production tournament.
 */
export function storeFromEnv(env: Record<string, string | undefined>): TournamentStore | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  // Raw strings in and out: automatic deserialization would turn the stored JSON into objects unpredictably.
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return createRedisStore(redis, `pvp:${env.VERCEL_ENV || 'development'}`);
}
