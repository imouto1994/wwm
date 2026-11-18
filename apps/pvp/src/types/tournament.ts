// Domain types for the PvP tournament tracker.
//
// `Tournament` is the only thing ever persisted: one JSON document in Redis
// that the host page edits and the viewer page polls. Everything else
// (standings, qualifiers, seeds, the champion) is derived from it by the pure
// functions in src/lib, so a corrected game result re-flows automatically.

/**
 * A participant's Discord username, lowercase and without "@". Screens show
 * the matching entry of `Tournament.displayNames` instead. Version 1
 * documents used made-up ids (p1, p2, …); those keep working because their
 * names were moved into `displayNames` (see parseTournament).
 */
export type PlayerId = string;

/** Player ids in finishing order for one game: 1st, 2nd, 3rd. */
export type Placement = [PlayerId, PlayerId, PlayerId];

export interface Game {
  placement: Placement;
  /** ISO time the host saved the result; feeds the viewer's ETA. */
  savedAt: string;
}

export type SeriesStage = 'group' | 'semi' | 'final';

/** One Discord member's prediction, imported from the EasyPoll votes JSON; `username` is lowercase and without "@". */
export interface Ballot {
  username: string;
  playerId: PlayerId;
}

/**
 * EasyPoll result for "who wins this series?", one ballot per voter so every
 * vote feeds the prediction leaderboard; vote counts are derived from the
 * ballots. Predictions never affect the bracket.
 */
export interface Poll {
  ballots: Ballot[];
  recordedAt: string;
}

export type GamesPick = 'over' | 'under';

/** One Discord member's over/under pick on how many games the series takes. */
export interface GamesBallot {
  username: string;
  pick: GamesPick;
}

/** EasyPoll result for "over or under N games?". */
export interface GamesPoll {
  /** The line voters saw, kept with the result so changing the fixed lines later can't reinterpret old votes. */
  line: number;
  ballots: GamesBallot[];
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
  schemaVersion: 2;
  /** Bumped by the server on every save; the host sends it back to detect conflicts. */
  version: number;
  updatedAt: string;
  name: string;
  /** Discord usernames; empty during setup, otherwise 21, 24, 27 or 30 players. */
  players: PlayerId[];
  /**
   * Discord username → display name, pasted by the host as JSON. Covers
   * participants and predictors alike (predictors needn't play), so it can
   * list more people than `players`. Every participant has an entry, and
   * names are unique ignoring case and leading emoji, so a winner-poll answer
   * maps back to one username. It survives a reset.
   */
  displayNames: Record<string, string>;
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
