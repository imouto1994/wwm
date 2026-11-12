import { Button } from '@/components/Button';
import { UnauthorizedError, fetchTournament } from '@/lib/apiClient';
import { Lock } from 'lucide-react';
import { type FormEvent, useState } from 'react';

interface PinGateProps {
  onUnlock: (pin: string) => void;
  initialError?: string;
}

/** Asks for the host PIN and checks it against the server before unlocking the console. */
export function PinGate({ onUnlock, initialError }: PinGateProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(initialError ?? '');
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!pin) return;
    setChecking(true);
    setError('');
    try {
      await fetchTournament({ pin });
      onUnlock(pin);
    } catch (caught) {
      setError(caught instanceof UnauthorizedError ? 'That PIN is not right.' : caught instanceof Error ? caught.message : 'Could not check the PIN.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className='mx-auto mt-16 flex max-w-sm flex-col gap-3 rounded-lg border border-border bg-surface p-6'>
      <h1 className='flex items-center gap-2 text-lg font-bold text-gold'>
        <Lock size={18} /> Host console
      </h1>
      <p className='text-sm text-muted'>Enter the host PIN. It stays in this tab only and is forgotten when you close it.</p>
      <label htmlFor='host-pin' className='sr-only'>
        Host PIN
      </label>
      <input
        id='host-pin'
        type='password'
        autoComplete='current-password'
        value={pin}
        onChange={(event) => setPin(event.target.value)}
        className='rounded-lg border border-border bg-bg px-3 py-2 text-fg'
      />
      {error && <p className='text-sm text-red'>{error}</p>}
      <Button type='submit' variant='primary' disabled={!pin || checking}>
        {checking ? 'Checking…' : 'Unlock'}
      </Button>
    </form>
  );
}
