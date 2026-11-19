import { Section } from '@/components/Section';
import { Seal } from '@/components/viewer/Seal';
import { useI18n } from '@/hooks/useI18n';
import { formatAgo } from '@/lib/i18n';
import type { PlayerId, Tournament } from '@/types/tournament';

interface RecentResultsProps {
  tournament: Tournament;
  nameOf: (playerId: PlayerId) => string;
  now: number;
}

const FEED_SIZE = 8;

export function RecentResults({ tournament, nameOf, now }: RecentResultsProps) {
  const { t } = useI18n();
  // Series and games are stored in play order, so the flat position breaks ties between identical timestamps.
  const games = tournament.series
    .flatMap((series) => series.games.map((game, index) => ({ series, game, number: index + 1 })))
    .map((entry, position) => ({ ...entry, position }))
    .sort((a, b) => Date.parse(b.game.savedAt) - Date.parse(a.game.savedAt) || b.position - a.position)
    .slice(0, FEED_SIZE);
  if (games.length === 0) return null;

  return (
    <Section title={t.viewer.recentResults} icon={<Seal text='录' />}>
      <ul className='paper flex flex-col divide-y divide-dashed divide-border overflow-hidden'>
        {games.map(({ series, game, number }) => (
          <li key={`${series.id}-${number}`} className='feed-item flex items-center justify-between gap-3 px-4 py-2.5 text-sm'>
            <span>
              <span className='text-muted'>{t.viewer.gameOf(t.seriesName(series), number)}</span>{' '}
              <span className='font-bold text-gold'>{nameOf(game.placement[0])}</span> {t.viewer.won}
              <span className='text-muted'>{t.viewer.then(nameOf(game.placement[1]), nameOf(game.placement[2]))}</span>
            </span>
            <span className='shrink-0 text-xs italic text-muted'>{formatAgo(Date.parse(game.savedAt), now, t)}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
