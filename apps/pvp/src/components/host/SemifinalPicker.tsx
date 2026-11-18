import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import { describeRecord } from '@/lib/i18n';
import { nameLookup } from '@/lib/names';
import { type SemifinalSelection, groupSeries, groupStageOutcome } from '@/lib/qualification';
import type { PlayerId, Series, Tournament } from '@/types/tournament';
import { Check } from 'lucide-react';
import { useState } from 'react';

interface SemifinalPickerProps {
  host: HostController;
  tournament: Tournament;
  selection: SemifinalSelection;
}

/**
 * The host decides who makes up the 9 semifinal spots when the group winners
 * don't fill them exactly: who takes an empty spot (21 and 24 players), or
 * which group winner sits out (30 players). Each tap saves, so viewers see the
 * picks as they're made.
 */
export function SemifinalPicker({ host, tournament, selection }: SemifinalPickerProps) {
  const { t, locale } = useI18n();
  // Once the picks are complete the long candidate list folds away, so the draw and advance buttons stay in reach on a phone.
  const [editing, setEditing] = useState(false);
  const nameOf = nameLookup(tournament);
  const { records } = groupStageOutcome(tournament);
  const groupOf = new Map<PlayerId, Series>(groupSeries(tournament).flatMap((series) => series.playerIds.map((playerId) => [playerId, series] as const)));
  const groupName = (playerId: PlayerId) => {
    const group = groupOf.get(playerId);
    return group ? t.seriesName(group) : '';
  };
  const { fillInSpots, dropSpots, fillIns, dropped } = selection;
  if (fillInSpots === 0 && dropSpots === 0) return null;

  const isFillIn = fillInSpots > 0;
  const spots = isFillIn ? fillInSpots : dropSpots;
  const picked = isFillIn ? fillIns : dropped;
  const candidates = isFillIn ? selection.fillInCandidates : selection.dropCandidates;
  const showList = editing || picked.length < spots;

  function toggle(playerId: PlayerId) {
    // With one spot, tapping someone else moves the pick instead of needing an untap first.
    const next = picked.includes(playerId) ? picked.filter((id) => id !== playerId) : spots === 1 ? [playerId] : [...picked, playerId];
    host.dispatch({ type: 'setSemifinalPicks', fillIns: isFillIn ? next : [], dropped: isFillIn ? [] : next });
  }

  return (
    <div className='flex flex-col gap-2'>
      <p className='text-sm text-fg'>
        {isFillIn ? t.picker.fillInPrompt(spots) : t.picker.dropPrompt(spots)}
        <span className='ml-2 text-xs text-muted'>{t.picker.pickedCount(picked.length, spots)}</span>
      </p>
      {!showList && (
        <p className='flex flex-wrap items-center gap-2 text-sm'>
          <span className={isFillIn ? 'font-semibold text-gold' : 'font-semibold text-red'}>
            {picked.map((playerId) => `${nameOf(playerId)} (${groupName(playerId)})`).join(', ')}
          </span>
          <button type='button' onClick={() => setEditing(true)} className='text-xs text-muted underline hover:text-fg'>
            {t.picker.change}
          </button>
        </p>
      )}
      {showList && (
        <p className='text-xs text-muted'>
          {isFillIn ? t.picker.listedFillIn : t.picker.listedDrop}
          {editing && picked.length === spots && (
            <button type='button' onClick={() => setEditing(false)} className='ml-2 underline hover:text-fg'>
              {t.picker.done}
            </button>
          )}
        </p>
      )}
      <div className={showList ? 'grid gap-1.5 sm:grid-cols-2' : 'hidden'}>
        {candidates.map((playerId) => {
          const isPicked = picked.includes(playerId);
          const full = !isPicked && spots > 1 && picked.length >= spots;
          return (
            <button
              key={playerId}
              type='button'
              disabled={full}
              onClick={() => toggle(playerId)}
              className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition disabled:opacity-40 ${
                isPicked
                  ? isFillIn
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-red/60 bg-red/10 text-red'
                  : 'border-border text-fg enabled:hover:bg-surface-hover'
              }`}
            >
              <span className='flex min-w-0 items-center gap-1.5'>
                {isPicked && <Check size={14} className='shrink-0' />}
                <span className='truncate'>{nameOf(playerId)}</span>
                <span className='shrink-0 text-xs text-muted'>{groupName(playerId)}</span>
              </span>
              <span className='shrink-0 text-xs text-muted'>{describeRecord(records.get(playerId), t, locale)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
