import { useI18n } from '@/hooks/useI18n';
import type { Messages } from '@/lib/i18n';
import { crowdFavorite, crowdGamesPick, gamesLineOf, gamesOutcome, gamesShares, hasGamesPrediction, voteShares } from '@/lib/polls';
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

function statusOf(series: Series, live: boolean, t: Messages): { text: string; className: string; isLive: boolean } {
  if (seriesWinner(series)) return { text: t.card.finished, className: 'text-muted', isLive: false };
  if (live) return { text: t.card.live, className: 'text-green', isLive: true };
  if (series.startedAt || series.games.length > 0) return { text: t.card.inProgress, className: 'text-gold', isLive: false };
  return { text: t.card.upcoming, className: 'text-muted', isLive: false };
}

/** The over/under line for a series: the line, how Discord voted, and how it ended. Shown once the host has set a line or recorded votes. */
function GamesLine({ series }: { series: Series }) {
  const { t, decimal } = useI18n();
  if (!hasGamesPrediction(series) || (series.gamesLine === undefined && !series.gamesPoll)) return null;
  const line = series.gamesPoll?.line ?? gamesLineOf(series);
  const shares = gamesShares(series);
  const crowdPick = crowdGamesPick(series);
  const outcome = gamesOutcome(series);
  const games = series.games.length;
  const result =
    outcome === 'over' ? t.card.resultOver(games) : outcome === 'under' ? t.card.resultUnder(games) : outcome === 'push' ? t.card.resultPush(games) : undefined;

  return (
    <p className='flex flex-wrap items-center gap-x-2 text-xs text-muted'>
      <span>{t.card.overUnder(decimal(line))}</span>
      {shares && (
        <span>
          · <span className={crowdPick === 'over' ? 'text-fg' : undefined}>{t.card.overShare(shares.over)}</span>,{' '}
          <span className={crowdPick === 'under' ? 'text-fg' : undefined}>{t.card.underShare(shares.under)}</span>
        </span>
      )}
      {result && <span className='font-semibold text-gold'>· {result}</span>}
    </p>
  );
}

/**
 * One group of three: each player's finish in every game, their win pips, the
 * Discord crowd's vote share, the over/under prediction, and the winner
 * highlighted. Shared by the viewer and host pages so both read the bracket
 * the same way.
 */
export function SeriesCard({ series, nameOf, live = false, selected = false, onSelect }: SeriesCardProps) {
  const { t } = useI18n();
  const winner = seriesWinner(series);
  const wins = seriesWins(series);
  const shares = voteShares(series);
  const favorite = crowdFavorite(series);
  const status = statusOf(series, live, t);

  const body = (
    <>
      <div className='flex items-center justify-between gap-2'>
        <span className='font-semibold text-fg'>{t.seriesName(series)}</span>
        <span className={`flex items-center gap-1 text-xs ${status.className}`}>
          {status.isLive && <Radio size={12} />}
          {status.text}
          <span className='text-muted'>· {series.winsNeeded === 1 ? t.common.oneMatch : t.common.firstTo2}</span>
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
                  <span className={`shrink-0 text-xs ${favorite === playerId ? 'text-fg' : 'text-muted'}`} title={t.card.discordVotes(share.votes)}>
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
                      title={t.card.gamePlace(gameIndex + 1, t.common.places[place])}
                      className={`flex size-5 items-center justify-center rounded text-[11px] font-semibold ${PLACE_STYLES[place]}`}
                    >
                      {place + 1}
                    </span>
                  );
                })}
                <span className='ml-1 flex gap-0.5' aria-label={t.card.winsOf(wins[index], series.winsNeeded)}>
                  {Array.from({ length: series.winsNeeded }, (_, pip) => (
                    <span key={pip} className={`size-2 rounded-full ${pip < wins[index] ? 'bg-gold' : 'bg-border'}`} />
                  ))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <GamesLine series={series} />
      {series.winnerOverride && <p className='text-xs text-muted'>{t.card.ruling(series.winnerOverride.reason)}</p>}
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
