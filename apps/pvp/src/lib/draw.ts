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

/**
 * Random split of the nine semifinalists into three groups of three. Players
 * who met in the same first-round group (a winner and a fill-in from it) are
 * kept apart by redrawing, which keeps every rematch-free split equally likely.
 * The attempt cap only guards against an impossible field; real ones always
 * have a rematch-free split.
 */
export function drawSemifinalGroups(
  playerIds: readonly PlayerId[],
  firstRoundGroupOf: (playerId: PlayerId) => string | undefined,
  random: Random
): [PlayerId, PlayerId, PlayerId][] {
  if (playerIds.length !== 9) throw new Error(`The semifinal draw needs 9 players, got ${playerIds.length}.`);
  const split = (order: PlayerId[]): [PlayerId, PlayerId, PlayerId][] => [0, 3, 6].map((start) => [order[start], order[start + 1], order[start + 2]]);
  const hasRematch = (group: readonly PlayerId[]) => {
    const origins = group.map(firstRoundGroupOf).filter((origin) => origin !== undefined);
    return new Set(origins).size < origins.length;
  };
  let groups = split(shuffle(playerIds, random));
  for (let attempt = 1; attempt < 1000 && groups.some(hasRematch); attempt++) groups = split(shuffle(playerIds, random));
  return groups;
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
