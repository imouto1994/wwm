import { crowdFavorite, voteShares } from '@/lib/polls';
import { seriesWinner, seriesWins } from '@/lib/series';
import type { PlayerId, Series } from '@/types/tournament';
import { Crown, Radio } from 'lucide-react';

interface SeriesCardProps {
  series: Series;
  nameOf: (playerId: PlayerId) => string;
  /** Highlights the series as the one being played right now. */
  live?: boolean;
  /** Host only: marks the series picked in the host's list. */
  selected?: boolean;
  /** Host only: turns the card into a button. */
  onSelect?: () => void;
}

const PLACE_STYLES = ['bg-gold text-bg', 'bg-surface-hover text-fg', 'bg-transparent text-muted border border-border'];

function statusOf(series: Series, live: boolean): { text: string; className: string } {
  if (seriesWinner(series)) return { text: 'Finished', className: 'text-muted' };
  if (live) return { text: 'Live', className: 'text-green' };
  if (series.startedAt || series.games.length > 0) return { text: 'In progress', className: 'text-gold' };
  return { text: 'Upcoming', className: 'text-muted' };
}

/**
 * One group of three: each player's finish in every game, their win pips, the
 * Discord crowd's vote share, and the winner highlighted. Shared by the viewer
 * and host pages so both read the bracket the same way.
 */
export function SeriesCard({ series, nameOf, live = false, selected = false, onSelect }: SeriesCardProps) {
  const winner = seriesWinner(series);
  const wins = seriesWins(series);
  const shares = voteShares(series);
  const favorite = crowdFavorite(series);
  const status = statusOf(series, live);

  const body = (
    <>
      <div className='flex items-center justify-between gap-2'>
        <span className='font-semibold text-fg'>{series.label}</span>
        <span className={`flex items-center gap-1 text-xs ${status.className}`}>
          {status.text === 'Live' && <Radio size={12} />}
          {status.text}
          <span className='text-muted'>· {series.winsNeeded === 1 ? 'one match' : 'first to 2'}</span>
        </span>
      </div>
      <ul className='flex flex-col gap-1.5'>
        {series.playerIds.map((playerId, index) => {
          const isWinner = winner === playerId;
          const share = shares?.[index];
          return (
            <li key={playerId} className='flex items-center justify-between gap-2 text-sm'>
              <span className={`flex min-w-0 items-center gap-1.5 ${isWinner ? 'font-semibold text-gold' : winner ? 'text-muted' : 'text-fg'}`}>
                {isWinner && <Crown size={14} className='shrink-0' />}
                <span className='truncate'>{nameOf(playerId)}</span>
                {share && (
                  <span className={`shrink-0 text-xs ${favorite === playerId ? 'text-fg' : 'text-muted'}`} title={`${share.votes} Discord votes`}>
                    {share.percent}%
                  </span>
                )}
              </span>
              <span className='flex shrink-0 items-center gap-1'>
                {series.games.map((game, gameIndex) => {
                  const place = game.placement.indexOf(playerId);
                  return (
                    <span
                      key={gameIndex}
                      title={`Game ${gameIndex + 1}: ${['1st', '2nd', '3rd'][place]}`}
                      className={`flex size-5 items-center justify-center rounded text-[11px] font-semibold ${PLACE_STYLES[place]}`}
                    >
                      {place + 1}
                    </span>
                  );
                })}
                <span className='ml-1 flex gap-0.5' aria-label={`${wins[index]} of ${series.winsNeeded} wins`}>
                  {Array.from({ length: series.winsNeeded }, (_, pip) => (
                    <span key={pip} className={`size-2 rounded-full ${pip < wins[index] ? 'bg-gold' : 'bg-border'}`} />
                  ))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {series.winnerOverride && <p className='text-xs text-muted'>Decided by ruling: {series.winnerOverride.reason}</p>}
    </>
  );

  const frame = `flex w-full flex-col gap-2 rounded-lg border bg-surface p-3 text-left ${
    live ? 'border-green/60' : selected ? 'border-gold' : 'border-border'
  }`;

  return onSelect ? (
    <button type='button' onClick={onSelect} className={`${frame} transition hover:bg-surface-hover`}>
      {body}
    </button>
  ) : (
    <div className={frame}>{body}</div>
  );
}
