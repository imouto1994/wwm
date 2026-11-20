import type { Ballot, GamesBallot, GamesPick, PlayerId, Series, Tournament } from '../types/tournament.js';
import { GAMES_LINES, PREDICTION_POINTS } from './format.js';
import type { Translatable } from './i18n.js';
import { nameLookup, normalizeUsername } from './names.js';
import { isSeriesComplete, seriesWinner, survivalLoser } from './series.js';

// Discord predictions. For every series, members vote in up to two EasyPolls:
// who wins (in the survival game: who goes out), and (except single matches) over or under a fixed line on how many
// games it takes. The host always imports the per-voter JSON produced by the
// EasyPoll converter, so every vote feeds the prediction leaderboard and the
// vote counts are derived from those ballots. Predictions are display-only and
// never affect the bracket.

/** One row of the converter script's output, with the username already normalized. */
export interface VoteEntry {
  username: string;
  vote: string;
}

// Same rule as the converter script: strip leading emoji but never digits, so
// an answer like "🔥 Lan" matches the player "Lan".
const LEADING_EMOJI = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200d\ufe0f\u20e3\s]+/u;

export function normalizeAnswer(text: string): string {
  const trimmed = text.normalize('NFC').trim();
  return (trimmed.replace(LEADING_EMOJI, '') || trimmed).replace(/\s+/g, ' ').toLowerCase();
}

/** Parses and checks the converter's JSON array. Never throws. A `discordId` from older exports is ignored. */
export function parseVotesJson(text: string): { ok: true; value: VoteEntry[] } | { ok: false; error: Translatable } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: (t) => t.poll.invalidJson };
  }
  if (!Array.isArray(data)) return { ok: false, error: (t) => t.poll.notArray };
  const entries: VoteEntry[] = [];
  for (const [index, item] of data.entries()) {
    if (typeof item !== 'object' || item === null) return { ok: false, error: (t) => t.poll.entryNotObject(index + 1) };
    const { username, vote } = item as Record<string, unknown>;
    const voter = typeof username === 'string' ? normalizeUsername(username) : '';
    if (!voter || typeof vote !== 'string' || !vote) return { ok: false, error: (t) => t.poll.entryMissing(index + 1) };
    entries.push({ username: voter, vote });
  }
  return { ok: true, value: entries };
}

interface Unmatched {
  /** Answers that couldn't be read, with how many votes each. */
  unmatched: { answer: string; count: number }[];
  /** Discord members listed more than once; only their first vote counts. */
  duplicates: number;
}

/** Shared matching loop: one vote per Discord member, answers read by `read`. */
function matchEntries<T>(entries: readonly VoteEntry[], read: (answer: string) => T | undefined) {
  const matched: { entry: VoteEntry; value: T }[] = [];
  const unmatched = new Map<string, number>();
  const seen = new Set<string>();
  let duplicates = 0;
  for (const entry of entries) {
    if (seen.has(entry.username)) {
      duplicates += 1;
      continue;
    }
    seen.add(entry.username);
    const value = read(entry.vote);
    if (value === undefined) unmatched.set(entry.vote, (unmatched.get(entry.vote) ?? 0) + 1);
    else matched.push({ entry, value });
  }
  return { matched, unmatched: [...unmatched].map(([answer, count]) => ({ answer, count })), duplicates };
}

function countWinnerBallots(playerIds: readonly PlayerId[], ballots: readonly Ballot[]): Record<PlayerId, number> {
  const votes: Record<PlayerId, number> = Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
  for (const ballot of ballots) votes[ballot.playerId] += 1;
  return votes;
}

function countGamesBallots(ballots: readonly GamesBallot[]): Record<GamesPick, number> {
  const votes: Record<GamesPick, number> = { over: 0, under: 0 };
  for (const ballot of ballots) votes[ballot.pick] += 1;
  return votes;
}

export interface MatchedVotes extends Unmatched {
  votes: Record<PlayerId, number>;
  ballots: Ballot[];
}

