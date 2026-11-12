import { Section } from '@/components/Section';
import { formatAgo } from '@/lib/time';
import type { PlayerId, Tournament } from '@/types/tournament';

interface RecentResultsProps {
  tournament: Tournament;
  nameOf: (playerId: PlayerId) => string;
  now: number;
}

const FEED_SIZE = 8;

export function RecentResults({ tournament, nameOf, now }: RecentResultsProps) {
  // Series and games are stored in play order, so the flat position breaks ties between identical timestamps.
  const games = tournament.series
    .flatMap((series) => series.games.map((game, index) => ({ series, game, number: index + 1 })))
    .map((entry, position) => ({ ...entry, position }))
    .sort((a, b) => Date.parse(b.game.savedAt) - Date.parse(a.game.savedAt) || b.position - a.position)
    .slice(0, FEED_SIZE);
  if (games.length === 0) return null;

  return (
    <Section title='Recent results'>
      <ul className='flex flex-col divide-y divide-border rounded-lg border border-border bg-surface'>
        {games.map(({ series, game, number }) => (
          <li key={`${series.id}-${number}`} className='flex items-center justify-between gap-3 px-4 py-2 text-sm'>
            <span>
              <span className='text-muted'>
                {series.label} · game {number}:
              </span>{' '}
              <span className='font-semibold text-gold'>{nameOf(game.placement[0])}</span> won
              <span className='text-muted'>
                , then {nameOf(game.placement[1])}, {nameOf(game.placement[2])}
              </span>
            </span>
            <span className='shrink-0 text-xs text-muted'>{formatAgo(Date.parse(game.savedAt), now)}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
