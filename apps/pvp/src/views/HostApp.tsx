import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChampionBanner } from '@/components/ChampionBanner';
import { SeriesCard } from '@/components/SeriesCard';
import { HostTools } from '@/components/host/HostTools';
import { PinGate } from '@/components/host/PinGate';
import { RunPanel } from '@/components/host/RunPanel';
import { SaveIndicator } from '@/components/host/SaveIndicator';
import { SetupPanel } from '@/components/host/SetupPanel';
import { useHostPin } from '@/hooks/useHostPin';
import { useHostTournament } from '@/hooks/useHostTournament';
import { STAGE_LABELS, nameLookup } from '@/lib/names';
import { championOf } from '@/lib/reducer';
import { ExternalLink, Swords } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HostConsoleProps {
  pin: string;
  onLocked: (message: string) => void;
  onSignOut: () => void;
}

function HostConsole({ pin, onLocked, onSignOut }: HostConsoleProps) {
  const host = useHostTournament(pin);
  const { tournament, loadStatus } = host;

  // A PIN that stops working (changed on Vercel, or mistyped earlier) sends the host back to the gate.
  useEffect(() => {
    if (loadStatus === 'unauthorized') onLocked('That PIN is not right, or it was changed.');
  }, [loadStatus, onLocked]);

  if (loadStatus === 'loading' || loadStatus === 'unauthorized') return <p className='text-muted'>Loading the tournament…</p>;
  if (loadStatus === 'error' || !tournament) {
    return (
      <div className='flex flex-col items-start gap-3'>
        <Banner tone='error'>{host.message?.text ?? 'Could not load the tournament.'}</Banner>
        <Button onClick={host.reload}>Try again</Button>
      </div>
    );
  }

  const champion = championOf(tournament);
  const nameOf = nameLookup(tournament);
  const final = tournament.series.find((series) => series.stage === 'final');

  return (
    <>
      <header className='flex flex-col gap-2'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h1 className='flex items-center gap-2 text-2xl font-bold text-gold'>
            <Swords size={24} /> {tournament.name}
          </h1>
          <div className='flex flex-wrap items-center gap-3'>
            <SaveIndicator status={host.saveStatus} onRetry={host.retry} />
            <a href='/' target='_blank' rel='noreferrer' className='flex items-center gap-1 text-sm text-muted hover:text-fg'>
              Viewer page <ExternalLink size={14} />
            </a>
            <button type='button' onClick={onSignOut} className='text-sm text-muted hover:text-fg'>
              Lock
            </button>
          </div>
        </div>
        <p className='text-sm text-muted'>
          Host console · <span className='text-fg'>{STAGE_LABELS[tournament.stage]}</span> · {tournament.players.length || 'no'} players
        </p>
      </header>

      {host.message && (
        <Banner tone={host.message.tone} onDismiss={host.dismissMessage}>
          {host.message.text}
        </Banner>
      )}

      {tournament.stage === 'setup' && <SetupPanel host={host} tournament={tournament} />}
      {tournament.stage === 'done' && (
        <div className='flex flex-col gap-4'>
          {champion && <ChampionBanner name={nameOf(champion)} />}
          {final && <SeriesCard series={final} nameOf={nameOf} />}
          <p className='text-sm text-muted'>The tournament is finished. Use host tools to go back a stage if a result needs fixing.</p>
        </div>
      )}
      {tournament.stage !== 'setup' && tournament.stage !== 'done' && <RunPanel host={host} tournament={tournament} />}

      <HostTools host={host} tournament={tournament} pin={pin} />
    </>
  );
}

/** `/host`: PIN gate, then the console. */
export function HostApp() {
  const { pin, setPin, clearPin } = useHostPin();
  const [gateError, setGateError] = useState<string>();

  return (
    <div className='mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8'>
      {pin ? (
        <HostConsole
          pin={pin}
          onLocked={(message) => {
            setGateError(message);
            clearPin();
          }}
          onSignOut={clearPin}
        />
      ) : (
        <PinGate
          initialError={gateError}
          onUnlock={(next) => {
            setGateError(undefined);
            setPin(next);
          }}
        />
      )}
    </div>
  );
}