/**
 * Display name → Discord username, keyed the way poll answers are compared.
 * Display names are unique under that key (see setDisplayNames), so it's one-to-one.
 */
export function displayNameIndex(displayNames: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(displayNames).map(([username, name]) => [normalizeAnswer(name), username]));
}

/** Matches each "who wins?" vote to one of the series' players: the answer is a display name, read back to a username. */
export function matchVotes(series: Series, displayNames: Record<string, string>, entries: readonly VoteEntry[]): MatchedVotes {
  const byName = displayNameIndex(displayNames);
  const readPlayer = (answer: string) => {
    const playerId = byName.get(normalizeAnswer(answer));
    return playerId !== undefined && series.playerIds.includes(playerId) ? playerId : undefined;
  };
  const { matched, unmatched, duplicates } = matchEntries(entries, readPlayer);
  const ballots: Ballot[] = matched.map(({ entry, value }) => ({ username: entry.username, playerId: value }));
  return { votes: countWinnerBallots(series.playerIds, ballots), ballots, unmatched, duplicates };
}

// Words that start an over/under answer in either language, accent-free, so
// "Trên 2,5 ván", "over 2.5 games" and the betting slang "Tài"/"Xỉu" all work.
const GAMES_KEYWORDS: Record<GamesPick, readonly string[]> = {
  over: ['over', 'tren', 'tai'],
  under: ['under', 'duoi', 'xiu'],
};

function withoutAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .replace(/đ/g, 'd');
}

/** Reads an over/under answer, or undefined when it's neither. */
export function parseGamesPick(answer: string): GamesPick | undefined {
  const firstWord = withoutAccents(normalizeAnswer(answer))
    .split(/[^a-z]+/)
    .find(Boolean);
  if (!firstWord) return undefined;
  return (Object.keys(GAMES_KEYWORDS) as GamesPick[]).find((pick) => GAMES_KEYWORDS[pick].includes(firstWord));
}

export interface MatchedGamesVotes extends Unmatched {
  votes: Record<GamesPick, number>;
  ballots: GamesBallot[];
}

export function matchGamesVotes(entries: readonly VoteEntry[]): MatchedGamesVotes {
  const { matched, unmatched, duplicates } = matchEntries(entries, parseGamesPick);
  const ballots: GamesBallot[] = matched.map(({ entry, value }) => ({ username: entry.username, pick: value }));
  return { votes: countGamesBallots(ballots), ballots, unmatched, duplicates };
}

export interface VoteShare {
  playerId: PlayerId;
  votes: number;
  /** 0-100, rounded. */
  percent: number;
}

/** Vote shares in `series.playerIds` order, or undefined when there's no poll or no votes. */
export function voteShares(series: Series): VoteShare[] | undefined {
  const total = series.poll?.ballots.length ?? 0;
  if (!series.poll || total === 0) return undefined;
  const votes = countWinnerBallots(series.playerIds, series.poll.ballots);
  return series.playerIds.map((playerId) => ({ playerId, votes: votes[playerId], percent: Math.round((votes[playerId] / total) * 100) }));
}

/**
 * The right answer to a series' player poll: the series winner, except in the
 * survival game, whose poll asks who goes out (only 3rd place is eliminated).
 */
export function pollAnswer(series: Series): PlayerId | undefined {
  return series.stage === 'survival' ? survivalLoser(series) : seriesWinner(series);
}

/** The player with the most votes, or undefined when nobody voted or the top is shared. */
export function crowdFavorite(series: Series): PlayerId | undefined {
  const shares = voteShares(series);
  if (!shares) return undefined;
  const top = Math.max(...shares.map((share) => share.votes));
  const leaders = shares.filter((share) => share.votes === top);
  return leaders.length === 1 ? leaders[0].playerId : undefined;
}

/** Over/under only makes sense when a series can run to different lengths (not a single match). */
export function hasGamesPrediction(series: Series): boolean {
  return series.winsNeeded >= 2;
}

