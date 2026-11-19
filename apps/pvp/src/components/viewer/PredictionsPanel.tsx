import { Seal } from '@/components/viewer/Seal';
import { useI18n } from '@/hooks/useI18n';
import { type LeaderboardEntry, crowdGamesRecord, crowdRecord, predictionLeaderboard } from '@/lib/polls';
import type { Tournament } from '@/types/tournament';
import { ChevronUp, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

// The imperial exam's top three titles crown the best predictors.
const RANK_SEALS = [
  { text: '状元', tone: 'cinnabar' },
  { text: '榜眼', tone: 'ink' },
  { text: '探花', tone: 'ochre' },
] as const;

/** Rank 1, 2, … with ties sharing a rank: same correct picks out of the same number of picks. */
function ranksOf(entries: readonly LeaderboardEntry[]): number[] {
  return entries.map((entry, index) => {
    const first = entries.findIndex((other) => other.correct === entry.correct && other.picks === entry.picks);
    return (first < 0 ? index : first) + 1;
  });
}

/**
 * Slides rows to their new place when the ranking changes and flashes a row
 * whose score went up. It measures after every render (the list is small and
 * the viewer re-renders about once a second), using the Web Animations API so
 * no row state lives in React.
 */
function useRankMotion() {
  const rows = useRef(new Map<string, HTMLElement>());
  const last = useRef(new Map<string, { top: number; correct: number }>());
  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const [username, row] of rows.current) {
      const top = row.offsetTop;
      const correct = Number(row.dataset.correct);
      const before = last.current.get(username);
      last.current.set(username, { top, correct });
      if (!before || reduced) continue;
      if (before.top !== top) {
        row.animate([{ transform: `translateY(${before.top - top}px)` }, { transform: 'translateY(0)' }], {
          duration: 600,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        });
      }
      if (correct > before.correct) {
        row.animate([{ backgroundColor: 'rgb(240 200 104 / 0.55)' }, { backgroundColor: 'rgb(240 200 104 / 0)' }], { duration: 1800, easing: 'ease-out' });
      }
    }
  });
  return (username: string) => (row: HTMLElement | null) => {
    if (row) rows.current.set(username, row);
    else rows.current.delete(username);
  };
}

function RankMark({ rank }: { rank: number }) {
  const { t } = useI18n();
  const seal = RANK_SEALS[rank - 1];
  if (seal) {
    return (
      <span title={t.predictions.rankTitles[rank - 1]} className='flex w-8 shrink-0 justify-center'>
        <Seal text={seal.text} size='md' tone={seal.tone} />
      </span>
    );
  }
  return (
    <span className='flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-sm font-bold text-muted' aria-label={`#${rank}`}>
      {rank}
    </span>
  );
}

interface PredictionsBoardProps {
  tournament: Tournament | undefined;
  /** Shown as a close button when the board opens as a sheet on small screens. */
  onClose?: () => void;
  className?: string;
}

/**
 * The prediction leaderboard as a hanging scroll: the crowd's record on both
 * questions, then every member ranked by correct picks. Always rendered (an
 * empty board before the first predicted series finishes), so viewers always
 * know where it lives.
 */
