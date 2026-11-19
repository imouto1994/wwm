import { Button } from '@/components/Button';
import { CopyButton } from '@/components/CopyButton';
import { JsonField } from '@/components/host/JsonField';
import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import { formatClockTime } from '@/lib/i18n';
import { nameLookup } from '@/lib/names';
import { gamesLineOf, gamesShares, hasGamesPrediction, matchGamesVotes, matchVotes, parseVotesJson, voteShares } from '@/lib/polls';
import type { GamesPick, Series, Tournament } from '@/types/tournament';
import { type ReactNode, useState } from 'react';

interface PollPanelProps {
  host: HostController;
  tournament: Tournament;
  series: Series;
}

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

function Recorded({ recordedAt, count, onClear, children }: { recordedAt: string; count: number; onClear: () => void; children?: ReactNode }) {
  const { t, locale } = useI18n();
  return (
    <div className='flex flex-col gap-2 text-sm'>
      <p className='text-muted'>{t.poll.recorded(formatClockTime(recordedAt, locale), count)}</p>
      {children}
      <div>
        <Button variant='danger' onClick={onClear}>
          {t.poll.clear}
        </Button>
      </div>
    </div>
  );
}

/** "Who wins?" (in the survival game, "who goes out?"): the three players as answers. */
function WinnerPoll({ host, tournament, series }: PollPanelProps) {
  const { t } = useI18n();
  const nameOf = nameLookup(tournament);
  const shares = voteShares(series);
  const [jsonText, setJsonText] = useState('');
  const isSurvival = series.stage === 'survival';

  const parsed = jsonText.trim() ? parseVotesJson(jsonText) : undefined;
  const matched = parsed?.ok ? matchVotes(series, tournament.displayNames, parsed.value) : undefined;

  return (
    <section className='flex flex-col gap-3'>
      <h4 className='font-semibold text-fg'>{isSurvival ? t.poll.outTitle : t.poll.winnerTitle}</h4>
      <Prompt
        question={isSurvival ? t.poll.outQuestion(t.seriesName(series)) : t.poll.winnerQuestion(t.seriesName(series))}
        answers={series.playerIds.map(nameOf)}
      />

      {series.poll && (
        <Recorded
          recordedAt={series.poll.recordedAt}
          count={series.poll.ballots.length}
          onClear={() => host.dispatch({ type: 'clearPoll', seriesId: series.id })}
        >
          {shares && <p className='text-fg'>{shares.map((share) => `${nameOf(share.playerId)} ${share.percent}%`).join(' · ')}</p>}
        </Recorded>
      )}

      <div className='flex flex-col gap-2'>
        <h5 className={subheading}>{t.poll.importTitle}</h5>
        <JsonField value={jsonText} onChange={setJsonText} placeholder={t.poll.importPlaceholder} />
        {parsed && !parsed.ok && <p className='text-sm text-red'>{parsed.error(t)}</p>}
        {matched && (
          <div className='flex flex-col gap-1 text-sm'>
            <p className='text-fg'>{series.playerIds.map((playerId) => `${nameOf(playerId)} ${matched.votes[playerId]}`).join(' · ')}</p>
            <ImportIssues unmatched={matched.unmatched} duplicates={matched.duplicates} describe={t.poll.unmatchedPlayers} />
            <div>
              <Button
                variant='primary'
                disabled={matched.ballots.length === 0}
                onClick={() => host.dispatch({ type: 'recordPoll', seriesId: series.id, ballots: matched.ballots }) && setJsonText('')}
              >
                {t.poll.saveVotes(matched.ballots.length)}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const PICKS: GamesPick[] = ['over', 'under'];

const STAGE_OF_SERIES = { group: 'groups', survival: 'survival', semi: 'semis', final: 'final' } as const;

/** "Over or under N games?": the line is fixed per phase; answers are read as over/under in either language. */
function GamesPollSection({ host, series }: Omit<PollPanelProps, 'tournament'>) {
  const { t, decimal } = useI18n();
  // A poll recorded earlier keeps the line its voters saw.
  const line = series.gamesPoll?.line ?? gamesLineOf(series);
  const lineText = decimal(line);
  const shares = gamesShares(series);
  const [jsonText, setJsonText] = useState('');

  const parsed = jsonText.trim() ? parseVotesJson(jsonText) : undefined;
  const matched = parsed?.ok ? matchGamesVotes(parsed.value) : undefined;
  const pickLabel = (pick: GamesPick) => (pick === 'over' ? t.poll.overShort : t.poll.underShort);

  return (
    <section className='flex flex-col gap-3 border-t border-border pt-4'>
      <h4 className='font-semibold text-fg'>{t.poll.gamesTitle}</h4>
      <p className='text-xs text-muted'>{t.poll.fixedLine(lineText, t.stages[STAGE_OF_SERIES[series.stage]])}</p>
      <Prompt question={t.poll.gamesQuestion(t.seriesName(series), lineText)} answers={[t.poll.over(lineText), t.poll.under(lineText)]} />

      {series.gamesPoll && (
        <Recorded
          recordedAt={series.gamesPoll.recordedAt}
          count={series.gamesPoll.ballots.length}
          onClear={() => host.dispatch({ type: 'clearGamesPoll', seriesId: series.id })}
        >
          {shares && (
            <p className='text-fg'>
              {t.poll.overShort} {shares.over}% · {t.poll.underShort} {shares.under}%
            </p>
          )}
        </Recorded>
      )}

      <div className='flex flex-col gap-2'>
        <h5 className={subheading}>{t.poll.importTitle}</h5>
        <JsonField value={jsonText} onChange={setJsonText} placeholder={t.poll.importPlaceholder} />
        {parsed && !parsed.ok && <p className='text-sm text-red'>{parsed.error(t)}</p>}
        {matched && (
          <div className='flex flex-col gap-1 text-sm'>
            <p className='text-fg'>{PICKS.map((pick) => `${pickLabel(pick)} ${matched.votes[pick]}`).join(' · ')}</p>
            <ImportIssues unmatched={matched.unmatched} duplicates={matched.duplicates} describe={t.poll.unmatchedGames} />
            <div>
              <Button
                variant='primary'
                disabled={matched.ballots.length === 0}
                onClick={() => host.dispatch({ type: 'recordGamesPoll', seriesId: series.id, ballots: matched.ballots }) && setJsonText('')}
              >
                {t.poll.saveVotes(matched.ballots.length)}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The Discord predictions for one series: copy-ready poll text for EasyPoll,
 * then the per-voter JSON from the EasyPoll console snippet or
 * `pnpm easypoll:json`, previewed before it is saved. Typed counts aren't
 * accepted, since only named ballots can rank members on the leaderboard.
 * One-match series get only the winner poll, since their length is always one game.
 */
export function PollPanel({ host, tournament, series }: PollPanelProps) {
  const { t } = useI18n();
  return (
    <div className='flex flex-col gap-4 rounded-lg border border-border bg-surface p-4'>
      <div className='flex flex-col gap-1'>
        <h3 className='font-semibold text-fg'>{t.poll.title}</h3>
        <p className='text-xs text-muted'>{t.poll.nonAnonymous}</p>
        <p className='text-xs text-muted'>{t.poll.jsonOnly}</p>
      </div>
      <WinnerPoll key={`${series.id}-winner`} host={host} tournament={tournament} series={series} />
      {hasGamesPrediction(series) && <GamesPollSection key={`${series.id}-games`} host={host} series={series} />}
    </div>
  );
}
