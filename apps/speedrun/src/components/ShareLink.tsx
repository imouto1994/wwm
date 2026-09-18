import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface ShareLinkProps {
  url: string;
}

const INPUT_ID = 'share-link-input';

// Host-mode-only. Shows the current shareable URL plus a Copy button.
// `navigator.clipboard` requires a secure context (https, or localhost in
// dev) - when it's unavailable (e.g. dev over http on a LAN IP) we fall back
// to selecting the text so the user can copy it manually with Ctrl/Cmd+C.
export function ShareLink({ url }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      } catch {
        // Fall through to the manual-select fallback below.
      }
    }
    const input = document.getElementById(INPUT_ID);
    if (input instanceof HTMLInputElement) input.select();
  }

  return (
    <div className='flex flex-col gap-2'>
      <label htmlFor={INPUT_ID} className='text-sm font-semibold uppercase tracking-wide text-muted'>
        Share this result
      </label>
      <div className='flex gap-2'>
        <input
          id={INPUT_ID}
          type='text'
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className='flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg'
        />
        <button
          type='button'
          onClick={handleCopy}
          className='flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg transition hover:bg-surface-hover'
        >
          {copied ? <Check size={16} className='text-gold' /> : <Copy size={16} />}
          {copied ? 'Copied' : 'Copy Link'}
        </button>
      </div>
    </div>
  );
}
