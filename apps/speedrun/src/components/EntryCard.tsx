import { ImageWithFallback } from '@/components/ImageWithFallback';

interface EntryCardProps {
  name: string;
  image: string;
  // When set, the card becomes a button (used by Edit Mode). Kept optional
  // so the same component still works as a plain display card for viewers.
  onClick?: () => void;
  editable?: boolean;
}

// A single weapon or skill: a square image frame (fixed aspect ratio, so the
// grid never jumps around while art of varying sizes gets swapped in) plus
// its name. No badges/tags are shown - every weapon/skill is presented the
// same way regardless of any metadata flags (e.g. isDps) it carries.
export function EntryCard({ name, image, onClick, editable = false }: EntryCardProps) {
  const body = (
    <>
      <div className='relative aspect-square w-full overflow-hidden rounded-md'>
        <ImageWithFallback src={image} alt={name} className='h-full w-full object-cover' />
        {editable && (
          <span className='absolute inset-x-0 bottom-0 bg-bg/70 px-1 py-0.5 text-[10px] font-medium text-gold'>
            Click to change
          </span>
        )}
      </div>
      <span className='text-xs font-medium leading-tight text-fg sm:text-sm'>{name}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type='button'
        onClick={onClick}
        className='flex w-full flex-col items-center gap-2 rounded-lg border border-gold/50 bg-surface p-2 text-center transition hover:border-gold hover:bg-surface-hover'
      >
        {body}
      </button>
    );
  }

  return <div className='flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-2 text-center'>{body}</div>;
}
