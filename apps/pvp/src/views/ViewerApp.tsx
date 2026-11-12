import { ChampionBanner } from '@/components/ChampionBanner';
import { Section } from '@/components/Section';
import { SeriesCard } from '@/components/SeriesCard';
import { NowPlaying } from '@/components/viewer/NowPlaying';
import { PredictionsPanel } from '@/components/viewer/PredictionsPanel';
import { QualificationPanel } from '@/components/viewer/QualificationPanel';
import { RecentResults } from '@/components/viewer/RecentResults';
import { useNow } from '@/hooks/useNow';
import { useTournamentFeed } from '@/hooks/useTournamentFeed';
import { STAGE_LABELS, nameLookup } from '@/lib/names';
import { championOf } from '@/lib/reducer';
import { isSeriesComplete } from '@/lib/series';
import { formatAgo } from '@/lib/time';
import type { SeriesStage, Tournament } from '@/types/tournament';
import { Swords } from 'lucide-react';

// Later stages first: once the knockouts start, they are what viewers came for.
const STAGE_SECTIONS: { stage: SeriesStage; title: string }[] = [
  { stage: 'final', title: 'Grand final' },
  { stage: 'semi', title: 'Semifinals' },
  { stage: 'playIn', title: 'Play-in' },
  { stage: 'group', title: 'Group stage' },
];

function Bracket({ tournament }: { tournament: Tournament }) {
  const nameOf = nameLookup(tournament);
  return (
    <>
      {STAGE_SECTIONS.map(({ stage, title }) => {
        const series = tournament.series.filter((entry) => entry.stage === stage);
        if (series.length === 0) return null;
        const finished = series.filter(isSeriesComplete).length;
        const isDrawPreview = stage === 'group' && tournament.stage === 'setup';
        return (
          <Section
            key={stage}
            title={isDrawPreview ? 'Group draw' : title}
            aside={isDrawPreview ? 'Not started yet' : `${finished} of ${series.length} finished`}
          >
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
  const { tournament, status, updatedAt } = useTournamentFeed();
  const now = useNow();
  const nameOf = tournament ? nameLookup(tournament) : (playerId: string) => playerId;
  const champion = tournament ? championOf(tournament) : undefined;

  return (
    <div className='mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8'>
      <header className='flex flex-col gap-1'>
        <h1 className='flex items-center gap-2 text-2xl font-bold text-gold'>
          <Swords size={24} /> {tournament?.name ?? 'Guild PvP Tournament'}
        </h1>
        <p className='flex flex-wrap items-center gap-2 text-sm text-muted'>
          {tournament && <span className='rounded-md border border-border px-2 py-0.5 text-fg'>{STAGE_LABELS[tournament.stage]}</span>}
          {status === 'live' && updatedAt !== null && (
            <span className='flex items-center gap-1.5'>
              <span className='size-2 rounded-full bg-green' /> Live · updated {formatAgo(updatedAt, now)}
            </span>
          )}
          {status === 'offline' && (
            <span className='flex items-center gap-1.5 text-red'>
              <span className='size-2 rounded-full bg-red' /> Reconnecting…{updatedAt !== null && ` last update ${formatAgo(updatedAt, now)}`}
            </span>
          )}
        </p>
      </header>

      {status === 'loading' && !tournament && <p className='text-muted'>Loading the bracket…</p>}

      {status !== 'loading' && (!tournament || (tournament.stage === 'setup' && tournament.series.length === 0)) && (
        <p className='rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted'>
          The tournament hasn’t started yet. This page updates by itself, so keep it open.
        </p>
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

      <footer className='pt-2 text-center text-xs text-muted'>
        Unofficial fan tool for the Where Winds Meet guild, not affiliated with Everstone Studios.
      </footer>
    </div>
  );
}
