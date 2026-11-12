import { Section } from '@/components/Section';
import { formatFor, isSupportedCount } from '@/lib/format';
import { groupStageOutcome } from '@/lib/qualification';
import type { PlayerRecord } from '@/lib/series';
import type { PlayerId, Tournament } from '@/types/tournament';

interface QualificationPanelProps {
  tournament: Tournament;
  nameOf: (playerId: PlayerId) => string;
}

function describeRecord(record: PlayerRecord | undefined): string {
  if (!record || record.games === 0) return '';
  return `${record.wins} ${record.wins === 1 ? 'win' : 'wins'} · ${(record.points / record.games).toFixed(2)} pts/game`;
}

/** Who is through to the semifinals so far, shown during the group stage and play-in. */
export function QualificationPanel({ tournament, nameOf }: QualificationPanelProps) {
  if ((tournament.stage !== 'groups' && tournament.stage !== 'playIn') || !isSupportedCount(tournament.players.length)) return null;
  const format = formatFor(tournament.players.length);
  const outcome = groupStageOutcome(tournament);
  const rule = format.hasPlayIn
    ? '8 group winners go straight through. The 2 weakest winners and the best runner-up play one match for the last spot.'
    : format.runnerUpSpots > 0
      ? `The ${format.groups} group winners and the ${format.runnerUpSpots === 1 ? 'best runner-up' : `${format.runnerUpSpots} best runners-up`} go through.`
      : 'The 9 group winners go through.';
  const raceSpots = format.hasPlayIn ? 1 : format.runnerUpSpots;

  return (
    <Section title='Road to the semifinals' aside={`${outcome.winners.length} of ${format.groups} groups decided`}>
      <div className='flex flex-col gap-4 rounded-lg border border-border bg-surface p-4'>
        <p className='text-sm text-muted'>{rule} Ties are broken by points per game (1st = 3, 2nd = 1, 3rd = 0), then a random draw.</p>

        {outcome.winners.length > 0 && (
          <div className='flex flex-col gap-2'>
            <h3 className='text-xs font-semibold uppercase tracking-wide text-muted'>Group winners</h3>
            <div className='flex flex-wrap gap-1.5'>
              {outcome.winners.map((playerId) => (
                <span
                  key={playerId}
                  className={`rounded-md border px-2 py-1 text-sm ${
                    outcome.playIn.includes(playerId) ? 'border-gold/40 text-gold' : 'border-green/40 text-green'
                  }`}
                >
                  {nameOf(playerId)}
                </span>
              ))}
            </div>
          </div>
        )}

        {outcome.complete && format.hasPlayIn && outcome.playIn.length === 3 && (
          <p className='text-sm'>
            Play-in: <span className='font-semibold text-fg'>{outcome.playIn.map(nameOf).join(', ')}</span>
          </p>
        )}

        {raceSpots > 0 && outcome.rankedRunnersUp.length > 0 && (
          <div className='flex flex-col gap-2'>
            <h3 className='text-xs font-semibold uppercase tracking-wide text-muted'>
              {format.hasPlayIn ? 'Best runner-up (play-in spot)' : 'Runners-up race'}
            </h3>
            <ol className='flex flex-col gap-1 text-sm'>
              {outcome.rankedRunnersUp.map((playerId, index) => (
                <li key={playerId} className={`flex justify-between gap-2 ${index < raceSpots ? 'text-fg' : 'text-muted'}`}>
                  <span>
                    {index + 1}. {nameOf(playerId)}
                    {index < raceSpots && <span className='ml-2 text-xs text-green'>in</span>}
                  </span>
                  <span className='text-xs'>{describeRecord(outcome.records.get(playerId))}</span>
                </li>
              ))}
            </ol>
            {!outcome.complete && <p className='text-xs text-muted'>Provisional until every group is finished.</p>}
          </div>
        )}
      </div>
    </Section>
  );
}
