import { ChampionBanner } from '@/components/ChampionBanner';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Section } from '@/components/Section';
import { SeriesCard } from '@/components/SeriesCard';
import { NowPlaying } from '@/components/viewer/NowPlaying';
import { PredictionsPanel } from '@/components/viewer/PredictionsPanel';
import { QualificationPanel } from '@/components/viewer/QualificationPanel';
import { RecentResults } from '@/components/viewer/RecentResults';
import { useI18n } from '@/hooks/useI18n';
import { useNow } from '@/hooks/useNow';
import { useTournamentFeed } from '@/hooks/useTournamentFeed';
import { formatAgo } from '@/lib/i18n';
import { nameLookup } from '@/lib/names';
import { semifinalGroups, semifinalSeriesFrom } from '@/lib/qualification';
import { championOf } from '@/lib/reducer';
import { isSeriesComplete } from '@/lib/series';
import type { Series, SeriesStage, Tournament } from '@/types/tournament';
import { Swords } from 'lucide-react';

// Later stages first: once the knockouts start, they are what viewers came for.
const STAGE_SECTIONS: { stage: SeriesStage; title: 'final' | 'semis' | 'groups' }[] = [
  { stage: 'final', title: 'final' },
  { stage: 'semi', title: 'semis' },
  { stage: 'group', title: 'groups' },
];

/**
 * The series to show for a stage. Before the semifinals start, their groups
 * are already known (seeded, or as the host arranged them), so viewers see
 * them as a draft, the same way they see the group draw during setup.
 */
function sectionSeries(tournament: Tournament, stage: SeriesStage): { series: Series[]; isDraft: boolean } {
  const series = tournament.series.filter((entry) => entry.stage === stage);
  if (stage === 'semi' && series.length === 0 && tournament.stage === 'groups') {
    const groups = semifinalGroups(tournament);
    if (groups) return { series: semifinalSeriesFrom(groups, tournament.lateRule), isDraft: true };
  }
  return { series, isDraft: stage === 'group' && tournament.stage === 'setup' };
}

function Bracket({ tournament }: { tournament: Tournament }) {
  const { t } = useI18n();
  const nameOf = nameLookup(tournament);
  return (
    <>
      {STAGE_SECTIONS.map(({ stage, title }) => {
        const { series, isDraft } = sectionSeries(tournament, stage);
        if (series.length === 0) return null;
        const finished = series.filter(isSeriesComplete).length;
        const draftTitle = stage === 'group' ? t.viewer.groupDraw : t.stages[title];
        const draftAside = stage === 'group' ? t.viewer.notStartedYet : t.viewer.semisDraft;
        return (
          <Section key={stage} title={isDraft ? draftTitle : t.stages[title]} aside={isDraft ? draftAside : t.viewer.finishedOf(finished, series.length)}>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {series.map((entry) => (
                <SeriesCard key={entry.id} series={entry} nameOf={nameOf} live={entry.id === tournament.currentSeriesId && !isSeriesComplete(entry)} />
              ))}
            </div>
          </Section>
        );
      })}
    </>
  );
}

/** Read-only live page. Polls the public state; see useTournamentFeed. */
export function ViewerApp() {
  const { t } = useI18n();
  const { tournament, status, updatedAt } = useTournamentFeed();
  const now = useNow();
  const nameOf = tournament ? nameLookup(tournament) : (playerId: string) => playerId;
  const champion = tournament ? championOf(tournament) : undefined;

  return (
    <div className='mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8'>
      <header className='flex flex-col gap-1'>
        <div className='flex items-start justify-between gap-3'>
          <h1 className='flex items-center gap-2 text-2xl font-bold text-gold'>
            <Swords size={24} /> {tournament?.name ?? t.meta.defaultEventName}
          </h1>
          <LocaleSwitch />
        </div>
        <p className='flex flex-wrap items-center gap-2 text-sm text-muted'>
          {tournament && <span className='rounded-md border border-border px-2 py-0.5 text-fg'>{t.stages[tournament.stage]}</span>}
          {status === 'live' && updatedAt !== null && (
            <span className='flex items-center gap-1.5'>
              <span className='size-2 rounded-full bg-green' /> {t.viewer.live(formatAgo(updatedAt, now, t))}
            </span>
          )}
          {status === 'offline' && (
            <span className='flex items-center gap-1.5 text-red'>
              <span className='size-2 rounded-full bg-red' /> {t.viewer.reconnecting}
              {updatedAt !== null && t.viewer.lastUpdate(formatAgo(updatedAt, now, t))}
            </span>
          )}
        </p>
      </header>

      {status === 'loading' && !tournament && <p className='text-muted'>{t.viewer.loading}</p>}

      {status !== 'loading' && (!tournament || (tournament.stage === 'setup' && tournament.series.length === 0)) && (
        <p className='rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted'>{t.viewer.notStarted}</p>
      )}

      {tournament && (
        <>
          {champion && <ChampionBanner name={nameOf(champion)} />}
          <NowPlaying tournament={tournament} nameOf={nameOf} now={now} />
          <QualificationPanel tournament={tournament} nameOf={nameOf} />
          <Bracket tournament={tournament} />
          <PredictionsPanel tournament={tournament} />
          <RecentResults tournament={tournament} nameOf={nameOf} now={now} />
        </>
      )}

      <footer className='pt-2 text-center text-xs text-muted'>{t.meta.footer}</footer>
    </div>
  );
}
