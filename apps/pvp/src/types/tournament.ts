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

export type SeriesStage = 'group' | 'semi' | 'final';

/** One Discord member's prediction, imported from the EasyPoll votes JSON. */
export interface Ballot {
  discordId: string;
  username: string;
  playerId: PlayerId;
}

/** EasyPoll result for "who wins this series?". Predictions never affect the bracket. */
export interface Poll {
  votes: Record<PlayerId, number>;
  /** Present only when the host imported the per-voter JSON. */
  ballots?: Ballot[];
  recordedAt: string;
}

export type GamesPick = 'over' | 'under';

/** One Discord member's over/under pick on how many games the series takes. */
export interface GamesBallot {
  discordId: string;
  username: string;
  pick: GamesPick;
}

/** EasyPoll result for "over or under N games?". */
export interface GamesPoll {
  /** The line voters saw, kept with the result so changing the fixed lines later can't reinterpret old votes. */
  line: number;
  votes: Record<GamesPick, number>;
  ballots?: GamesBallot[];
  recordedAt: string;
}

/** A group of three playing first to `winsNeeded` game wins. */
export interface Series {
  id: string;
  stage: SeriesStage;
  /** English name ("Group 3"), kept in the document; screens show the localized name from `id` and `stage` instead. */
  label: string;
  playerIds: [PlayerId, PlayerId, PlayerId];
  /** 2 = first to 2 wins (groups, semifinals); 3 = first to 3 (grand final); 1 = a single match (late-running semifinals). */
  winsNeeded: 1 | 2 | 3;
  games: Game[];
  /** Set when the host taps Start; marks the series as live for viewers. */
  startedAt?: string;
  /** A host ruling (forfeit, disconnect) that decides the series regardless of games. */
  winnerOverride?: { playerId: PlayerId; reason: string };
  poll?: Poll;
  /** Over/under result; the line is fixed per phase (see GAMES_LINES) and copied into the poll when recorded. */
  gamesPoll?: GamesPoll;
}

export type Stage = 'setup' | 'groups' | 'semis' | 'final' | 'done';

/**
 * The host's say in who reaches the 9 semifinal spots when the group winners
 * don't fill them exactly: 21 and 24 players leave spots empty, 30 has a
 * winner too many. At 27 players both lists stay empty.
 */
export interface SemifinalPicks {
  /** Players who didn't win their group but take an empty spot (2 at 21 players, 1 at 24). */
  fillIns: PlayerId[];
  /** Group winners left out so only 9 go through (1 at 30 players). */
  dropped: PlayerId[];
}

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
  /** Set during the group stage at 21, 24 and 30 players; see SemifinalPicks. */
  semifinalPicks?: SemifinalPicks;
  /**
   * The host's arrangement of the semifinal groups before they start. Absent
   * means the seeded groups; ignored if it no longer holds exactly the
   * current semifinalists (see semifinalGroups).
   */
  semifinalDraft?: [PlayerId, PlayerId, PlayerId][];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
