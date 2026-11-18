import type { ChangeEvent } from 'react';

interface JsonFieldProps {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  rows?: number;
}

/** Paste box plus file picker for a JSON document; parsing stays with the caller. */
export function JsonField({ value, onChange, placeholder, rows = 3 }: JsonFieldProps) {
  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onChange(await file.text());
    event.target.value = '';
  }
  return (
    <>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className='rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-fg'
      />
      <input
        type='file'
        accept='application/json,.json'
        onChange={handleFile}
        className='text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-surface-hover file:px-2 file:py-1 file:text-fg'
      />
    </>
  );
}
