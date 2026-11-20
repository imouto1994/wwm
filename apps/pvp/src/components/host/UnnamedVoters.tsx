import { Button } from '@/components/Button';
import { CopyButton } from '@/components/CopyButton';
import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import { unnamedVoters } from '@/lib/polls';
import type { Tournament } from '@/types/tournament';
import { UserPlus } from 'lucide-react';

interface UnnamedVotersProps {
  host: HostController;
  tournament: Tournament;
}

/**
 * Voters missing from the display names, who show up on the leaderboard as
 * bare usernames. The host can copy the list to ask who they are, or add them
 * all with their username as a stand-in name and rename them later.
 */
export function UnnamedVoters({ host, tournament }: UnnamedVotersProps) {
  const { t } = useI18n();
  const voters = unnamedVoters(tournament);
  if (voters.length === 0) return <p className='text-sm text-green'>{t.unnamed.none}</p>;

  return (
    <div className='flex w-full flex-col gap-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <p className='text-sm text-fg'>{t.unnamed.summary(voters.length)}</p>
        <CopyButton text={voters.map(({ username }) => `- @${username}`).join('\n')} />
      </div>
      <ul className='flex max-h-72 list-disc flex-col gap-0.5 overflow-y-auto pl-5 text-sm'>
        {voters.map(({ username, polls }) => (
          <li key={username}>
            <span className='text-fg'>@{username}</span> <span className='text-xs text-muted'>· {t.unnamed.votedIn(polls)}</span>
          </li>
        ))}
      </ul>
      <div>
        <Button
          onClick={() =>
            host.dispatch({
              type: 'setDisplayNames',
              displayNames: { ...tournament.displayNames, ...Object.fromEntries(voters.map(({ username }) => [username, username])) },
            })
          }
        >
          <UserPlus size={14} /> {t.unnamed.addAll(voters.length)}
        </Button>
      </div>
    </div>
  );
}
