import { ImageWithFallback } from '@/components/ImageWithFallback';

interface EntryCardProps {
  name: string;
  image: string;
  badge?: string;
}

// A single weapon or skill: a square image frame (fixed aspect ratio, so the
// grid never jumps around while art of varying sizes gets swapped in) plus
// its name, and an optional small badge (e.g. "DPS" on the 1st weapon slot).
export function EntryCard({ name, image, badge }: EntryCardProps) {
  return (
    <div className='flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-2 text-center'>
      <div className='relative aspect-square w-full overflow-hidden rounded-md'>
        <ImageWithFallback src={image} alt={name} className='h-full w-full object-cover' />
        {badge && <span className='absolute left-1 top-1 rounded bg-gold px-1.5 py-0.5 text-[10px] font-bold text-bg'>{badge}</span>}
      </div>
      <span className='text-xs font-medium leading-tight text-fg sm:text-sm'>{name}</span>
    </div>
  );
}
