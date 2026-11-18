import { Section } from '@/components/Section';
import { SeriesCard } from '@/components/SeriesCard';
import { GameEntry } from '@/components/host/GameEntry';
import { PollPanel } from '@/components/host/PollPanel';
import { RearrangePanel } from '@/components/host/RearrangePanel';
import { StageGate } from '@/components/host/StageGate';
import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import { nameLookup } from '@/lib/names';
import { isStageComplete, playableSeries } from '@/lib/reducer';
import { isSeriesComplete } from '@/lib/series';
import type { Tournament } from '@/types/tournament';
import { useState } from 'react';

interface RunPanelProps {
  host: HostController;
  tournament: Tournament;
}

/** The current stage's series, result entry and polls for the selected one, the stage gate, and swaps for groups not yet started. */
export function RunPanel({ host, tournament }: RunPanelProps) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string>();
  const series = playableSeries(tournament);
  const nameOf = nameLookup(tournament);
  const fallbackId =
    series.find((entry) => entry.id === tournament.currentSeriesId && !isSeriesComplete(entry))?.id ??
    series.find((entry) => !isSeriesComplete(entry))?.id ??
    series[0]?.id;
  const selected = series.find((entry) => entry.id === selectedId) ?? series.find((entry) => entry.id === fallbackId);
  const finished = series.filter(isSeriesComplete).length;
  const notStarted = series.filter((entry) => entry.games.length === 0 && !entry.winnerOverride);
  const canRearrange = (tournament.stage === 'groups' || tournament.stage === 'semis') && notStarted.length >= 2;

  // Entry comes before the list so the host, often on a phone, never scrolls past nine cards to record a game.
  return (
    <div className='flex flex-col gap-6'>
      {isStageComplete(tournament) && <StageGate host={host} tournament={tournament} />}

      {selected && (
        <div className='grid gap-4 lg:grid-cols-2'>
          <GameEntry host={host} tournament={tournament} series={selected} />
          <PollPanel host={host} tournament={tournament} series={selected} />
        </div>
      )}

      <Section title={t.stages[tournament.stage]} aside={t.run.listAside(finished, series.length)}>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {series.map((entry) => (
            <SeriesCard
              key={entry.id}
              series={entry}
              nameOf={nameOf}
              live={entry.id === tournament.currentSeriesId && !isSeriesComplete(entry)}
              selected={entry.id === selected?.id}
              onSelect={() => setSelectedId(entry.id)}
            />
          ))}
        </div>
      </Section>

      {/* Collapsed by default so a stray tap during the event can't swap anyone. */}
      {canRearrange && (
        <details className='rounded-lg border border-border bg-surface/50 p-4'>
          <summary className='cursor-pointer font-semibold text-fg'>{t.rearrange.title}</summary>
          <div className='mt-3'>
            <RearrangePanel host={host} tournament={tournament} series={series} />
          </div>
        </details>
      )}
    </div>
  );
}
