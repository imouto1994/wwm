import { Button } from '@/components/Button';
import { Section } from '@/components/Section';
import { DisplayNamesEditor } from '@/components/host/DisplayNamesEditor';
import { RearrangePanel } from '@/components/host/RearrangePanel';
import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import { SUPPORTED_COUNTS, isSupportedCount } from '@/lib/format';
import { isDiscordUsername, nameLookup, normalizeUsername } from '@/lib/names';
import { groupSeries } from '@/lib/qualification';
import { cleanName } from '@/lib/reducer';
import type { Tournament } from '@/types/tournament';
import { Play, Shuffle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SetupPanelProps {
  host: HostController;
  tournament: Tournament;
}

/** Before the event: name it, load the display names, enter the participants by Discord username, draw the groups live, then adjust them by hand if needed. */
export function SetupPanel({ host, tournament }: SetupPanelProps) {
  const { t } = useI18n();
  const nameOf = nameLookup(tournament);
  const [eventName, setEventName] = useState(tournament.name);
  const savedUsernames = tournament.players.join('\n');
  const [usernamesText, setUsernamesText] = useState(savedUsernames);
  // A reserve swap changes the saved list; a stale box would offer to save the old list over it and wipe the draw.
  useEffect(() => setUsernamesText(savedUsernames), [savedUsernames]);
  const usernames = usernamesText.split('\n').map(normalizeUsername).filter(Boolean);
  const unchanged = usernames.length === tournament.players.length && usernames.every((username, index) => username === tournament.players[index]);
  const named = new Set(Object.keys(tournament.displayNames));
  const invalid = usernames.filter((username) => !isDiscordUsername(username));
  const repeated = [...new Set(usernames.filter((username, index) => usernames.indexOf(username) !== index))];
  const unnamed = usernames.filter((username) => isDiscordUsername(username) && !named.has(username));
  const hasProblems = invalid.length > 0 || repeated.length > 0 || unnamed.length > 0;
  const groups = groupSeries(tournament);
  const playersReady = isSupportedCount(tournament.players.length);
  const counts = SUPPORTED_COUNTS.join(', ');

  function saveParticipants() {
    if (groups.length > 0 && !window.confirm(t.setup.confirmReplace)) return;
    host.dispatch({ type: 'setPlayers', usernames });
  }

  return (
    <div className='flex flex-col gap-6'>
      <Section title={t.setup.event}>
        <form
          className='flex flex-wrap gap-2'
          onSubmit={(event) => {
            event.preventDefault();
            host.dispatch({ type: 'setName', name: eventName });
          }}
        >
          <label htmlFor='event-name' className='sr-only'>
            {t.setup.eventName}
          </label>
          <input
            id='event-name'
            value={eventName}
            onChange={(event) => setEventName(event.target.value)}
            className='min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-fg'
          />
          <Button type='submit' disabled={cleanName(eventName) === tournament.name}>
            {t.setup.saveName}
          </Button>
        </form>
      </Section>

      <Section title={t.names.title} aside={t.names.count(named.size)}>
        <p className='text-sm text-muted'>{t.names.help}</p>
        <DisplayNamesEditor host={host} tournament={tournament} />
      </Section>

      <Section title={t.setup.participants} aside={t.setup.participantsAside(usernames.length, counts)}>
        <label htmlFor='participants' className='text-sm text-muted'>
          {t.setup.participantsHelp}
        </label>
        <textarea
          id='participants'
          rows={10}
          value={usernamesText}
          onChange={(event) => setUsernamesText(event.target.value)}
          className='rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-fg'
        />
        {usernames.some((username) => named.has(username)) && (
          <p className='text-sm text-muted'>
            {t.setup.preview(
              usernames
                .filter((username) => named.has(username))
                .map((username) => nameOf(username))
                .join(' · ')
            )}
          </p>
        )}
        {invalid.length > 0 && <p className='text-sm text-red'>{t.setup.notUsernames(invalid.join(', '))}</p>}
        {repeated.length > 0 && <p className='text-sm text-red'>{t.setup.repeatedUsernames(repeated.join(', '))}</p>}
        {unnamed.length > 0 && <p className='text-sm text-red'>{t.setup.unnamed(unnamed.join(', '))}</p>}
        <div className='flex flex-wrap items-center gap-3'>
          <Button variant='primary' onClick={saveParticipants} disabled={!isSupportedCount(usernames.length) || unchanged || hasProblems}>
            {t.setup.saveParticipants}
          </Button>
          {!isSupportedCount(usernames.length) && usernames.length > 0 && (
            <span className='text-sm text-red'>{t.setup.wrongCount(usernames.length, counts)}</span>
          )}
          {unchanged && playersReady && <span className='text-sm text-green'>{t.setup.saved}</span>}
        </div>
      </Section>

      {playersReady && (
        <Section title={t.setup.groupDraw} aside={groups.length > 0 ? t.setup.drawVisible : undefined}>
          <div className='flex flex-wrap gap-2'>
            <Button onClick={() => host.dispatch({ type: 'drawGroups' })}>
              <Shuffle size={16} /> {groups.length > 0 ? t.setup.redraw : t.setup.draw}
            </Button>
            <Button variant='primary' onClick={() => host.dispatch({ type: 'startGroupStage' })} disabled={groups.length === 0}>
              <Play size={16} /> {t.setup.startGroups}
            </Button>
          </div>
          {groups.length > 0 && <RearrangePanel host={host} tournament={tournament} series={groups} />}
        </Section>
      )}
    </div>
  );
}
