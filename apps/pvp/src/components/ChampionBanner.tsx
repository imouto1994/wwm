import { useI18n } from '@/hooks/useI18n';
import { Trophy } from 'lucide-react';

/** `champion-banner` and `champion-name` are hooks for the viewer page's gilded scroll (index.css). */
export function ChampionBanner({ name }: { name: string }) {
  const { t } = useI18n();
  return (
    <div className='champion-banner flex items-center gap-3 rounded-lg border border-gold bg-surface px-5 py-4'>
      <Trophy size={28} className='shrink-0 text-gold' />
      <div>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted'>{t.common.champion}</p>
        <p className='champion-name text-xl font-bold text-gold'>{name}</p>
      </div>
    </div>
  );
}
