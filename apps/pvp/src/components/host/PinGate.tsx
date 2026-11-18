import { Button } from '@/components/Button';
import { useI18n } from '@/hooks/useI18n';
import { UnauthorizedError, describeApiError, fetchTournament } from '@/lib/apiClient';
import type { Translatable } from '@/lib/i18n';
import { Lock } from 'lucide-react';
import { type FormEvent, useState } from 'react';

interface PinGateProps {
  onUnlock: (pin: string) => void;
  initialError?: Translatable;
}

/** Asks for the host PIN and checks it against the server before unlocking the console. */
export function PinGate({ onUnlock, initialError }: PinGateProps) {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<Translatable | undefined>(() => initialError);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!pin) return;
    setChecking(true);
    setError(undefined);
    try {
      await fetchTournament({ pin });
      onUnlock(pin);
    } catch (caught) {
      const message: Translatable = caught instanceof UnauthorizedError ? (messages) => messages.pin.wrong : describeApiError(caught);
      // Wrapped because React would call a bare function as a state updater.
      setError(() => message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className='mx-auto mt-16 flex w-full max-w-sm flex-col gap-3 rounded-lg border border-border bg-surface p-6'>
      <h1 className='flex items-center gap-2 text-lg font-bold text-gold'>
        <Lock size={18} /> {t.pin.title}
      </h1>
      <p className='text-sm text-muted'>{t.pin.intro}</p>
      <label htmlFor='host-pin' className='sr-only'>
        {t.pin.label}
      </label>
      <input
        id='host-pin'
        type='password'
        autoComplete='current-password'
        value={pin}
        onChange={(event) => setPin(event.target.value)}
        className='rounded-lg border border-border bg-bg px-3 py-2 text-fg'
      />
      {error && <p className='text-sm text-red'>{error(t)}</p>}
      <Button type='submit' variant='primary' disabled={!pin || checking}>
        {checking ? t.pin.checking : t.pin.unlock}
      </Button>
    </form>
  );
}
