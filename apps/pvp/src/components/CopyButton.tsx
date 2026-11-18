import { useI18n } from '@/hooks/useI18n';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface CopyButtonProps {
  text: string;
}

// navigator.clipboard needs a secure context (https or localhost). Elsewhere
// the button just reports that copying failed, and the text stays visible on
// screen for a manual copy.
export function CopyButton({ text }: CopyButtonProps) {
  const { t } = useI18n();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 1500);
  }

  return (
    <button
      type='button'
      onClick={handleCopy}
      className='inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-fg transition hover:bg-surface-hover'
    >
      {state === 'copied' ? <Check size={14} className='text-green' /> : <Copy size={14} />}
      {state === 'copied' ? t.common.copied : state === 'failed' ? t.common.copyFailed : t.common.copy}
    </button>
  );
}
