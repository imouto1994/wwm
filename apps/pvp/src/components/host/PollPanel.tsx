import { Button } from '@/components/Button';
import { CopyButton } from '@/components/CopyButton';
import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import { formatClockTime } from '@/lib/i18n';
import { nameLookup } from '@/lib/names';
import { gamesLineOf, gamesShares, hasGamesPrediction, matchGamesVotes, matchVotes, parseVotesJson, voteShares } from '@/lib/polls';
import type { GamesPick, PlayerId, Series, Tournament } from '@/types/tournament';
import { type ChangeEvent, type ReactNode, useEffect, useState } from 'react';

interface PollPanelProps {
  host: HostController;
  tournament: Tournament;
  series: Series;
}

const inputClass = 'rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-fg';
const subheading = 'text-xs font-semibold uppercase tracking-wide text-muted';

function Prompt({ question, answers }: { question: string; answers: string[] }) {
  const { t } = useI18n();
  return (
    <div className='flex flex-col gap-2 text-sm'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-muted'>{t.poll.question}</span> <span className='text-fg'>{question}</span>
        <CopyButton text={question} />
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-muted'>{t.poll.answers}</span> <span className='text-fg'>{answers.join(' · ')}</span>
        <CopyButton text={answers.join('\n')} />
      </div>
    </div>
  );
}

