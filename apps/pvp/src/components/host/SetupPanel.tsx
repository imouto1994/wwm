import { Button } from '@/components/Button';
import { Section } from '@/components/Section';
import { RearrangePanel } from '@/components/host/RearrangePanel';
import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import { SUPPORTED_COUNTS, isSupportedCount } from '@/lib/format';
import { groupSeries } from '@/lib/qualification';
import { cleanName } from '@/lib/reducer';
import type { Tournament } from '@/types/tournament';
import { Play, Shuffle } from 'lucide-react';
import { useState } from 'react';

interface SetupPanelProps {
  host: HostController;
  tournament: Tournament;
}

/** Before the event: name it, paste the participants, draw the groups live, then adjust them by hand if needed. */
export function SetupPanel({ host, tournament }: SetupPanelProps) {
  const { t } = useI18n();
  const [eventName, setEventName] = useState(tournament.name);
  const [namesText, setNamesText] = useState(tournament.players.map((player) => player.name).join('\n'));
  const names = namesText.split('\n').map(cleanName).filter(Boolean);
  const savedNames = tournament.players.map((player) => player.name);
  const unchanged = names.length === savedNames.length && names.every((name, index) => name === savedNames[index]);
  const groups = groupSeries(tournament);
  const playersReady = isSupportedCount(tournament.players.length);
  const counts = SUPPORTED_COUNTS.join(', ');

  function saveParticipants() {
    if (groups.length > 0 && !window.confirm(t.setup.confirmReplace)) return;
    host.dispatch({ type: 'setPlayers', playerNames: names });
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

      <Section title={t.setup.participants} aside={t.setup.namesAside(names.length, counts)}>
        <label htmlFor='participants' className='text-sm text-muted'>
          {t.setup.namesHelp}
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
            {t.setup.saveParticipants}
          </Button>
          {!isSupportedCount(names.length) && names.length > 0 && <span className='text-sm text-red'>{t.setup.wrongCount(names.length, counts)}</span>}
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
