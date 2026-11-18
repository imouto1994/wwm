import { Button } from '@/components/Button';
import { DisplayNamesEditor } from '@/components/host/DisplayNamesEditor';
import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import { describeApiError, fetchHistory } from '@/lib/apiClient';
import { type Translatable, formatClockTime } from '@/lib/i18n';
import { nameLookup } from '@/lib/names';
import { playableSeries, replacementCandidates } from '@/lib/reducer';
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
  const { t, locale } = useI18n();
  const nameOf = nameLookup(tournament);
  const series = playableSeries(tournament);
  const [overrideSeriesId, setOverrideSeriesId] = useState('');
  const [overridePlayerId, setOverridePlayerId] = useState('');
  const [reason, setReason] = useState('');
  const [replaceSeriesId, setReplaceSeriesId] = useState('');
  const [outId, setOutId] = useState('');
  const [inId, setInId] = useState('');
  const [history, setHistory] = useState<Tournament[] | null>(null);
  const [historyError, setHistoryError] = useState<Translatable>();
  const [resetText, setResetText] = useState('');

  const overrideSeries = series.find((entry) => entry.id === overrideSeriesId);
  const replaceable = series.filter((entry) => (entry.stage === 'semi' || entry.stage === 'final') && entry.games.length === 0 && !entry.winnerOverride);
  const replaceSeries = replaceable.find((entry) => entry.id === replaceSeriesId);
  const candidates = replaceSeries && outId ? replacementCandidates(tournament, replaceSeries.id, outId) : [];

  async function loadHistory() {
    setHistoryError(undefined);
    try {
      setHistory(await fetchHistory(pin));
    } catch (error) {
      setHistoryError(() => describeApiError(error));
    }
  }

  return (
    <details className='rounded-lg border border-border bg-surface p-4'>
      <summary className='cursor-pointer text-sm font-semibold uppercase tracking-wide text-muted'>{t.tools.title}</summary>
      <div className='mt-4 flex flex-col gap-4'>
        {series.length > 0 && (
          <Tool title={t.tools.overrideTitle} description={t.tools.overrideHelp}>
            <select
              value={overrideSeriesId}
              onChange={(event) => {
                setOverrideSeriesId(event.target.value);
                setOverridePlayerId('');
              }}
              className={inputClass}
            >
              <option value=''>{t.tools.series}</option>
              {series.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {t.seriesName(entry)}
                </option>
              ))}
            </select>
            <select value={overridePlayerId} onChange={(event) => setOverridePlayerId(event.target.value)} className={inputClass} disabled={!overrideSeries}>
              <option value=''>{t.tools.winner}</option>
              {overrideSeries?.playerIds.map((playerId) => (
                <option key={playerId} value={playerId}>
                  {nameOf(playerId)}
                </option>
              ))}
            </select>
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t.tools.reason} className={inputClass} />
            <Button
              disabled={!overrideSeries || !overridePlayerId || !reason.trim()}
              onClick={() => {
                if (host.dispatch({ type: 'overrideWinner', seriesId: overrideSeriesId, playerId: overridePlayerId, reason })) setReason('');
              }}
            >
              {t.tools.apply}
            </Button>
            {overrideSeries?.winnerOverride && (
              <Button variant='danger' onClick={() => host.dispatch({ type: 'clearOverride', seriesId: overrideSeriesId })}>
                {t.tools.removeOverride}
              </Button>
            )}
          </Tool>
        )}

        {replaceable.length > 0 && (
          <Tool title={t.tools.replaceTitle} description={t.tools.replaceHelp}>
            <select
              value={replaceSeriesId}
              onChange={(event) => {
                setReplaceSeriesId(event.target.value);
                setOutId('');
                setInId('');
              }}
              className={inputClass}
            >
              <option value=''>{t.tools.series}</option>
              {replaceable.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {t.seriesName(entry)}
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
              <option value=''>{t.tools.leaving}</option>
              {replaceSeries?.playerIds.map((playerId) => (
                <option key={playerId} value={playerId}>
                  {nameOf(playerId)}
                </option>
              ))}
            </select>
            <select value={inId} onChange={(event) => setInId(event.target.value)} className={inputClass} disabled={candidates.length === 0}>
              <option value=''>{t.tools.replacement}</option>
              {candidates.map((playerId, index) => (
                <option key={playerId} value={playerId}>
                  {index === 0 ? t.tools.suggested(nameOf(playerId)) : nameOf(playerId)}
                </option>
              ))}
            </select>
            <Button disabled={!inId} onClick={() => host.dispatch({ type: 'replacePlayer', seriesId: replaceSeriesId, outId, inId })}>
              {t.tools.replace}
            </Button>
          </Tool>
        )}

        {tournament.stage !== 'setup' && (
          <Tool title={`${t.names.title} · ${t.names.count(Object.keys(tournament.displayNames).length)}`} description={t.names.help}>
            <DisplayNamesEditor host={host} tournament={tournament} />
          </Tool>
        )}

        {tournament.stage !== 'setup' && (
          <Tool title={t.tools.reopenTitle} description={t.tools.reopenHelp}>
            <Button
              variant='danger'
              onClick={() => {
                if (window.confirm(t.tools.reopenConfirm(t.stages[tournament.stage]))) host.dispatch({ type: 'reopenStage' });
              }}
            >
              {t.tools.reopen}
            </Button>
          </Tool>
        )}

        <Tool title={t.tools.restoreTitle} description={t.tools.restoreHelp}>
          <Button onClick={loadHistory}>
            <History size={14} /> {t.tools.loadSaves}
          </Button>
          {historyError && <span className='text-sm text-red'>{historyError(t)}</span>}
          {history && (
            <ul className='flex w-full flex-col gap-1 text-sm'>
              {history.length === 0 && <li className='text-muted'>{t.tools.noSaves}</li>}
              {history.map((entry) => (
                <li key={entry.version} className='flex items-center justify-between gap-2'>
                  <span className='text-muted'>
                    {t.tools.historyEntry(
                      entry.version,
                      t.stages[entry.stage],
                      entry.series.reduce((sum, item) => sum + item.games.length, 0),
                      formatClockTime(entry.updatedAt, locale)
                    )}
                  </span>
                  <Button
                    onClick={() => {
                      if (window.confirm(t.tools.restoreConfirm(entry.version))) host.replace(entry);
                    }}
                  >
                    {t.tools.restore}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Tool>

        <Tool title={t.tools.exportTitle} description={t.tools.exportHelp}>
          <Button onClick={() => downloadJson(tournament)}>
            <Download size={14} /> {t.tools.download}
          </Button>
        </Tool>

        <Tool title={t.tools.resetTitle} description={t.tools.resetHelp}>
          <input value={resetText} onChange={(event) => setResetText(event.target.value)} placeholder='RESET' className={inputClass} />
          <Button
            variant='danger'
            disabled={resetText !== 'RESET'}
            onClick={() => {
              if (host.dispatch({ type: 'reset' })) setResetText('');
            }}
          >
            {t.tools.reset}
          </Button>
        </Tool>
      </div>
    </details>
  );
}
