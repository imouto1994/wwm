import type { PlayerId, Series } from '../types/tournament.js';

/** Injectable random source: the host page passes a crypto-backed one, scripts can pass a seeded one. */
export type Random = () => number;

/** Fisher-Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/** Random draw into first-to-2 groups of three, numbered in play order. */
export function drawGroupSeries(playerIds: readonly PlayerId[], random: Random): Series[] {
  if (playerIds.length % 3 !== 0) throw new Error('Players must split evenly into groups of three.');
  const shuffled = shuffle(playerIds, random);
  const series: Series[] = [];
  for (let index = 0; index < shuffled.length; index += 3) {
    const number = index / 3 + 1;
    series.push({
      id: `G${number}`,
      stage: 'group',
      label: `Group ${number}`,
      playerIds: [shuffled[index], shuffled[index + 1], shuffled[index + 2]],
      winsNeeded: 2,
      games: [],
    });
  }
  return series;
}
