import { Section } from '@/components/Section';
import { SeriesCard } from '@/components/SeriesCard';
import { GameEntry } from '@/components/host/GameEntry';
import { PollPanel } from '@/components/host/PollPanel';
import { StageGate } from '@/components/host/StageGate';
import type { HostController } from '@/hooks/useHostTournament';
import { STAGE_LABELS, nameLookup } from '@/lib/names';
import { isStageComplete, playableSeries } from '@/lib/reducer';
import { isSeriesComplete } from '@/lib/series';
import type { Tournament } from '@/types/tournament';
import { useState } from 'react';

interface RunPanelProps {
  host: HostController;
  tournament: Tournament;
}

/** The current stage's series, result entry and poll for the selected one, and the stage gate. */
export function RunPanel({ host, tournament }: RunPanelProps) {
  const [selectedId, setSelectedId] = useState<string>();
  const series = playableSeries(tournament);
  const nameOf = nameLookup(tournament);
  const fallbackId =
    series.find((entry) => entry.id === tournament.currentSeriesId && !isSeriesComplete(entry))?.id ??
    series.find((entry) => !isSeriesComplete(entry))?.id ??
    series[0]?.id;
  const selected = series.find((entry) => entry.id === selectedId) ?? series.find((entry) => entry.id === fallbackId);
  const finished = series.filter(isSeriesComplete).length;

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

      <Section title={STAGE_LABELS[tournament.stage]} aside={`${finished} of ${series.length} finished · tap a series to select it`}>
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
    </div>
  );
}
