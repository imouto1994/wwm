import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import type { Translatable } from '@/lib/i18n';
import { nameLookup } from '@/lib/names';
import { groupSeries } from '@/lib/qualification';
import type { PlayerId, Series, Tournament } from '@/types/tournament';
import { ArrowLeftRight, Lock } from 'lucide-react';
import { useState } from 'react';

interface RearrangePanelProps {
  host: HostController;
  tournament: Tournament;
  /** The series whose players can be swapped: the group draw, or the semifinals. */
  series: Series[];
}

const isLocked = (series: Series) => series.games.length > 0 || Boolean(series.winnerOverride);

/** Players in a semifinal who already met in the same first-round group. */
function rematchesIn(series: Series, firstRoundGroupOf: Map<PlayerId, Series>): PlayerId[] {
  if (series.stage !== 'semi') return [];
  return series.playerIds.filter((playerId, index) =>
    series.playerIds.some((other, otherIndex) => otherIndex !== index && firstRoundGroupOf.get(other)?.id === firstRoundGroupOf.get(playerId)?.id)
  );
}

/**
 * Two-tap swap: tap a player, then a player in another group, and they trade
 * places. Series that have a result are locked. Swapping the same two players
 * again undoes it.
 */
export function RearrangePanel({ host, tournament, series }: RearrangePanelProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<PlayerId>();
  const [note, setNote] = useState<Translatable>();
  const nameOf = nameLookup(tournament);
  const firstRoundGroupOf = new Map(groupSeries(tournament).flatMap((group) => group.playerIds.map((playerId) => [playerId, group] as const)));
  const seriesOf = (playerId: PlayerId) => series.find((entry) => entry.playerIds.includes(playerId));
  const selectedSeries = selected ? seriesOf(selected) : undefined;

  function choose(playerId: PlayerId) {
    if (!selected || selected === playerId || seriesOf(playerId)?.id === selectedSeries?.id) {
      setSelected(selected === playerId ? undefined : playerId);
      setNote(undefined);
      return;
    }
    const cleared = [selectedSeries, seriesOf(playerId)].filter((entry): entry is Series => Boolean(entry?.poll || entry?.gamesPoll));
    const first = nameOf(selected);
    const second = nameOf(playerId);
    if (host.dispatch({ type: 'swapPlayers', firstId: selected, secondId: playerId })) {
      const message: Translatable = (messages) =>
        messages.rearrange.swapped(first, second) +
        (cleared.length > 0 ? messages.rearrange.pollsCleared(cleared.map((entry) => messages.seriesName(entry)).join(', ')) : '');
      // Wrapped because React would call a bare function as a state updater.
      setNote(() => message);
    }
    setSelected(undefined);
  }

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-sm text-muted'>{selected ? t.rearrange.selected(nameOf(selected)) : t.rearrange.help}</p>
      {note && (
        <p className='flex items-center gap-2 text-sm text-green'>
          <ArrowLeftRight size={14} className='shrink-0' /> {note(t)}
        </p>
      )}
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {series.map((entry) => {
          const locked = isLocked(entry);
          const rematches = rematchesIn(entry, firstRoundGroupOf);
          return (
            <div key={entry.id} className={`flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 ${locked ? 'opacity-60' : ''}`}>
              <div className='flex items-center justify-between gap-2'>
                <span className='font-semibold text-fg'>{t.seriesName(entry)}</span>
                {locked && (
                  <span className='flex items-center gap-1 text-xs text-muted'>
                    <Lock size={12} /> {t.rearrange.started}
                  </span>
                )}
              </div>
              <div className='flex flex-wrap gap-1.5'>
                {entry.playerIds.map((playerId) => {
                  const origin = firstRoundGroupOf.get(playerId);
                  return (
                    <button
                      key={playerId}
                      type='button'
                      disabled={locked}
                      onClick={() => choose(playerId)}
                      className={`rounded-md border px-2.5 py-1.5 text-left text-sm transition disabled:cursor-not-allowed ${
                        selected === playerId ? 'border-gold bg-gold/10 text-gold' : 'border-border text-fg enabled:hover:bg-surface-hover'
                      }`}
                    >
                      {nameOf(playerId)}
                      {entry.stage === 'semi' && origin && <span className='ml-2 text-xs text-muted'>{t.seriesName(origin)}</span>}
                    </button>
                  );
                })}
              </div>
              {rematches.length > 0 && <p className='text-xs text-gold'>{t.rearrange.rematch(rematches.map(nameOf).join(', '))}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
