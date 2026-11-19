import { ChampionBanner } from '@/components/ChampionBanner';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Section } from '@/components/Section';
import { SeriesCard } from '@/components/SeriesCard';
import { InkBackdrop } from '@/components/viewer/InkBackdrop';
import { NowPlaying } from '@/components/viewer/NowPlaying';
import { PredictionsBoard, PredictionsDock } from '@/components/viewer/PredictionsPanel';
import { QualificationPanel } from '@/components/viewer/QualificationPanel';
import { RecentResults } from '@/components/viewer/RecentResults';
import { Seal } from '@/components/viewer/Seal';
import { useI18n } from '@/hooks/useI18n';
import { useNow } from '@/hooks/useNow';
import { useTournamentFeed } from '@/hooks/useTournamentFeed';
import { formatAgo } from '@/lib/i18n';
import { nameLookup } from '@/lib/names';
import { semifinalGroups, semifinalSeriesFrom, survivalPlan, survivalSeriesFrom } from '@/lib/qualification';
import { championOf } from '@/lib/reducer';
import { isSeriesComplete } from '@/lib/series';
import type { Series, SeriesStage, Tournament } from '@/types/tournament';

// Later stages first: once the knockouts start, they are what viewers came for.
const STAGE_SECTIONS: { stage: SeriesStage; title: 'final' | 'semis' | 'survival' | 'groups'; seal: string }[] = [
  { stage: 'final', title: 'final', seal: '决' },
  { stage: 'semi', title: 'semis', seal: '半' },
  { stage: 'survival', title: 'survival', seal: '危' },
  { stage: 'group', title: 'groups', seal: '组' },
];

/**
 * The series to show for a stage. Line-ups are public as soon as they're
 * known: the group draw during setup, the survival game once its seats are
 * settled, and the semifinal groups (seeded, or as the host arranged them)
 * before they start. Viewers see those as drafts.
 */
function sectionSeries(tournament: Tournament, stage: SeriesStage): { series: Series[]; isDraft: boolean } {
  const series = tournament.series.filter((entry) => entry.stage === stage);
  if (series.length > 0) return { series, isDraft: stage === 'group' && tournament.stage === 'setup' };
  if (stage === 'survival' && tournament.stage === 'groups') {
    const seats = survivalPlan(tournament)?.seats;
    if (seats) return { series: [survivalSeriesFrom(seats)], isDraft: true };
  }
  if (stage === 'semi' && (tournament.stage === 'groups' || tournament.stage === 'survival')) {
    const groups = semifinalGroups(tournament);
    if (groups) return { series: semifinalSeriesFrom(groups), isDraft: true };
  }
  return { series, isDraft: false };
}

function Bracket({ tournament }: { tournament: Tournament }) {
  const { t } = useI18n();
  const nameOf = nameLookup(tournament);
  return (
    <>
      {STAGE_SECTIONS.map(({ stage, title, seal }) => {
        const { series, isDraft } = sectionSeries(tournament, stage);
        if (series.length === 0) return null;
        const finished = series.filter(isSeriesComplete).length;
        const draftTitle = stage === 'group' ? t.viewer.groupDraw : t.stages[title];
        const draftAside = stage === 'semi' ? t.viewer.semisDraft : t.viewer.notStartedYet;
        return (
          <Section
            key={stage}
            title={isDraft ? draftTitle : t.stages[title]}
            aside={isDraft ? draftAside : t.viewer.finishedOf(finished, series.length)}
            icon={<Seal text={seal} />}
          >
            <div className='series-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
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

/** A cinnabar brush stroke that draws itself under the title. */
function BrushStroke() {
  return (
    <svg viewBox='0 0 260 22' className='h-5 w-56 sm:w-72' aria-hidden='true'>
      <path
        className='brush-draw'
        pathLength={1}
        d='M6 14 C 40 5, 82 18, 128 10 S 210 4, 254 11'
        fill='none'
        stroke='var(--color-red)'
        strokeWidth='7'
        strokeLinecap='round'
      />
      <path
        className='brush-draw'
        pathLength={1}
        d='M30 17 C 70 12, 120 19, 170 14 S 225 12, 240 15'
        fill='none'
        stroke='var(--color-red)'
        strokeOpacity='0.45'
        strokeWidth='2.5'
        strokeLinecap='round'
      />
    </svg>
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
    <>
      <InkBackdrop />
      <div className='mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10'>
        <header className='relative flex flex-col items-center gap-2 pt-4 text-center'>
          <div className='absolute right-0 top-0'>
            <LocaleSwitch />
          </div>
          <Seal text='武林大会' size='lg' className='animate-stamp' />
          <h1 className='mt-1 font-brush text-5xl leading-tight text-fg sm:text-7xl'>{tournament?.name ?? t.meta.defaultEventName}</h1>
          <BrushStroke />
          <p className='mt-1 flex flex-wrap items-center justify-center gap-2 text-sm text-muted'>
            {tournament && <span className='paper px-3 py-0.5 font-semibold text-fg'>{t.stages[tournament.stage]}</span>}
            {status === 'live' && updatedAt !== null && (
              <span className='flex items-center gap-1.5'>
                <span className='relative flex size-2.5'>
                  <span className='absolute inline-flex size-full animate-ping rounded-full bg-green opacity-60' />
                  <span className='relative inline-flex size-2.5 rounded-full bg-green' />
                </span>
                {t.viewer.live(formatAgo(updatedAt, now, t))}
              </span>
            )}
            {status === 'offline' && (
              <span className='flex items-center gap-1.5 text-red'>
                <span className='size-2.5 rounded-full bg-red' /> {t.viewer.reconnecting}
                {updatedAt !== null && t.viewer.lastUpdate(formatAgo(updatedAt, now, t))}
              </span>
            )}
          </p>
        </header>

        <div className='mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start'>
          <main className='viewer-stack flex min-w-0 flex-col gap-10'>
            {status === 'loading' && !tournament && <p className='text-center italic text-muted'>{t.viewer.loading}</p>}

            {status !== 'loading' && (!tournament || (tournament.stage === 'setup' && tournament.series.length === 0)) && (
              <p className='paper px-5 py-4 text-center text-muted'>{t.viewer.notStarted}</p>
            )}

            {tournament && champion && <ChampionBanner name={nameOf(champion)} />}
            {tournament && <NowPlaying tournament={tournament} nameOf={nameOf} now={now} />}
            {tournament && <QualificationPanel tournament={tournament} nameOf={nameOf} />}
            {tournament && <Bracket tournament={tournament} />}
            {tournament && <RecentResults tournament={tournament} nameOf={nameOf} now={now} />}
          </main>

          <aside className='hidden lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-3rem)] lg:flex-col'>
            <PredictionsBoard tournament={tournament ?? undefined} />
          </aside>
        </div>

        <footer className='pt-10 text-center text-xs italic text-muted'>{t.meta.footer}</footer>
      </div>
      <PredictionsDock tournament={tournament ?? undefined} />
    </>
  );
}
