import { useI18n } from '@/hooks/useI18n';
import type { Placing } from '@/lib/series';
import type { PlayerId } from '@/types/tournament';
import { Trophy } from 'lucide-react';

interface ChampionBannerProps {
  /** The grand final's places: the champion first, then 2nd and 3rd (or two 2nds). */
  standings: Placing[];
  nameOf: (playerId: PlayerId) => string;
}

/** `champion-banner`, `champion-name` and `champion-podium` are hooks for the viewer page's gilded scroll (index.css). */
export function ChampionBanner({ standings, nameOf }: ChampionBannerProps) {
  const { t } = useI18n();
  const [champion, ...rest] = standings;
  return (
    <div className='champion-banner flex items-center gap-3 rounded-lg border border-gold bg-surface px-5 py-4'>
      <Trophy size={28} className='shrink-0 text-gold' />
      <div>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted'>{t.common.podium[0]}</p>
        <p className='champion-name text-xl font-bold text-gold'>{nameOf(champion.playerId)}</p>
        <p className='champion-podium mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm'>
          {rest.map(({ playerId, place }) => (
            <span key={playerId}>
              <span className='text-muted'>{t.common.podium[place - 1]}:</span> <span className='font-semibold text-fg'>{nameOf(playerId)}</span>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
