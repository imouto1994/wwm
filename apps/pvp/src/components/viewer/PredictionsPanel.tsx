import { Section } from '@/components/Section';
import { crowdRecord, predictionLeaderboard } from '@/lib/polls';
import type { Tournament } from '@/types/tournament';

interface PredictionsPanelProps {
  tournament: Tournament;
}

const LEADERBOARD_SIZE = 10;

/** Discord prediction results: how often the crowd was right, and the best individual predictors. */
export function PredictionsPanel({ tournament }: PredictionsPanelProps) {
  if (!tournament.series.some((series) => series.poll)) return null;
  const record = crowdRecord(tournament);
  const leaderboard = predictionLeaderboard(tournament).slice(0, LEADERBOARD_SIZE);

  return (
    <Section title='Discord predictions'>
      <div className='flex flex-col gap-3 rounded-lg border border-border bg-surface p-4'>
        <p className='text-sm text-muted'>
          {record.decided > 0 ? (
            <>
              The crowd favourite won <span className='font-semibold text-fg'>{record.called}</span> of {record.decided} finished series.
            </>
          ) : (
            'Vote shares appear on each series card. Results show here once polled series finish.'
          )}
        </p>
        {leaderboard.length > 0 && (
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-xs uppercase tracking-wide text-muted'>
                <th className='py-1 font-semibold'>#</th>
                <th className='py-1 font-semibold'>Member</th>
                <th className='py-1 text-right font-semibold'>Correct</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr key={entry.discordId} className='border-t border-border'>
                  <td className='py-1.5 text-muted'>{index + 1}</td>
                  <td className='py-1.5 text-fg'>{entry.username || entry.discordId}</td>
                  <td className='py-1.5 text-right text-fg'>
                    {entry.correct} <span className='text-muted'>/ {entry.picks}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}
