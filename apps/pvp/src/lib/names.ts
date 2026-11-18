import type { Tournament } from '../types/tournament.js';
import type { Translatable } from './i18n.js';

// Everyone is identified by Discord username: participants in `players`,
// predictors in poll ballots (EasyPoll's votes table shows the username).
// Screens show the host's display names instead.

export const MAX_DISPLAY_NAME = 32;
/** Keeps the document well under the server's 256 KB limit even with every guild member listed. */
export const MAX_DISPLAY_NAMES = 1000;

/** Discord usernames are case-insensitive and often written with a leading "@"; this is the stored form. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

/** Discord's unique usernames: 2–32 characters of a–z, 0–9, "_" and ".", never two dots in a row. */
export function isDiscordUsername(value: string): boolean {
  return /^(?!.*\.\.)[a-z0-9_.]{2,32}$/.test(value);
}

/** Display-name lookup by Discord username that falls back to the username, so a missing name never breaks a render. */
export function nameLookup(tournament: Pick<Tournament, 'displayNames'>): (username: string) => string {
  const names = new Map(Object.entries(tournament.displayNames));
  return (username) => names.get(username) ?? username;
}

/** Parses the host's pasted `{ "username": "display name" }` JSON. Never throws; `setDisplayNames` checks the usernames and names. */
export function parseDisplayNamesJson(text: string): { ok: true; value: Record<string, string> } | { ok: false; error: Translatable } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: (t) => t.names.invalidJson };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, error: (t) => t.names.notObject };
  const entries = Object.entries(data);
  const notText = entries.find(([, name]) => typeof name !== 'string');
  if (notText) return { ok: false, error: (t) => t.names.notText(notText[0]) };
  return { ok: true, value: Object.fromEntries(entries) as Record<string, string> };
}
