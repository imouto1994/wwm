import type { ReactNode } from 'react';

interface BannerProps {
  tone: 'error' | 'info' | 'success';
  children: ReactNode;
  onDismiss?: () => void;
}

const TONES = {
  error: 'border-red/50 text-red',
  info: 'border-gold/40 text-fg',
  success: 'border-green/50 text-green',
};

export function Banner({ tone, children, onDismiss }: BannerProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-3 rounded-lg border bg-surface px-4 py-3 text-sm ${TONES[tone]}`}
    >
      <div>{children}</div>
      {onDismiss && (
        <button type='button' onClick={onDismiss} className='text-xs text-muted hover:text-fg'>
          Dismiss
        </button>
      )}
    </div>
  );
}