export function PredictionsBoard({ tournament, onClose, className = '' }: PredictionsBoardProps) {
  const { t } = useI18n();
  const rowRef = useRankMotion();
  const leaderboard = tournament ? predictionLeaderboard(tournament) : [];
  const ranks = ranksOf(leaderboard);
  const winnerRecord = tournament ? crowdRecord(tournament) : { called: 0, decided: 0 };
  const gamesRecord = tournament ? crowdGamesRecord(tournament) : { called: 0, decided: 0 };
  const showGames = leaderboard.some((entry) => entry.gamesPicks > 0);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const closable = onClose !== undefined;

  useEffect(() => {
    if (closable) closeRef.current?.focus();
  }, [closable]);

  return (
    <section aria-labelledby={titleId} className={`scroll-board flex min-h-0 flex-col ${className}`}>
      <div className='paper flex min-h-0 flex-1 flex-col overflow-hidden'>
        <header className='relative flex flex-col items-center gap-1 border-b border-dashed border-border px-5 pb-4 pt-6 text-center'>
          <Seal text='神算' size='md' className='mb-1' />
          <h2 id={titleId} className='font-serif text-xl font-extrabold tracking-wide text-fg'>
            {t.predictions.title}
          </h2>
          <p className='text-xs text-muted'>{t.predictions.subtitle}</p>
          {(winnerRecord.decided > 0 || gamesRecord.decided > 0) && (
            <div className='mt-2 flex flex-col gap-0.5 text-xs text-muted'>
              {winnerRecord.decided > 0 && <p>{t.predictions.winnerRecord(winnerRecord.called, winnerRecord.decided)}</p>}
              {gamesRecord.decided > 0 && <p>{t.predictions.gamesRecord(gamesRecord.called, gamesRecord.decided)}</p>}
            </div>
          )}
          {onClose && (
            <button
              ref={closeRef}
              type='button'
              onClick={onClose}
              aria-label={t.common.dismiss}
              className='absolute right-3 top-3 rounded-full p-1.5 text-muted transition hover:bg-surface-hover hover:text-fg'
            >
              <X size={18} />
            </button>
          )}
        </header>

        {leaderboard.length === 0 ? (
          <div className='flex flex-col items-center gap-2 px-6 py-8 text-center'>
            <p className='font-brush text-3xl text-fg/70'>{t.predictions.noRanking}</p>
            <p className='text-sm text-muted'>{t.predictions.empty}</p>
          </div>
        ) : (
          <ol className='relative min-h-0 flex-1 overflow-y-auto px-3 py-3'>
            {leaderboard.map((entry, index) => (
              <li
                key={entry.username}
                ref={rowRef(entry.username)}
                data-correct={entry.correct}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 ${ranks[index] === 1 ? 'bg-gold/10' : ''}`}
              >
                <RankMark rank={ranks[index]} />
                <div className='min-w-0 flex-1'>
                  <p className={`truncate ${ranks[index] <= 3 ? 'font-bold text-fg' : 'font-semibold text-fg'}`}>{entry.name}</p>
                  <p className='text-xs text-muted'>
                    {t.predictions.winner} {entry.winnerCorrect}/{entry.winnerPicks}
                    {showGames && entry.gamesPicks > 0 && (
                      <>
                        {' · '}
                        {t.predictions.overUnder} {entry.gamesCorrect}/{entry.gamesPicks}
                      </>
                    )}
                  </p>
                </div>
                <p className='shrink-0 text-right' aria-label={t.predictions.correctOf(entry.correct, entry.picks)}>
                  <span className='text-xl font-extrabold text-fg'>{entry.correct}</span>
                  <span className='text-sm text-muted'>/{entry.picks}</span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/**
 * Small screens have no room for a side column, so the leaderboard docks at
 * the bottom of the screen with the current leader, and opens as a sheet.
 */
export function PredictionsDock({ tournament }: { tournament: Tournament | undefined }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const leader = tournament ? predictionLeaderboard(tournament)[0] : undefined;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className='lg:hidden'>
      <button
        type='button'
        onClick={() => setOpen(true)}
        aria-haspopup='dialog'
        aria-label={t.predictions.open}
        className='paper fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 px-4 py-2.5 text-left'
      >
        <Seal text='神算' size='md' />
        <span className='min-w-0 flex-1'>
          <span className='block text-sm font-extrabold text-fg'>{t.predictions.title}</span>
          <span className='block truncate text-xs text-muted'>
            {leader ? t.predictions.leader(leader.name, leader.correct, leader.picks) : t.predictions.noRanking}
          </span>
        </span>
        <ChevronUp size={18} className='shrink-0 text-muted' />
      </button>
      {open && (
        <div role='dialog' aria-modal='true' aria-label={t.predictions.title} className='fixed inset-0 z-40 flex items-end'>
          <button type='button' aria-label={t.common.dismiss} onClick={() => setOpen(false)} className='absolute inset-0 animate-fade-in bg-[#1f1a16]/45' />
          <div className='relative flex w-full animate-sheet-up flex-col px-4 pb-4'>
            <PredictionsBoard tournament={tournament} onClose={() => setOpen(false)} className='max-h-[calc(85vh-1rem)]' />
          </div>
        </div>
      )}
    </div>
  );
}
