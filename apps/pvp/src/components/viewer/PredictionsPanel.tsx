import { Section } from '@/components/Section';
import { useI18n } from '@/hooks/useI18n';
import { crowdGamesRecord, crowdRecord, predictionLeaderboard } from '@/lib/polls';
import type { Tournament } from '@/types/tournament';

interface PredictionsPanelProps {
  tournament: Tournament;
}

const LEADERBOARD_SIZE = 10;

/** Discord prediction results: how often the crowd was right on both questions, and the best individual predictors. */
export function PredictionsPanel({ tournament }: PredictionsPanelProps) {
  const { t } = useI18n();
  if (!tournament.series.some((series) => series.poll || series.gamesPoll)) return null;
  const winnerRecord = crowdRecord(tournament);
  const gamesRecord = crowdGamesRecord(tournament);
  const leaderboard = predictionLeaderboard(tournament).slice(0, LEADERBOARD_SIZE);
  const showGames = leaderboard.some((entry) => entry.gamesPicks > 0);

  return (
    <Section title={t.predictions.title}>
      <div className='flex flex-col gap-3 rounded-lg border border-border bg-surface p-4'>
        {leaderboard.length === 0 && winnerRecord.decided === 0 && gamesRecord.decided === 0 ? (
          <p className='text-sm text-muted'>{t.predictions.empty}</p>
        ) : (
          <div className='flex flex-col gap-1 text-sm text-muted'>
            {winnerRecord.decided > 0 && <p>{t.predictions.winnerRecord(winnerRecord.called, winnerRecord.decided)}</p>}
            {gamesRecord.decided > 0 && <p>{t.predictions.gamesRecord(gamesRecord.called, gamesRecord.decided)}</p>}
          </div>
        )}
        {leaderboard.length > 0 && (
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-xs uppercase tracking-wide text-muted'>
                <th className='py-1 font-semibold'>#</th>
                <th className='py-1 font-semibold'>{t.predictions.member}</th>
                <th className='py-1 text-right font-semibold'>{t.predictions.winner}</th>
                {showGames && <th className='py-1 text-right font-semibold'>{t.predictions.overUnder}</th>}
                {showGames && <th className='py-1 text-right font-semibold'>{t.predictions.total}</th>}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr key={entry.username} className='border-t border-border'>
                  <td className='py-1.5 text-muted'>{index + 1}</td>
                  <td className='py-1.5 text-fg'>{entry.name}</td>
                  <td className='py-1.5 text-right text-fg'>
                    {entry.winnerCorrect} <span className='text-muted'>/ {entry.winnerPicks}</span>
                  </td>
                  {showGames && (
                    <td className='py-1.5 text-right text-fg'>
                      {entry.gamesCorrect} <span className='text-muted'>/ {entry.gamesPicks}</span>
                    </td>
                  )}
                  {showGames && (
                    <td className='py-1.5 text-right font-semibold text-fg'>
                      {entry.correct} <span className='font-normal text-muted'>/ {entry.picks}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}
