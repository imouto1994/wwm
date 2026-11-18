import type { SaveStatus } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';

interface SaveIndicatorProps {
  status: SaveStatus;
  onRetry: () => void;
}

export function SaveIndicator({ status, onRetry }: SaveIndicatorProps) {
  const { t } = useI18n();
  if (status === 'saving') return <span className='text-xs text-gold'>{t.save.saving}</span>;
  if (status === 'unsaved') {
    return (
      <span className='flex items-center gap-2 text-xs text-red'>
        {t.save.notSaved}
        <button type='button' onClick={onRetry} className='rounded border border-red/50 px-2 py-0.5 hover:bg-red/10'>
          {t.save.retry}
        </button>
      </span>
    );
  }
  return <span className='text-xs text-muted'>{status === 'saved' ? t.save.saved : t.save.upToDate}</span>;
}
