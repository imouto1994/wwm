import { LUCK_BG } from '@/components/MilestoneTable';
import { GOLD_LUCK, SOON_PITY } from '@/lib/constants';
/**
 * Legend rail: a static key for the milestone table's visual cues. It replaces
 * the old caption under the table and reuses the same constants/classes as the
 * table cells (GOLD_LUCK thresholds, SOON_PITY, LUCK_BG) so the wording, numbers
 * and colors can never drift from what the table actually renders.
 */
import { Lock, Sparkles, Star } from 'lucide-react';

function LuckRow({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className='flex items-center gap-2'>
      <span className={`inline-flex w-9 items-center justify-center rounded py-0.5 font-semibold ${swatch}`}>
        <Star size={12} fill='currentColor' aria-hidden />
      </span>
      <span className='text-muted'>{label}</span>
    </div>
  );
}

export function Legend() {
  return (
    <section className='flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 text-xs'>
      <h2 className='font-semibold text-gold'>Legend</h2>

      <div className='flex flex-col gap-2'>
        <div className='text-[10px] uppercase tracking-wide text-muted'>Rolls it took to gold</div>
        <LuckRow swatch={LUCK_BG.green} label={`Lucky (< ${GOLD_LUCK.green})`} />
        <LuckRow swatch={LUCK_BG.yellow} label={`Average (${GOLD_LUCK.green}\u2013${GOLD_LUCK.yellow - 1})`} />
        <LuckRow swatch={LUCK_BG.red} label={`Unlucky (\u2265 ${GOLD_LUCK.yellow})`} />
      </div>

      <div className='flex items-center gap-2'>
        <span className='animate-soon inline-block h-5 w-9 rounded bg-bg/40' aria-hidden />
        <span className='text-muted'>About to pop (pity &ge; {SOON_PITY})</span>
      </div>

      <div className='flex flex-col gap-1.5 text-muted'>
        <div className='flex items-center gap-2'>
          <span className='text-tier-gold'>
            <Star size={12} fill='currentColor' aria-hidden />
          </span>
          Turned / held gold
        </div>
        <div className='flex items-center gap-2'>
          <Lock size={12} /> Locked (pity frozen)
        </div>
        <div className='flex items-center gap-2'>
          <Sparkles size={12} className='text-tier-gold' /> Misc: auto-gold once unlocked
        </div>
      </div>
    </section>
  );
}