/** Paste box plus file picker for the EasyPoll votes JSON; parsing and matching stay with the caller. */
function VotesJsonField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const { t } = useI18n();
  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onChange(await file.text());
    event.target.value = '';
  }
  return (
    <>
      <textarea
        rows={3}
        placeholder={t.poll.importPlaceholder}
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

function ImportIssues({
  unmatched,
  duplicates,
  describe,
}: { unmatched: { answer: string; count: number }[]; duplicates: number; describe: (answers: string) => string }) {
  const { t } = useI18n();
  return (
    <>
      {unmatched.length > 0 && <p className='text-red'>{describe(unmatched.map((entry) => `“${entry.answer}” (${entry.count})`).join(', '))}</p>}
      {duplicates > 0 && <p className='text-muted'>{t.poll.duplicates(duplicates)}</p>}
    </>
  );
}

function Recorded({ recordedAt, named, children }: { recordedAt: string; named: number | undefined; children?: ReactNode }) {
  const { t, locale } = useI18n();
  const time = formatClockTime(recordedAt, locale);
  return (
    <div className='flex flex-col gap-1 text-sm'>
      <p className='text-muted'>{named === undefined ? t.poll.recordedCounts(time) : t.poll.recorded(time, named)}</p>
      {children}
    </div>
  );
}

/** "Who wins?": the three players as answers. */
function WinnerPoll({ host, tournament, series }: PollPanelProps) {
  const { t } = useI18n();
  const nameOf = nameLookup(tournament);
  const shares = voteShares(series);
  const [counts, setCounts] = useState<Record<PlayerId, string>>({});
  const [jsonText, setJsonText] = useState('');

  useEffect(() => {
    setCounts(Object.fromEntries(series.playerIds.map((playerId) => [playerId, String(series.poll?.votes[playerId] ?? '')])));
    setJsonText('');
  }, [series.poll, series.playerIds]);

  const parsed = jsonText.trim() ? parseVotesJson(jsonText) : undefined;
  const matched = parsed?.ok ? matchVotes(series, tournament.players, parsed.value) : undefined;

  function saveCounts() {
    const votes = Object.fromEntries(series.playerIds.map((playerId) => [playerId, Number(counts[playerId] || 0)]));
    host.dispatch({ type: 'recordPoll', seriesId: series.id, votes });
  }

  return (
    <section className='flex flex-col gap-3'>
      <h4 className='font-semibold text-fg'>{t.poll.winnerTitle}</h4>
      <Prompt question={t.poll.winnerQuestion(t.seriesName(series))} answers={series.playerIds.map(nameOf)} />

      {series.poll && (
        <Recorded recordedAt={series.poll.recordedAt} named={series.poll.ballots?.length}>
          {shares && <p className='text-fg'>{shares.map((share) => `${nameOf(share.playerId)} ${share.percent}%`).join(' · ')}</p>}
        </Recorded>
      )}

      <div className='flex flex-col gap-2'>
        <h5 className={subheading}>{t.poll.importTitle}</h5>
        <VotesJsonField value={jsonText} onChange={setJsonText} />
        {parsed && !parsed.ok && <p className='text-sm text-red'>{parsed.error(t)}</p>}
        {matched && (
          <div className='flex flex-col gap-1 text-sm'>
            <p className='text-fg'>{series.playerIds.map((playerId) => `${nameOf(playerId)} ${matched.votes[playerId]}`).join(' · ')}</p>
            <ImportIssues unmatched={matched.unmatched} duplicates={matched.duplicates} describe={t.poll.unmatchedPlayers} />
            <div>
              <Button
                variant='primary'
                disabled={matched.ballots.length === 0}
                onClick={() => host.dispatch({ type: 'recordPoll', seriesId: series.id, votes: matched.votes, ballots: matched.ballots }) && setJsonText('')}
              >
                {t.poll.saveVotes(matched.ballots.length)}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className='flex flex-col gap-2'>
        <h5 className={subheading}>{t.poll.typeCounts}</h5>
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
                className={inputClass}
              />
            </label>
          ))}
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button onClick={saveCounts}>{t.poll.saveCounts}</Button>
          {series.poll && (
            <Button variant='danger' onClick={() => host.dispatch({ type: 'clearPoll', seriesId: series.id })}>
              {t.poll.clear}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

const PICKS: GamesPick[] = ['over', 'under'];

const STAGE_OF_SERIES = { group: 'groups', semi: 'semis', final: 'final' } as const;

/** "Over or under N games?": the line is fixed per phase; answers are read as over/under in either language. */
function GamesPollSection({ host, series }: Omit<PollPanelProps, 'tournament'>) {
  const { t, decimal } = useI18n();
  // A poll recorded earlier keeps the line its voters saw.
  const line = series.gamesPoll?.line ?? gamesLineOf(series);
  const lineText = decimal(line);
  const shares = gamesShares(series);
  const [counts, setCounts] = useState<Record<GamesPick, string>>({ over: '', under: '' });
  const [jsonText, setJsonText] = useState('');

  useEffect(() => {
    setCounts({ over: String(series.gamesPoll?.votes.over ?? ''), under: String(series.gamesPoll?.votes.under ?? '') });
    setJsonText('');
  }, [series.gamesPoll]);

  const parsed = jsonText.trim() ? parseVotesJson(jsonText) : undefined;
  const matched = parsed?.ok ? matchGamesVotes(parsed.value) : undefined;
  const pickLabel = (pick: GamesPick) => (pick === 'over' ? t.poll.overShort : t.poll.underShort);

  return (
    <section className='flex flex-col gap-3 border-t border-border pt-4'>
      <h4 className='font-semibold text-fg'>{t.poll.gamesTitle}</h4>
      <p className='text-xs text-muted'>{t.poll.fixedLine(lineText, t.stages[STAGE_OF_SERIES[series.stage]])}</p>
      <Prompt question={t.poll.gamesQuestion(t.seriesName(series), lineText)} answers={[t.poll.over(lineText), t.poll.under(lineText)]} />

      {series.gamesPoll && (
        <Recorded recordedAt={series.gamesPoll.recordedAt} named={series.gamesPoll.ballots?.length}>
          {shares && (
            <p className='text-fg'>
              {t.poll.overShort} {shares.over}% · {t.poll.underShort} {shares.under}%
            </p>
          )}
        </Recorded>
      )}

      <div className='flex flex-col gap-2'>
        <h5 className={subheading}>{t.poll.importTitle}</h5>
        <VotesJsonField value={jsonText} onChange={setJsonText} />
        {parsed && !parsed.ok && <p className='text-sm text-red'>{parsed.error(t)}</p>}
        {matched && (
          <div className='flex flex-col gap-1 text-sm'>
            <p className='text-fg'>{PICKS.map((pick) => `${pickLabel(pick)} ${matched.votes[pick]}`).join(' · ')}</p>
            <ImportIssues unmatched={matched.unmatched} duplicates={matched.duplicates} describe={t.poll.unmatchedGames} />
            <div>
              <Button
                variant='primary'
                disabled={matched.ballots.length === 0}
                onClick={() =>
                  host.dispatch({ type: 'recordGamesPoll', seriesId: series.id, votes: matched.votes, ballots: matched.ballots }) && setJsonText('')
                }
              >
                {t.poll.saveVotes(matched.ballots.length)}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className='flex flex-col gap-2'>
        <h5 className={subheading}>{t.poll.typeCounts}</h5>
        <div className='grid grid-cols-2 gap-2'>
          {PICKS.map((pick) => (
            <label key={pick} className='flex flex-col gap-1 text-xs text-muted'>
              {pick === 'over' ? t.poll.over(lineText) : t.poll.under(lineText)}
              <input
                type='number'
                min={0}
                inputMode='numeric'
                value={counts[pick]}
                onChange={(event) => setCounts((current) => ({ ...current, [pick]: event.target.value }))}
                className={inputClass}
              />
            </label>
          ))}
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            onClick={() =>
              host.dispatch({ type: 'recordGamesPoll', seriesId: series.id, votes: { over: Number(counts.over || 0), under: Number(counts.under || 0) } })
            }
          >
            {t.poll.saveCounts}
          </Button>
          {series.gamesPoll && (
            <Button variant='danger' onClick={() => host.dispatch({ type: 'clearGamesPoll', seriesId: series.id })}>
              {t.poll.clear}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The Discord predictions for one series: copy-ready poll text for EasyPoll,
 * then either typed counts or the per-voter JSON from the EasyPoll console
 * snippet or `pnpm easypoll:json`, previewed before it is saved. One-match
 * series get only the winner poll, since their length is always one game.
 */
export function PollPanel({ host, tournament, series }: PollPanelProps) {
  const { t } = useI18n();
  return (
    <div className='flex flex-col gap-4 rounded-lg border border-border bg-surface p-4'>
      <div className='flex flex-col gap-1'>
        <h3 className='font-semibold text-fg'>{t.poll.title}</h3>
        <p className='text-xs text-muted'>{t.poll.nonAnonymous}</p>
      </div>
      <WinnerPoll key={`${series.id}-winner`} host={host} tournament={tournament} series={series} />
      {hasGamesPrediction(series) && <GamesPollSection key={`${series.id}-games`} host={host} series={series} />}
    </div>
  );
}