/** The fixed line for a series' games prediction: 2.5 in the group stage and semifinals, 4.5 in the first-to-3 final. */
export function gamesLineOf(series: Series): number {
  return GAMES_LINES[series.stage];
}

export type GamesOutcome = GamesPick | 'push';

/**
 * How the finished series went against the recorded poll's line (or the
 * current line). Undefined while it's running, for single matches, and when a
 * ruling decided it: then the game count says nothing about the players.
 */
export function gamesOutcome(series: Series): GamesOutcome | undefined {
  if (!hasGamesPrediction(series) || series.winnerOverride || !isSeriesComplete(series)) return undefined;
  const line = series.gamesPoll?.line ?? gamesLineOf(series);
  const games = series.games.length;
  return games > line ? 'over' : games < line ? 'under' : 'push';
}

/** Over and under shares (0-100, rounded), or undefined when nobody voted. */
export function gamesShares(series: Series): Record<GamesPick, number> | undefined {
  const total = series.gamesPoll?.ballots.length ?? 0;
  if (!series.gamesPoll || total === 0) return undefined;
  const over = Math.round((countGamesBallots(series.gamesPoll.ballots).over / total) * 100);
  return { over, under: 100 - over };
}

/** The crowd's over/under pick, or undefined when nobody voted or it's an even split. */
export function crowdGamesPick(series: Series): GamesPick | undefined {
  const votes = series.gamesPoll && countGamesBallots(series.gamesPoll.ballots);
  if (!votes || votes.over === votes.under) return undefined;
  return votes.over > votes.under ? 'over' : 'under';
}

/** How often the crowd's top pick was right (see pollAnswer), over finished series with a clear top pick. */
export function crowdRecord(tournament: Tournament): { called: number; decided: number } {
  let called = 0;
  let decided = 0;
  for (const series of tournament.series) {
    const favorite = crowdFavorite(series);
    const answer = pollAnswer(series);
    if (!favorite || !answer) continue;
    decided += 1;
    if (favorite === answer) called += 1;
  }
  return { called, decided };
}

/** How often the crowd's over/under pick was right; pushes and rulings don't count. */
export function crowdGamesRecord(tournament: Tournament): { called: number; decided: number } {
  let called = 0;
  let decided = 0;
  for (const series of tournament.series) {
    const pick = crowdGamesPick(series);
    const outcome = gamesOutcome(series);
    if (!pick || !outcome || outcome === 'push') continue;
    decided += 1;
    if (pick === outcome) called += 1;
  }
  return { called, decided };
}

/** Points won on each question, out of the points the member's picks could have won (see PREDICTION_POINTS). */
export interface LeaderboardEntry {
  username: string;
  /** The display name, else the username. */
  name: string;
  winnerPoints: number;
  winnerPossible: number;
  gamesPoints: number;
  gamesPossible: number;
  points: number;
  possible: number;
}

export interface LeaderboardPlace {
  /** Prize place, for the top members only. */
  place?: 1 | 2 | 3;
  /** Members above this one, plus one; shared within a tie. */
  rank: number;
}

/**
 * Prize places for a sorted leaderboard. Members level on points and possible
 * points share a place. Places go to whole tie groups in order and stop once
 * three members hold one, so ties never add winners: two members sharing 1st
 * leave room only for a 2nd, and four sharing 1st leave no other place.
 */
export function leaderboardPlaces(entries: readonly LeaderboardEntry[]): LeaderboardPlace[] {
  let place = 0;
  let placed = 0;
  let groupRank = 1;
  let groupPlace: LeaderboardPlace['place'];
  return entries.map((entry, index) => {
    const previous = entries[index - 1];
    if (!previous || previous.points !== entry.points || previous.possible !== entry.possible) {
      groupRank = index + 1;
      if (placed < 3) {
        place += 1;
        groupPlace = place as 1 | 2 | 3;
      } else {
        groupPlace = undefined;
      }
    }
    if (groupPlace) placed += 1;
    return { ...(groupPlace ? { place: groupPlace } : {}), rank: groupRank };
  });
}

