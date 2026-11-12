import type { PlayerId, Tournament } from '../types/tournament.js';

/** Display-name lookup that falls back to the id, so a stale reference never crashes a render. */
export function nameLookup(tournament: Tournament): (playerId: PlayerId) => string {
  const names = new Map(tournament.players.map((player) => [player.id, player.name]));
  return (playerId) => names.get(playerId) ?? playerId;
}

export const STAGE_LABELS = {
  setup: 'Setup',
  groups: 'Group stage',
  playIn: 'Play-in',
  semis: 'Semifinals',
  final: 'Grand final',
  done: 'Finished',
} as const;
