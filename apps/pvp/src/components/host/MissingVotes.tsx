import { CopyButton } from '@/components/CopyButton';
import { useI18n } from '@/hooks/useI18n';
import { type MissingVoter, type RecordedPoll, missingVoters } from '@/lib/polls';
import type { Tournament } from '@/types/tournament';

/**
 * Who skipped some of the recorded polls, and which ones, so the host can
 * nudge them on Discord. Each member's missed polls are a bullet list, and
 * copy as one ("- " lines render as a list in Discord), either one member at
 * a time or everyone at once under a reminder heading.
 */
export function MissingVotes({ tournament }: { tournament: Tournament }) {
  const { t } = useI18n();
  const { polls, voters } = missingVoters(tournament);
  const pollName = ({ series, kind }: RecordedPoll) =>
    t.missing.pollLabel(t.seriesName(series), kind === 'games' ? t.poll.gamesTitle : series.stage === 'survival' ? t.poll.outTitle : t.poll.winnerTitle);
  const block = ({ username, name, missed }: MissingVoter) =>
    [name === username ? `@${username}` : `@${username} (${name})`, ...missed.map((poll) => `- ${pollName(poll)}`)].join('\n');

  if (voters.length === 0) return <p className='text-sm text-green'>{t.missing.allVoted(polls.length)}</p>;

  const reminder = [t.missing.reminderHeader, ...voters.map(block)].join('\n\n');

  return (
    <div className='flex w-full flex-col gap-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <p className='text-sm text-fg'>{t.missing.summary(voters.length, polls.length)}</p>
        <CopyButton text={reminder} />
      </div>
      <ul className='flex max-h-96 flex-col gap-2 overflow-y-auto'>
        {voters.map((voter) => (
          <li key={voter.username} className='rounded-md border border-border px-3 py-2 text-sm'>
            <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
              <span className='font-semibold text-fg'>{voter.name}</span>
              {voter.name !== voter.username && <span className='text-xs text-muted'>@{voter.username}</span>}
              <span className='ml-auto text-xs text-red'>{t.missing.missedCount(voter.missed.length, polls.length)}</span>
              <CopyButton text={block(voter)} />
            </div>
            <ul className='mt-1.5 list-disc pl-5 text-muted'>
              {voter.missed.map((poll) => (
                <li key={`${poll.series.id}-${poll.kind}`}>{pollName(poll)}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
