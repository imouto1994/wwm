import { Button } from '@/components/Button';
import type { HostController } from '@/hooks/useHostTournament';
import { fetchHistory } from '@/lib/apiClient';
import { STAGE_LABELS, nameLookup } from '@/lib/names';
import { playableSeries, replacementCandidates } from '@/lib/reducer';
import { formatClockTime } from '@/lib/time';
import type { Tournament } from '@/types/tournament';
import { Download, History } from 'lucide-react';
import { type ReactNode, useState } from 'react';

interface HostToolsProps {
  host: HostController;
  tournament: Tournament;
  pin: string;
}

const inputClass = 'rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-fg';

function Tool({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className='flex flex-col gap-2 border-t border-border pt-4'>
      <h4 className='text-sm font-semibold text-fg'>{title}</h4>
      <p className='text-xs text-muted'>{description}</p>
      <div className='flex flex-wrap items-center gap-2'>{children}</div>
    </div>
  );
}

function downloadJson(tournament: Tournament) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(tournament, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `pvp-tournament-v${tournament.version}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Rarely needed corrections, kept out of the way in a collapsed panel. */
export function HostTools({ host, tournament, pin }: HostToolsProps) {
  const nameOf = nameLookup(tournament);
  const series = playableSeries(tournament);
  const [overrideSeriesId, setOverrideSeriesId] = useState('');
  const [overridePlayerId, setOverridePlayerId] = useState('');
  const [reason, setReason] = useState('');
  const [replaceSeriesId, setReplaceSeriesId] = useState('');
  const [outId, setOutId] = useState('');
  const [inId, setInId] = useState('');
  const [renameId, setRenameId] = useState('');
  const [newName, setNewName] = useState('');
  const [history, setHistory] = useState<Tournament[] | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [resetText, setResetText] = useState('');

  const overrideSeries = series.find((entry) => entry.id === overrideSeriesId);
  const replaceable = series.filter((entry) => (entry.stage === 'semi' || entry.stage === 'final') && entry.games.length === 0 && !entry.winnerOverride);
  const replaceSeries = replaceable.find((entry) => entry.id === replaceSeriesId);
  const candidates = replaceSeries && outId ? replacementCandidates(tournament, replaceSeries.id, outId) : [];

  async function loadHistory() {
    setHistoryError('');
    try {
      setHistory(await fetchHistory(pin));
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Could not load history.');
    }
  }

  return (
    <details className='rounded-lg border border-border bg-surface p-4'>
      <summary className='cursor-pointer text-sm font-semibold uppercase tracking-wide text-muted'>Host tools</summary>
      <div className='mt-4 flex flex-col gap-4'>
        {series.length > 0 && (
          <Tool title='Override a series winner' description='For forfeits, no-shows or a disconnect ruling. Viewers see the reason.'>
            <select
              value={overrideSeriesId}
              onChange={(event) => {
                setOverrideSeriesId(event.target.value);
                setOverridePlayerId('');
              }}
              className={inputClass}
            >
              <option value=''>Series…</option>
              {series.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
            <select value={overridePlayerId} onChange={(event) => setOverridePlayerId(event.target.value)} className={inputClass} disabled={!overrideSeries}>
              <option value=''>Winner…</option>
              {overrideSeries?.playerIds.map((playerId) => (
                <option key={playerId} value={playerId}>
                  {nameOf(playerId)}
                </option>
              ))}
            </select>
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder='Reason, e.g. forfeit' className={inputClass} />
            <Button
              disabled={!overrideSeries || !overridePlayerId || !reason.trim()}
              onClick={() => {
                if (host.dispatch({ type: 'overrideWinner', seriesId: overrideSeriesId, playerId: overridePlayerId, reason })) setReason('');
              }}
            >
              Apply
            </Button>
            {overrideSeries?.winnerOverride && (
              <Button variant='danger' onClick={() => host.dispatch({ type: 'clearOverride', seriesId: overrideSeriesId })}>
                Remove override
              </Button>
            )}
          </Tool>
        )}

        {replaceable.length > 0 && (
          <Tool
            title='Replace a player'
            description='For a semifinalist or finalist who has to leave before their series starts. Candidates are listed best first by the rules.'
          >
            <select
              value={replaceSeriesId}
              onChange={(event) => {
                setReplaceSeriesId(event.target.value);
                setOutId('');
                setInId('');
              }}
              className={inputClass}
            >
              <option value=''>Series…</option>
              {replaceable.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
            <select
              value={outId}
              onChange={(event) => {
                setOutId(event.target.value);
                setInId('');
              }}
              className={inputClass}
              disabled={!replaceSeries}
            >
              <option value=''>Leaving…</option>
              {replaceSeries?.playerIds.map((playerId) => (
                <option key={playerId} value={playerId}>
                  {nameOf(playerId)}
                </option>
              ))}
            </select>
            <select value={inId} onChange={(event) => setInId(event.target.value)} className={inputClass} disabled={candidates.length === 0}>
              <option value=''>Replacement…</option>
              {candidates.map((playerId, index) => (
                <option key={playerId} value={playerId}>
                  {index === 0 ? `${nameOf(playerId)} (suggested)` : nameOf(playerId)}
                </option>
              ))}
            </select>
            <Button disabled={!inId} onClick={() => host.dispatch({ type: 'replacePlayer', seriesId: replaceSeriesId, outId, inId })}>
              Replace
            </Button>
          </Tool>
        )}

        {tournament.players.length > 0 && (
          <Tool title='Fix a player’s name' description='Typos only; results stay attached to the player.'>
            <select
              value={renameId}
              onChange={(event) => {
                setRenameId(event.target.value);
                setNewName(nameOf(event.target.value));
              }}
              className={inputClass}
            >
              <option value=''>Player…</option>
              {tournament.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
            <input value={newName} onChange={(event) => setNewName(event.target.value)} className={inputClass} disabled={!renameId} />
            <Button disabled={!renameId || !newName.trim()} onClick={() => host.dispatch({ type: 'renamePlayer', playerId: renameId, name: newName })}>
              Rename
            </Button>
          </Tool>
        )}

        {tournament.stage !== 'setup' && (
          <Tool title='Go back a stage' description='Removes the current stage’s series (and their results) and reopens the previous stage for corrections.'>
            <Button
              variant='danger'
              onClick={() => {
                if (window.confirm(`Go back from ${STAGE_LABELS[tournament.stage]}? Series created for this stage are removed.`))
                  host.dispatch({ type: 'reopenStage' });
              }}
            >
              Reopen previous stage
            </Button>
          </Tool>
        )}

        <Tool title='Restore an earlier save' description='The server keeps the last 50 saves. Restoring makes that state the newest version.'>
          <Button onClick={loadHistory}>
            <History size={14} /> Load saves
          </Button>
          {historyError && <span className='text-sm text-red'>{historyError}</span>}
          {history && (
            <ul className='flex w-full flex-col gap-1 text-sm'>
              {history.length === 0 && <li className='text-muted'>No saves yet.</li>}
              {history.map((entry) => (
                <li key={entry.version} className='flex items-center justify-between gap-2'>
                  <span className='text-muted'>
                    v{entry.version} · {STAGE_LABELS[entry.stage]} · {entry.series.reduce((sum, item) => sum + item.games.length, 0)} games ·{' '}
                    {formatClockTime(entry.updatedAt)}
                  </span>
                  <Button
                    onClick={() => {
                      if (window.confirm(`Restore version ${entry.version}?`)) host.replace(entry);
                    }}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Tool>

        <Tool title='Export' description='Download the full tournament as JSON, for a backup at the end of each stage.'>
          <Button onClick={() => downloadJson(tournament)}>
            <Download size={14} /> Download JSON
          </Button>
        </Tool>

        <Tool title='Reset the tournament' description='Clears players, groups and results. Type RESET to confirm. Earlier saves stay restorable.'>
          <input value={resetText} onChange={(event) => setResetText(event.target.value)} placeholder='RESET' className={inputClass} />
          <Button
            variant='danger'
            disabled={resetText !== 'RESET'}
            onClick={() => {
              if (host.dispatch({ type: 'reset' })) setResetText('');
            }}
          >
            Reset
          </Button>
        </Tool>
      </div>
    </details>
  );
}
