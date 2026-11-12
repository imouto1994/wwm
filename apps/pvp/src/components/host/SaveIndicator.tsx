import type { SaveStatus } from '@/hooks/useHostTournament';

interface SaveIndicatorProps {
  status: SaveStatus;
  onRetry: () => void;
}

export function SaveIndicator({ status, onRetry }: SaveIndicatorProps) {
  if (status === 'saving') return <span className='text-xs text-gold'>Saving…</span>;
  if (status === 'unsaved') {
    return (
      <span className='flex items-center gap-2 text-xs text-red'>
        Not saved
        <button type='button' onClick={onRetry} className='rounded border border-red/50 px-2 py-0.5 hover:bg-red/10'>
          Retry
        </button>
      </span>
    );
  }
  return <span className='text-xs text-muted'>{status === 'saved' ? 'All changes saved' : 'Up to date'}</span>;
}
