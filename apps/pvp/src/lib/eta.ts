import type { Series, Tournament } from '../types/tournament.js';
import { isSeriesComplete, seriesWins } from './series.js';

// Rough "next series in about N minutes" for the viewer page, built only from
// the timestamps the host's saves already produce (no manual duration entry).

/** Gaps longer than this are breaks, not game length, so they're ignored. */
const MAX_GAP_MINUTES = 15;
const MIN_SAMPLES = 3;

/** Average minutes between consecutive saved games (fight plus changeover). */
export function averageGameMinutes(tournament: Tournament): number | undefined {
  const times = tournament.series
    .flatMap((series) => series.games.map((game) => Date.parse(game.savedAt)))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let index = 1; index < times.length; index++) {
    const minutes = (times[index] - times[index - 1]) / 60_000;
    if (minutes > 0 && minutes <= MAX_GAP_MINUTES) gaps.push(minutes);
  }
  if (gaps.length < MIN_SAMPLES) return undefined;
  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
}

/**
 * Expected games left in a series, assuming evenly matched players. From
 * 0-0-0 a first-to-2 series lasts 2.89 games on average; each state below
 * follows from "each player wins a game with probability 1/3".
 */
export function expectedRemainingGames(series: Series): number {
  if (isSeriesComplete(series)) return 0;
  if (series.winsNeeded === 1) return 1;
  const wins = seriesWins(series);
  const ones = wins.filter((count) => count === 1).length;
  if (ones === 0) return 26 / 9;
  if (ones === 1) return 17 / 9;
  if (ones === 2) return 4 / 3;
  return 1;
}

/** Minutes until the current series is likely to finish, or undefined without enough data. */
export function currentSeriesEtaMinutes(tournament: Tournament, nowMs: number): number | undefined {
  const series = tournament.series.find((candidate) => candidate.id === tournament.currentSeriesId);
  const perGame = averageGameMinutes(tournament);
  if (!series || perGame === undefined || isSeriesComplete(series)) return undefined;
  const lastSave = series.games.at(-1)?.savedAt ?? series.startedAt;
  const elapsed = lastSave ? Math.max(0, (nowMs - Date.parse(lastSave)) / 60_000) : 0;
  return Math.max(1, Math.round(expectedRemainingGames(series) * perGame - Math.min(elapsed, perGame)));
}
