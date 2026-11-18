import type { Ballot, GamesBallot, GamesPick, Player, PlayerId, Series, Tournament } from '../types/tournament.js';
import { GAMES_LINES } from './format.js';
import type { Translatable } from './i18n.js';
import { isSeriesComplete, seriesWinner } from './series.js';

// Discord predictions. For every series, members vote in up to two EasyPolls:
// who wins, and (except single matches) over or under a fixed line on how many
// games it takes. The host either types the counts or imports the
// per-voter JSON produced by the EasyPoll converter. Predictions are
// display-only and never affect the bracket.

/** One row of the converter script's output. */
export interface VoteEntry {
  discordId: string;
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

/** Parses and checks the converter's JSON array. Never throws. */
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
    const { discordId, username, vote } = item as Record<string, unknown>;
    if (typeof discordId !== 'string' || !discordId || typeof vote !== 'string' || !vote) {
      return { ok: false, error: (t) => t.poll.entryMissing(index + 1) };
    }
    entries.push({ discordId, username: typeof username === 'string' ? username : '', vote });
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
    if (seen.has(entry.discordId)) {
      duplicates += 1;
      continue;
    }
    seen.add(entry.discordId);
    const value = read(entry.vote);
    if (value === undefined) unmatched.set(entry.vote, (unmatched.get(entry.vote) ?? 0) + 1);
    else matched.push({ entry, value });
  }
  return { matched, unmatched: [...unmatched].map(([answer, count]) => ({ answer, count })), duplicates };
}

export interface MatchedVotes extends Unmatched {
  votes: Record<PlayerId, number>;
  ballots: Ballot[];
}

/** Matches each "who wins?" vote to one of the series' players by name. */
export function matchVotes(series: Series, players: readonly Player[], entries: readonly VoteEntry[]): MatchedVotes {
  const byName = new Map<string, PlayerId>();
  for (const playerId of series.playerIds) {
    const player = players.find((candidate) => candidate.id === playerId);
    if (player) byName.set(normalizeAnswer(player.name), playerId);
  }
  const { matched, unmatched, duplicates } = matchEntries(entries, (answer) => byName.get(normalizeAnswer(answer)));
  const votes: Record<PlayerId, number> = Object.fromEntries(series.playerIds.map((playerId) => [playerId, 0]));
  const ballots: Ballot[] = matched.map(({ entry, value }) => {
    votes[value] += 1;
    return { discordId: entry.discordId, username: entry.username, playerId: value };
  });
  return { votes, ballots, unmatched, duplicates };
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
  const votes: Record<GamesPick, number> = { over: 0, under: 0 };
  const ballots: GamesBallot[] = matched.map(({ entry, value }) => {
    votes[value] += 1;
    return { discordId: entry.discordId, username: entry.username, pick: value };
  });
  return { votes, ballots, unmatched, duplicates };
}

export interface VoteShare {
  playerId: PlayerId;
  votes: number;
  /** 0-100, rounded. */
  percent: number;
}

/** Vote shares in `series.playerIds` order, or undefined when there's no poll or no votes. */
export function voteShares(series: Series): VoteShare[] | undefined {
  if (!series.poll) return undefined;
  const total = series.playerIds.reduce((sum, playerId) => sum + (series.poll?.votes[playerId] ?? 0), 0);
  if (total === 0) return undefined;
  return series.playerIds.map((playerId) => {
    const votes = series.poll?.votes[playerId] ?? 0;
    return { playerId, votes, percent: Math.round((votes / total) * 100) };
  });
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
  const votes = series.gamesPoll?.votes;
  const total = votes ? votes.over + votes.under : 0;
  if (!votes || total === 0) return undefined;
  const over = Math.round((votes.over / total) * 100);
  return { over, under: 100 - over };
}

/** The crowd's over/under pick, or undefined when nobody voted or it's an even split. */
export function crowdGamesPick(series: Series): GamesPick | undefined {
  const votes = series.gamesPoll?.votes;
  if (!votes || votes.over === votes.under) return undefined;
  return votes.over > votes.under ? 'over' : 'under';
}

/** How often the crowd favourite went on to win, over finished series with a clear favourite. */
export function crowdRecord(tournament: Tournament): { called: number; decided: number } {
  let called = 0;
  let decided = 0;
  for (const series of tournament.series) {
    const favorite = crowdFavorite(series);
    const winner = seriesWinner(series);
    if (!favorite || !winner) continue;
    decided += 1;
    if (favorite === winner) called += 1;
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

export interface LeaderboardEntry {
  discordId: string;
  username: string;
  winnerCorrect: number;
  winnerPicks: number;
  gamesCorrect: number;
  gamesPicks: number;
  correct: number;
  picks: number;
}

/** Discord members ranked by correct picks across both predictions, over finished series with imported ballots. */
export function predictionLeaderboard(tournament: Tournament): LeaderboardEntry[] {
  const entries = new Map<string, LeaderboardEntry>();
  const entryFor = (discordId: string, username: string) => {
    const entry = entries.get(discordId) ?? {
      discordId,
      username,
      winnerCorrect: 0,
      winnerPicks: 0,
      gamesCorrect: 0,
      gamesPicks: 0,
      correct: 0,
      picks: 0,
    };
    if (username) entry.username = username;
    entries.set(discordId, entry);
    return entry;
  };
  for (const series of tournament.series) {
    const winner = seriesWinner(series);
    if (winner) {
      for (const ballot of series.poll?.ballots ?? []) {
        const entry = entryFor(ballot.discordId, ballot.username);
        entry.winnerPicks += 1;
        if (ballot.playerId === winner) entry.winnerCorrect += 1;
      }
    }
    const outcome = gamesOutcome(series);
    if (outcome && outcome !== 'push') {
      for (const ballot of series.gamesPoll?.ballots ?? []) {
        const entry = entryFor(ballot.discordId, ballot.username);
        entry.gamesPicks += 1;
        if (ballot.pick === outcome) entry.gamesCorrect += 1;
      }
    }
  }
  for (const entry of entries.values()) {
    entry.correct = entry.winnerCorrect + entry.gamesCorrect;
    entry.picks = entry.winnerPicks + entry.gamesPicks;
  }
  // Fewer picks for the same score means better accuracy, so it ranks higher.
  return [...entries.values()]
    .filter((entry) => entry.picks > 0)
    .sort((a, b) => b.correct - a.correct || a.picks - b.picks || a.username.localeCompare(b.username));
}
