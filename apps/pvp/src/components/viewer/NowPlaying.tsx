import { Section } from '@/components/Section';
import { SeriesCard } from '@/components/SeriesCard';
import { useI18n } from '@/hooks/useI18n';
import { currentSeriesEtaMinutes } from '@/lib/eta';
import { playableSeries } from '@/lib/reducer';
import { isSeriesComplete } from '@/lib/series';
import type { PlayerId, Tournament } from '@/types/tournament';

interface NowPlayingProps {
  tournament: Tournament;
  nameOf: (playerId: PlayerId) => string;
  now: number;
}

export function NowPlaying({ tournament, nameOf, now }: NowPlayingProps) {
  const { t } = useI18n();
  const current = tournament.series.find((series) => series.id === tournament.currentSeriesId && !isSeriesComplete(series));
  const onDeck = playableSeries(tournament).find((series) => !isSeriesComplete(series) && series.id !== current?.id);
  if (!current && !onDeck) return null;
  const eta = current ? currentSeriesEtaMinutes(tournament, now) : undefined;

  return (
    <Section title={t.viewer.nowPlaying}>
      {current ? (
        <SeriesCard series={current} nameOf={nameOf} live />
      ) : (
        <p className='rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted'>{t.viewer.waiting}</p>
      )}
      {onDeck && (
        <p className='text-sm text-muted'>
          {t.viewer.onDeck} <span className='font-semibold text-fg'>{t.seriesName(onDeck)}</span> ({onDeck.playerIds.map(nameOf).join(', ')})
          {eta !== undefined && <> · {t.viewer.inAbout(eta)}</>}
        </p>
      )}
    </Section>
  );
}
