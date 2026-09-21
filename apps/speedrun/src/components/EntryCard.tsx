import { ImageWithFallback } from '@/components/ImageWithFallback';

interface EntryCardProps {
  name: string;
  image: string;
}

// A single weapon or skill: a square image frame (fixed aspect ratio, so the
// grid never jumps around while art of varying sizes gets swapped in) plus
// its name. No badges/tags are shown - every weapon/skill is presented the
// same way regardless of any metadata flags (e.g. isDps) it carries.
export function EntryCard({ name, image }: EntryCardProps) {
  return (
    <div className='flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-2 text-center'>
      <div className='relative aspect-square w-full overflow-hidden rounded-md'>
        <ImageWithFallback src={image} alt={name} className='h-full w-full object-cover' />
      </div>
      <span className='text-xs font-medium leading-tight text-fg sm:text-sm'>{name}</span>
    </div>
  );
}
