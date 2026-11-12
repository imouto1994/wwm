// Domain types for the PvP tournament tracker.
//
// `Tournament` is the only thing ever persisted: one JSON document in Redis
// that the host page edits and the viewer page polls. Everything else
// (standings, qualifiers, seeds, the champion) is derived from it by the pure
// functions in src/lib, so a corrected game result re-flows automatically.

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
}

/** Player ids in finishing order for one game: 1st, 2nd, 3rd. */
export type Placement = [PlayerId, PlayerId, PlayerId];

export interface Game {
  placement: Placement;
  /** ISO time the host saved the result; feeds the viewer's ETA. */
  savedAt: string;
}

export type SeriesStage = 'group' | 'playIn' | 'semi' | 'final';

/** One Discord member's prediction, imported from the EasyPoll votes JSON. */
export interface Ballot {
  discordId: string;
  username: string;
  playerId: PlayerId;
}

/** EasyPoll result for one series. Predictions never affect the bracket. */
export interface Poll {
  votes: Record<PlayerId, number>;
  /** Present only when the host imported the per-voter JSON. */
  ballots?: Ballot[];
  recordedAt: string;
}

/** A group of three playing first to `winsNeeded` game wins. */
export interface Series {
  id: string;
  stage: SeriesStage;
  label: string;
  playerIds: [PlayerId, PlayerId, PlayerId];
  /** 2 = first to 2 wins; 1 = a single match (play-in, late-running semifinals). */
  winsNeeded: 1 | 2;
  games: Game[];
  /** Set when the host taps Start; marks the series as live for viewers. */
  startedAt?: string;
  /** A host ruling (forfeit, disconnect) that decides the series regardless of games. */
  winnerOverride?: { playerId: PlayerId; reason: string };
  poll?: Poll;
}

export type Stage = 'setup' | 'groups' | 'playIn' | 'semis' | 'final' | 'done';

/**
 * A random draw that broke a tie, recorded so every screen (and every later
 * recomputation) agrees on the same order. `key` identifies the tie: its
 * context plus the tied player ids.
 */
export interface TieDraw {
  key: string;
  order: PlayerId[];
  drawnAt: string;
}

export interface Tournament {
  schemaVersion: 1;
  /** Bumped by the server on every save; the host sends it back to detect conflicts. */
  version: number;
  updatedAt: string;
  name: string;
  /** Empty during setup, otherwise 21, 24, 27 or 30 players. */
  players: Player[];
  stage: Stage;
  /** Every series created so far, in play order. */
  series: Series[];
  currentSeriesId?: string;
  /** Late-running rule: semifinals are a single match each. */
  lateRule: boolean;
  tieDraws: TieDraw[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
