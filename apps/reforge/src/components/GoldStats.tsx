import { LUCK_BG } from '@/components/MilestoneTable';
import { goldPityColor, goldPityDistribution } from '@/lib/engine';
import type { Milestone } from '@/types/reforge';
/**
 * Gold-luck stats rail: how many golds the session has landed in each pity
 * range. The bucketing lives in the pure `goldPityDistribution` engine helper;
 * this component only renders it. Bars are tinted with the same LUCK_BG luck
 * colors as the table/legend, and the count is always shown so color is never
 * the only signal. The full set of pity ranges (1..HARD_PITY) is always shown -
 * including empty ones - so the scale stays stable as a session progresses.
 */
import { useMemo } from 'react';

interface Props {
  milestones: Milestone[];
}

export function GoldStats({ milestones }: Props) {
  const { buckets, total, maxCount } = useMemo(() => {
    const { buckets, total } = goldPityDistribution(milestones);
    const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0);
    return { buckets, total, maxCount };
  }, [milestones]);

  return (
    <section className='flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-xs'>
      <h2 className='font-semibold text-gold'>Gold stats</h2>
      {total === 0 ? (
        <p className='text-muted'>No golds recorded yet.</p>
      ) : (
        <>
          <div className='text-[10px] uppercase tracking-wide text-muted'>
            {total} gold{total === 1 ? '' : 's'} so far
          </div>
          <div className='flex flex-col gap-1.5'>
            {buckets.map((b) => {
              const pct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
              return (
                <div key={b.min} className='flex items-center gap-2'>
                  <span className='w-12 shrink-0 tabular-nums text-muted'>
                    {b.min}&ndash;{b.max}
                  </span>
                  <div className='h-4 flex-1 overflow-hidden rounded bg-bg/40'>
                    <div className={`h-full rounded ${LUCK_BG[goldPityColor(b.min)]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className='w-5 shrink-0 text-right tabular-nums'>{b.count}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
