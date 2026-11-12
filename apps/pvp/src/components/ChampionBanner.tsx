import { Trophy } from 'lucide-react';

export function ChampionBanner({ name }: { name: string }) {
  return (
    <div className='flex items-center gap-3 rounded-lg border border-gold bg-surface px-5 py-4'>
      <Trophy size={28} className='shrink-0 text-gold' />
      <div>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted'>Champion</p>
        <p className='text-xl font-bold text-gold'>{name}</p>
      </div>
    </div>
  );
}
