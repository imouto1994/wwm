import { Button } from '@/components/Button';
import { JsonField } from '@/components/host/JsonField';
import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import { parseDisplayNamesJson } from '@/lib/names';
import type { Tournament } from '@/types/tournament';
import { useState } from 'react';

interface DisplayNamesEditorProps {
  host: HostController;
  tournament: Tournament;
}

const asText = (displayNames: Record<string, string>) => (Object.keys(displayNames).length > 0 ? JSON.stringify(displayNames, null, 2) : '');

/**
 * The Discord username → display name list as editable JSON. Keyed by the saved
 * list, so the box starts over from it whenever it changes (a save here or in
 * another tab) instead of holding stale text.
 */
export function DisplayNamesEditor({ host, tournament }: DisplayNamesEditorProps) {
  const saved = asText(tournament.displayNames);
  return <Editor key={saved} host={host} saved={saved} />;
}

function Editor({ host, saved }: { host: HostController; saved: string }) {
  const { t } = useI18n();
  const [text, setText] = useState(saved);
  const parsed = text.trim() && text !== saved ? parseDisplayNamesJson(text) : undefined;

  return (
    <div className='flex w-full flex-col gap-2'>
      <JsonField value={text} onChange={setText} placeholder={t.names.placeholder} rows={8} />
      {parsed && !parsed.ok && <p className='text-sm text-red'>{parsed.error(t)}</p>}
      {parsed?.ok && (
        <div>
          <Button variant='primary' onClick={() => host.dispatch({ type: 'setDisplayNames', displayNames: parsed.value })}>
            {t.names.save(Object.keys(parsed.value).length)}
          </Button>
        </div>
      )}
    </div>
  );
}
