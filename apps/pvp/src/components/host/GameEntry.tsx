import { Button } from '@/components/Button';
import type { HostController } from '@/hooks/useHostTournament';
import { nameLookup } from '@/lib/names';
import { seriesWinner, seriesWins } from '@/lib/series';
import type { Placement, PlayerId, Series, Tournament } from '@/types/tournament';
import { Crown, Play, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface GameEntryProps {
  host: HostController;
  tournament: Tournament;
  series: Series;
}

const PLACES = ['1st', '2nd', '3rd'];

/**
 * Two-tap result entry: tap the winner, then the runner-up; third place fills
 * itself in. Saving the first game also marks the series live, so "Start" is
 * only needed to show viewers which series is up before anyone wins.
 */
export function GameEntry({ host, tournament, series }: GameEntryProps) {
  const [picks, setPicks] = useState<PlayerId[]>([]);
  const nameOf = nameLookup(tournament);
  const winner = seriesWinner(series);
  const wins = seriesWins(series);
  const isLive = tournament.currentSeriesId === series.id;

  // A saved or undone game (or switching series) starts a fresh pick.
  useEffect(() => setPicks([]), [series.id, series.games.length]);

  const third = picks.length === 2 ? series.playerIds.find((playerId) => !picks.includes(playerId)) : undefined;
  const placement: Placement | undefined = third && picks.length === 2 ? [picks[0], picks[1], third] : undefined;

  function toggle(playerId: PlayerId) {
    setPicks((current) => (current.includes(playerId) ? current.filter((id) => id !== playerId) : current.length < 2 ? [...current, playerId] : current));
  }

  // Clearing in the same click (not only in the effect) keeps a double tap from saving the game twice.
  function save(placement: Placement) {
    setPicks([]);
    host.dispatch({ type: 'saveGame', seriesId: series.id, placement });
  }

  return (
    <div className='flex flex-col gap-3 rounded-lg border border-border bg-surface p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='font-semibold text-fg'>
          {series.label}
          <span className='ml-2 text-sm font-normal text-muted'>
            {series.winsNeeded === 1
              ? winner
                ? 'finished · one match'
                : 'one match'
              : `${winner ? 'finished' : `game ${series.games.length + 1}`} · first to 2`}
          </span>
        </h3>
        {!winner && !isLive && (
          <Button onClick={() => host.dispatch({ type: 'startSeries', seriesId: series.id })}>
            <Play size={14} /> Show as live
          </Button>
        )}
        {isLive && !winner && <span className='text-xs text-green'>Live for viewers</span>}
      </div>

      {winner ? (
        <p className='flex items-center gap-2 text-gold'>
          <Crown size={16} /> {nameOf(winner)} wins {series.label}
          {series.winnerOverride && <span className='text-xs text-muted'>(ruling: {series.winnerOverride.reason})</span>}
        </p>
      ) : (
        <>
          <p className='text-sm text-muted'>Tap the winner, then the runner-up.</p>
          <div className='grid gap-2 sm:grid-cols-3'>
            {series.playerIds.map((playerId, index) => {
              const place = picks.indexOf(playerId);
              const shownPlace = place >= 0 ? place : playerId === third ? 2 : -1;
              return (
                <button
                  key={playerId}
                  type='button'
                  onClick={() => toggle(playerId)}
                  className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition ${
                    shownPlace === 0 ? 'border-gold bg-gold/10' : shownPlace >= 0 ? 'border-fg/40 bg-surface-hover' : 'border-border hover:bg-surface-hover'
                  }`}
                >
                  <span className='font-semibold text-fg'>{nameOf(playerId)}</span>
                  <span className='text-xs text-muted'>
                    {shownPlace >= 0 ? PLACES[shownPlace] : 'tap'} · {wins[index]} {wins[index] === 1 ? 'win' : 'wins'}
                  </span>
                </button>
              );
            })}
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='primary' disabled={!placement} onClick={() => placement && save(placement)}>
              Save game
            </Button>
            <Button onClick={() => setPicks([])} disabled={picks.length === 0}>
              Clear picks
            </Button>
          </div>
        </>
      )}

      {series.games.length > 0 && (
        <div className='flex flex-col gap-2 border-t border-border pt-3'>
          <ol className='flex flex-col gap-1 text-sm'>
            {series.games.map((game, index) => (
              <li key={index} className='text-muted'>
                Game {index + 1}: <span className='text-gold'>{nameOf(game.placement[0])}</span>, {nameOf(game.placement[1])}, {nameOf(game.placement[2])}
              </li>
            ))}
          </ol>
          <div>
            <Button onClick={() => host.dispatch({ type: 'undoGame', seriesId: series.id })}>
              <Undo2 size={14} /> Undo last game
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
