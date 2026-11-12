import { Button } from '@/components/Button';
import { Section } from '@/components/Section';
import { SeriesCard } from '@/components/SeriesCard';
import type { HostController } from '@/hooks/useHostTournament';
import { SUPPORTED_COUNTS, isSupportedCount } from '@/lib/format';
import { nameLookup } from '@/lib/names';
import { groupSeries } from '@/lib/qualification';
import { cleanName } from '@/lib/reducer';
import type { Tournament } from '@/types/tournament';
import { Play, Shuffle } from 'lucide-react';
import { useState } from 'react';

interface SetupPanelProps {
  host: HostController;
  tournament: Tournament;
}

/** Before the event: name it, paste the participants, then draw the groups live. */
export function SetupPanel({ host, tournament }: SetupPanelProps) {
  const [eventName, setEventName] = useState(tournament.name);
  const [namesText, setNamesText] = useState(tournament.players.map((player) => player.name).join('\n'));
  const names = namesText.split('\n').map(cleanName).filter(Boolean);
  const savedNames = tournament.players.map((player) => player.name);
  const unchanged = names.length === savedNames.length && names.every((name, index) => name === savedNames[index]);
  const groups = groupSeries(tournament);
  const nameOf = nameLookup(tournament);
  const playersReady = isSupportedCount(tournament.players.length);

  function saveParticipants() {
    if (groups.length > 0 && !window.confirm('Saving a new participant list clears the current group draw. Continue?')) return;
    host.dispatch({ type: 'setPlayers', playerNames: names });
  }

  return (
    <div className='flex flex-col gap-6'>
      <Section title='Event'>
        <form
          className='flex flex-wrap gap-2'
          onSubmit={(event) => {
            event.preventDefault();
            host.dispatch({ type: 'setName', name: eventName });
          }}
        >
          <label htmlFor='event-name' className='sr-only'>
            Event name
          </label>
          <input
            id='event-name'
            value={eventName}
            onChange={(event) => setEventName(event.target.value)}
            className='min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-fg'
          />
          <Button type='submit' disabled={cleanName(eventName) === tournament.name}>
            Save name
          </Button>
        </form>
      </Section>

      <Section title='Participants' aside={`${names.length} names · needs ${SUPPORTED_COUNTS.join(', ')}`}>
        <label htmlFor='participants' className='text-sm text-muted'>
          One in-game name per line. Duplicates are rejected.
        </label>
        <textarea
          id='participants'
          rows={10}
          value={namesText}
          onChange={(event) => setNamesText(event.target.value)}
          className='rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-fg'
        />
        <div className='flex flex-wrap items-center gap-3'>
          <Button variant='primary' onClick={saveParticipants} disabled={!isSupportedCount(names.length) || unchanged}>
            Save participants
          </Button>
          {!isSupportedCount(names.length) && names.length > 0 && (
            <span className='text-sm text-red'>{names.length} names; the format needs 21, 24, 27 or 30.</span>
          )}
          {unchanged && playersReady && <span className='text-sm text-green'>Saved</span>}
        </div>
      </Section>

      {playersReady && (
        <Section title='Group draw' aside={groups.length > 0 ? 'Viewers can see this draw' : undefined}>
          <div className='flex flex-wrap gap-2'>
            <Button onClick={() => host.dispatch({ type: 'drawGroups' })}>
              <Shuffle size={16} /> {groups.length > 0 ? 'Redraw groups' : 'Draw groups'}
            </Button>
            <Button variant='primary' onClick={() => host.dispatch({ type: 'startGroupStage' })} disabled={groups.length === 0}>
              <Play size={16} /> Start group stage
            </Button>
          </div>
          {groups.length > 0 && (
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {groups.map((series) => (
                <SeriesCard key={series.id} series={series} nameOf={nameOf} />
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
