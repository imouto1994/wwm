import { Button } from '@/components/Button';
import { CopyButton } from '@/components/CopyButton';
import type { HostController } from '@/hooks/useHostTournament';
import { nameLookup } from '@/lib/names';
import { matchVotes, parseVotesJson, pollPrompt, voteShares } from '@/lib/polls';
import { formatClockTime } from '@/lib/time';
import type { PlayerId, Series, Tournament } from '@/types/tournament';
import { type ChangeEvent, useEffect, useState } from 'react';

interface PollPanelProps {
  host: HostController;
  tournament: Tournament;
  series: Series;
}

/**
 * The Discord prediction for one series: copy-ready poll text for EasyPoll,
 * then either the three vote counts or the per-voter JSON from the EasyPoll
 * console snippet or `pnpm easypoll:json`, previewed before it is saved.
 */
export function PollPanel({ host, tournament, series }: PollPanelProps) {
  const nameOf = nameLookup(tournament);
  const prompt = pollPrompt(series, tournament.players);
  const shares = voteShares(series);
  const [counts, setCounts] = useState<Record<PlayerId, string>>({});
  const [jsonText, setJsonText] = useState('');

  useEffect(() => {
    setCounts(Object.fromEntries(series.playerIds.map((playerId) => [playerId, String(series.poll?.votes[playerId] ?? '')])));
    setJsonText('');
  }, [series.id, series.poll, series.playerIds]);

  const parsed = jsonText.trim() ? parseVotesJson(jsonText) : undefined;
  const matched = parsed?.ok ? matchVotes(series, tournament.players, parsed.value) : undefined;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setJsonText(await file.text());
    event.target.value = '';
  }

  function saveCounts() {
    const votes = Object.fromEntries(series.playerIds.map((playerId) => [playerId, Number(counts[playerId] || 0)]));
    host.dispatch({ type: 'recordPoll', seriesId: series.id, votes });
  }

  function saveImport() {
    if (!matched) return;
    if (host.dispatch({ type: 'recordPoll', seriesId: series.id, votes: matched.votes, ballots: matched.ballots })) setJsonText('');
  }

  return (
    <div className='flex flex-col gap-4 rounded-lg border border-border bg-surface p-4'>
      <h3 className='font-semibold text-fg'>Discord prediction</h3>

      <div className='flex flex-col gap-2 text-sm'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-muted'>Question:</span> <span className='text-fg'>{prompt.question}</span>
          <CopyButton text={prompt.question} label='Copy' />
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-muted'>Answers:</span> <span className='text-fg'>{prompt.answers.join(' · ')}</span>
          <CopyButton text={prompt.answers.join('\n')} label='Copy' />
        </div>
        <p className='text-xs text-muted'>Use a non-anonymous poll so the EasyPoll dashboard keeps showing who voted.</p>
      </div>

      {series.poll && (
        <div className='flex flex-col gap-1 text-sm'>
          <p className='text-muted'>
            Recorded at {formatClockTime(series.poll.recordedAt)}
            {series.poll.ballots ? ` with ${series.poll.ballots.length} named ${series.poll.ballots.length === 1 ? 'vote' : 'votes'}` : ' (counts only)'}.
          </p>
          {shares && <p className='text-fg'>{shares.map((share) => `${nameOf(share.playerId)} ${share.percent}%`).join(' · ')}</p>}
        </div>
      )}

      <div className='flex flex-col gap-2'>
        <h4 className='text-xs font-semibold uppercase tracking-wide text-muted'>Import votes JSON</h4>
        <textarea
          rows={3}
          placeholder='Paste the JSON copied by the EasyPoll console snippet (or from pnpm easypoll:json), or choose a file below'
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          className='rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-fg'
        />
        <input
          type='file'
          accept='application/json,.json'
          onChange={handleFile}
          className='text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-surface-hover file:px-2 file:py-1 file:text-fg'
        />
        {parsed && !parsed.ok && <p className='text-sm text-red'>{parsed.error}</p>}
        {matched && (
          <div className='flex flex-col gap-1 text-sm'>
            <p className='text-fg'>{series.playerIds.map((playerId) => `${nameOf(playerId)} ${matched.votes[playerId]}`).join(' · ')}</p>
            {matched.unmatched.length > 0 && (
              <p className='text-red'>
                Not matched to a player: {matched.unmatched.map((entry) => `“${entry.answer}” (${entry.count})`).join(', ')}. Check the poll answers match the
                names.
              </p>
            )}
            {matched.duplicates > 0 && <p className='text-muted'>{matched.duplicates} repeated voters ignored.</p>}
            <div>
              <Button variant='primary' onClick={saveImport} disabled={matched.ballots.length === 0}>
                Save {matched.ballots.length} votes
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className='flex flex-col gap-2'>
        <h4 className='text-xs font-semibold uppercase tracking-wide text-muted'>Or type the counts</h4>
        <div className='grid gap-2 sm:grid-cols-3'>
          {series.playerIds.map((playerId) => (
            <label key={playerId} className='flex flex-col gap-1 text-xs text-muted'>
              {nameOf(playerId)}
              <input
                type='number'
                min={0}
                inputMode='numeric'
                value={counts[playerId] ?? ''}
                onChange={(event) => setCounts((current) => ({ ...current, [playerId]: event.target.value }))}
                className='rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-fg'
              />
            </label>
          ))}
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button onClick={saveCounts}>Save counts</Button>
          {series.poll && (
            <Button variant='danger' onClick={() => host.dispatch({ type: 'clearPoll', seriesId: series.id })}>
              Clear prediction
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
