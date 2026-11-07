import { EntryCard } from '@/components/EntryCard';
import { useEffect } from 'react';

interface PickerOption {
  id: string;
  name: string;
  image: string;
}

interface EntryPickerProps {
  title: string;
  options: PickerOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * Full-screen picker overlay used by Edit Mode. Shows every eligible option
 * as an EntryCard; clicking one commits the change and closes. Escape /
 * backdrop click cancels without changing anything.
 */
export function EntryPicker({ title, options, selectedId, onSelect, onClose }: EntryPickerProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className='fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 p-4 backdrop-blur-sm'
      role='dialog'
      aria-modal='true'
      aria-label={title}
      onClick={onClose}
    >
      <div
        className='my-8 w-full max-w-3xl rounded-xl border border-border bg-surface p-4 shadow-xl'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-center justify-between gap-3'>
          <h2 className='text-base font-semibold text-gold'>{title}</h2>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:bg-surface-hover hover:text-fg'
          >
            Cancel
          </button>
        </div>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5'>
          {options.map((option) => {
            const isSelected = option.id === selectedId;
            return (
              <button
                key={option.id}
                type='button'
                onClick={() => onSelect(option.id)}
                className={`rounded-lg text-left transition ${
                  isSelected ? 'ring-2 ring-gold ring-offset-2 ring-offset-surface' : 'hover:ring-1 hover:ring-border'
                }`}
              >
                <EntryCard name={option.name} image={option.image} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
