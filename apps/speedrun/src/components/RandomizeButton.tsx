import { Shuffle } from 'lucide-react';

interface RandomizeButtonProps {
  hasResult: boolean;
  onClick: () => void;
}

// Host-mode-only control. Label changes once a result exists, since the host
// will click this repeatedly - once per participant - during the event.
export function RandomizeButton({ hasResult, onClick }: RandomizeButtonProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='flex w-fit items-center justify-center gap-2 rounded-lg bg-gold px-5 py-2.5 font-semibold text-bg transition hover:opacity-90 active:opacity-80'
    >
      <Shuffle size={18} />
      {hasResult ? 'Randomize Again' : 'Randomize'}
    </button>
  );
}
