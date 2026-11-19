import { useI18n } from '@/hooks/useI18n';
import type { Placing } from '@/lib/series';
import type { PlayerId } from '@/types/tournament';
import { Medal, Trophy } from 'lucide-react';
import type { CSSProperties } from 'react';

interface ChampionBannerProps {
  /** The grand final's places: the champion first, then 2nd and 3rd (or two 2nds). */
  standings: Placing[];
  nameOf: (playerId: PlayerId) => string;
}

/**
 * The champion's scroll with the runner-up and 3rd place on plaques below it.
 * `champion-banner`, `champion-name`, `podium-plaque` and `podium-name` are
 * hooks for the viewer page's gilt, silver and bronze (index.css); `data-place`
 * picks the metal, so two runners-up level on points both get silver.
 */
export function ChampionBanner({ standings, nameOf }: ChampionBannerProps) {
  const { t } = useI18n();
  const [champion, ...rest] = standings;
  return (
    <div className='flex flex-col gap-3'>
      <div className='champion-banner flex items-center gap-3 rounded-lg border border-gold bg-surface px-5 py-4'>
        <Trophy size={28} className='shrink-0 text-gold' />
        <div>
          <p className='text-xs font-semibold uppercase tracking-wide text-muted'>{t.common.podium[0]}</p>
          <p className='champion-name text-xl font-bold text-gold'>{nameOf(champion.playerId)}</p>
        </div>
      </div>
      <div className='grid grid-cols-2 gap-3'>
        {rest.map(({ playerId, place }, index) => (
          <div
            key={playerId}
            data-place={place}
            // Stamped in one after the other, once the champion's scroll has landed.
            style={{ '--podium-delay': `${0.5 + index * 0.25}s` } as CSSProperties}
            className='podium-plaque flex items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3'
          >
            <Medal size={22} className='shrink-0 text-muted' />
            <div className='min-w-0'>
              <p className='text-xs font-semibold uppercase tracking-wide text-muted'>{t.common.podium[place - 1]}</p>
              <p className='podium-name truncate font-semibold text-fg'>{nameOf(playerId)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
