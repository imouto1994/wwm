import type { Ballot, Player, PlayerId, Result, Series, Tournament } from '../types/tournament.js';
import { seriesWinner } from './series.js';

// Discord predictions. Members vote in an EasyPoll per series; the host
// either types the three counts or imports the per-voter JSON produced by
// scripts/easypoll/easypoll-to-json.mjs. Predictions are display-only and
// never affect the bracket.

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
export function parseVotesJson(text: string): Result<VoteEntry[]> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That is not valid JSON.' };
  }
  if (!Array.isArray(data)) return { ok: false, error: 'Expected a JSON array of votes.' };
  const entries: VoteEntry[] = [];
  for (const [index, item] of data.entries()) {
    if (typeof item !== 'object' || item === null) return { ok: false, error: `Entry ${index + 1} is not an object.` };
    const { discordId, username, vote } = item as Record<string, unknown>;
    if (typeof discordId !== 'string' || !discordId || typeof vote !== 'string' || !vote) {
      return { ok: false, error: `Entry ${index + 1} needs a discordId and a vote.` };
    }
    entries.push({ discordId, username: typeof username === 'string' ? username : '', vote });
  }
  return { ok: true, value: entries };
}

export interface MatchedVotes {
  votes: Record<PlayerId, number>;
  ballots: Ballot[];
  /** Answers that matched none of the series' players, with how many votes each. */
  unmatched: { answer: string; count: number }[];
  /** Discord members listed more than once; only their first vote counts. */
  duplicates: number;
}

/** Matches each vote to one of the series' players by name. */
export function matchVotes(series: Series, players: readonly Player[], entries: readonly VoteEntry[]): MatchedVotes {
  const byName = new Map<string, PlayerId>();
  for (const playerId of series.playerIds) {
    const player = players.find((candidate) => candidate.id === playerId);
    if (player) byName.set(normalizeAnswer(player.name), playerId);
  }
  const votes: Record<PlayerId, number> = Object.fromEntries(series.playerIds.map((playerId) => [playerId, 0]));
  const ballots: Ballot[] = [];
  const unmatched = new Map<string, number>();
  const seen = new Set<string>();
  let duplicates = 0;
  for (const entry of entries) {
    if (seen.has(entry.discordId)) {
      duplicates += 1;
      continue;
    }
    seen.add(entry.discordId);
    const playerId = byName.get(normalizeAnswer(entry.vote));
    if (!playerId) {
      unmatched.set(entry.vote, (unmatched.get(entry.vote) ?? 0) + 1);
      continue;
    }
    votes[playerId] += 1;
    ballots.push({ discordId: entry.discordId, username: entry.username, playerId });
  }
  return { votes, ballots, unmatched: [...unmatched].map(([answer, count]) => ({ answer, count })), duplicates };
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

export interface LeaderboardEntry {
  discordId: string;
  username: string;
  correct: number;
  picks: number;
}

/** Discord members ranked by correct picks over finished series with imported ballots. */
export function predictionLeaderboard(tournament: Tournament): LeaderboardEntry[] {
  const entries = new Map<string, LeaderboardEntry>();
  for (const series of tournament.series) {
    const winner = seriesWinner(series);
    if (!winner || !series.poll?.ballots) continue;
    for (const ballot of series.poll.ballots) {
      const entry = entries.get(ballot.discordId) ?? { discordId: ballot.discordId, username: ballot.username, correct: 0, picks: 0 };
      entry.picks += 1;
      if (ballot.playerId === winner) entry.correct += 1;
      if (ballot.username) entry.username = ballot.username;
      entries.set(ballot.discordId, entry);
    }
  }
  // Fewer picks for the same score means better accuracy, so it ranks higher.
  return [...entries.values()].sort((a, b) => b.correct - a.correct || a.picks - b.picks || a.username.localeCompare(b.username));
}

/** Question and answers to paste into EasyPoll's poll builder. */
export function pollPrompt(series: Series, players: readonly Player[]): { question: string; answers: string[] } {
  const names = series.playerIds.map((playerId) => players.find((player) => player.id === playerId)?.name ?? playerId);
  return { question: `${series.label}: who wins?`, answers: names };
}