/** Discord members ranked by prediction points across both questions, over finished series. */
export function predictionLeaderboard(tournament: Tournament): LeaderboardEntry[] {
  const entries = new Map<string, LeaderboardEntry>();
  const nameOf = nameLookup(tournament);
  const entryFor = (username: string) => {
    const entry = entries.get(username) ?? {
      username,
      name: nameOf(username),
      winnerPoints: 0,
      winnerPossible: 0,
      gamesPoints: 0,
      gamesPossible: 0,
      points: 0,
      possible: 0,
    };
    entries.set(username, entry);
    return entry;
  };
  for (const series of tournament.series) {
    const worth = PREDICTION_POINTS[series.stage];
    const answer = pollAnswer(series);
    if (answer) {
      for (const ballot of series.poll?.ballots ?? []) {
        const entry = entryFor(ballot.username);
        entry.winnerPossible += worth;
        if (ballot.playerId === answer) entry.winnerPoints += worth;
      }
    }
    const outcome = gamesOutcome(series);
    if (outcome && outcome !== 'push') {
      for (const ballot of series.gamesPoll?.ballots ?? []) {
        const entry = entryFor(ballot.username);
        entry.gamesPossible += worth;
        if (ballot.pick === outcome) entry.gamesPoints += worth;
      }
    }
  }
  for (const entry of entries.values()) {
    entry.points = entry.winnerPoints + entry.gamesPoints;
    entry.possible = entry.winnerPossible + entry.gamesPossible;
  }
  // The same points out of fewer possible ones means better accuracy, so it ranks higher.
  return [...entries.values()]
    .filter((entry) => entry.possible > 0)
    .sort((a, b) => b.points - a.points || a.possible - b.possible || a.name.localeCompare(b.name));
}

/** One recorded poll: a series' first poll (who wins, or who goes out) or its over/under. */
export interface RecordedPoll {
  series: Series;
  kind: 'winner' | 'games';
}

export interface MissingVoter {
  username: string;
  name: string;
  missed: RecordedPoll[];
}

/**
 * Members who voted in at least one recorded poll but not in all of them,
 * with the polls they missed, most missed first. Only people seen in some
 * poll count, since the display names also list players who never predict.
 */
export function missingVoters(tournament: Tournament): { polls: RecordedPoll[]; voters: MissingVoter[] } {
  const recorded: { poll: RecordedPoll; voted: Set<string> }[] = [];
  for (const series of tournament.series) {
    if (series.poll) recorded.push({ poll: { series, kind: 'winner' }, voted: new Set(series.poll.ballots.map((ballot) => ballot.username)) });
    if (series.gamesPoll) recorded.push({ poll: { series, kind: 'games' }, voted: new Set(series.gamesPoll.ballots.map((ballot) => ballot.username)) });
  }
  const nameOf = nameLookup(tournament);
  const everyone = new Set(recorded.flatMap(({ voted }) => [...voted]));
  const voters = [...everyone]
    .map((username) => ({ username, name: nameOf(username), missed: recorded.filter(({ voted }) => !voted.has(username)).map(({ poll }) => poll) }))
    .filter((voter) => voter.missed.length > 0)
    .sort((a, b) => b.missed.length - a.missed.length || a.name.localeCompare(b.name));
  return { polls: recorded.map(({ poll }) => poll), voters };
}

/** Voters in recorded polls who aren't in the display names yet, so screens show their username; with how many polls each voted in. */
export function unnamedVoters(tournament: Tournament): { username: string; polls: number }[] {
  const named = new Set(Object.keys(tournament.displayNames));
  const polls = new Map<string, number>();
  for (const series of tournament.series) {
    for (const ballots of [series.poll?.ballots ?? [], series.gamesPoll?.ballots ?? []]) {
      for (const { username } of ballots) if (!named.has(username)) polls.set(username, (polls.get(username) ?? 0) + 1);
    }
  }
  return [...polls].map(([username, count]) => ({ username, polls: count })).sort((a, b) => a.username.localeCompare(b.username));
}
