import { Button } from '@/components/Button';
import { RearrangePanel } from '@/components/host/RearrangePanel';
import { SemifinalPicker } from '@/components/host/SemifinalPicker';
import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import type { Messages } from '@/lib/i18n';
import { nameLookup } from '@/lib/names';
import { groupStageOutcome, pendingTies, semifinalGroups, semifinalSelection, semifinalSeriesFrom } from '@/lib/qualification';
import { championOf, nextStage, playableSeries } from '@/lib/reducer';
import { seriesWinner } from '@/lib/series';
import type { Tournament } from '@/types/tournament';
import { ChevronRight, Dice5, RotateCcw } from 'lucide-react';

interface StageGateProps {
  host: HostController;
  tournament: Tournament;
}

/** Readable name for a tie, from its key ("seeding:p1,p7" → "Semifinal seeding"). */
function tieContext(key: string, t: Messages): string {
  const context = key.slice(0, key.lastIndexOf(':'));
  return context === 'seeding' ? t.gate.seedingTie : context;
}

/**
 * Shown once every series in the stage is finished: who goes through, the
 * host's semifinal picks (21, 24 and 30 players), any seeding ties that need
 * an on-screen draw, the semifinal groups to arrange (already public), the
 * late-running rule, and the button to move on.
 */
export function StageGate({ host, tournament }: StageGateProps) {
  const { t } = useI18n();
  const nameOf = nameLookup(tournament);
  const ties = pendingTies(tournament);
  const next = nextStage(tournament);
  const advanceLabel = next ? t.gate.advance[next] : undefined;
  const isGroupStage = tournament.stage === 'groups';
  const selection = isGroupStage ? semifinalSelection(tournament) : undefined;
  const picksMissing = Boolean(selection && !selection.semifinalists);
  const draftGroups = isGroupStage ? semifinalGroups(tournament) : undefined;
  const recentDraws = tournament.tieDraws.slice(-4).reverse();

  let summary: string | undefined;
  if (isGroupStage) {
    summary = selection?.semifinalists
      ? t.gate.throughSemis(selection.semifinalists.map(nameOf).join(', '))
      : t.gate.groupWinners(groupStageOutcome(tournament).winners.map(nameOf).join(', '));
  } else if (tournament.stage === 'semis') {
    summary = t.gate.finalists(
      playableSeries(tournament)
        .map((series) => nameOf(seriesWinner(series) ?? ''))
        .join(', ')
    );
  } else if (tournament.stage === 'final') {
    const champion = championOf(tournament);
    summary = champion ? t.gate.championWins(nameOf(champion)) : undefined;
  }

  return (
    <div className='flex flex-col gap-4 rounded-lg border border-gold/50 bg-surface p-4'>
      <h3 className='font-semibold text-gold'>{t.gate.complete}</h3>
      {summary && <p className='text-sm text-fg'>{summary}</p>}

      {selection && <SemifinalPicker host={host} tournament={tournament} selection={selection} />}

      {ties.length > 0 && (
        <div className='flex flex-col gap-2'>
          <p className='text-sm text-fg'>{t.gate.tiesIntro}</p>
          <ul className='flex flex-col gap-1 text-sm text-muted'>
            {ties.map((tie) => (
              <li key={tie.key}>
                <span className='text-fg'>{tieContext(tie.key, t)}:</span> {tie.playerIds.map(nameOf).join(', ')}
              </li>
            ))}
          </ul>
          <div>
            <Button variant='primary' onClick={() => host.dispatch({ type: 'resolveTies' })}>
              <Dice5 size={16} /> {t.gate.drawTies}
            </Button>
          </div>
        </div>
      )}

      {recentDraws.length > 0 && (
        <div className='flex flex-col gap-1 text-xs text-muted'>
          <p className='font-semibold uppercase tracking-wide'>{t.gate.recentDraws}</p>
          {recentDraws.map((draw) => (
            <p key={draw.key}>
              {tieContext(draw.key, t)}: {draw.order.map(nameOf).join(' > ')}
            </p>
          ))}
        </div>
      )}

      {draftGroups && (
        <div className='flex flex-col gap-2'>
          <p className='text-sm text-fg'>{t.gate.preview}</p>
          <RearrangePanel
            host={host}
            tournament={tournament}
            series={semifinalSeriesFrom(draftGroups, tournament.lateRule)}
            onSwap={(firstId, secondId) => host.dispatch({ type: 'arrangeSemifinals', firstId, secondId })}
          />
          {tournament.semifinalDraft && (
            <div>
              <Button onClick={() => host.dispatch({ type: 'resetSemifinalDraft' })}>
                <RotateCcw size={14} /> {t.gate.resetDraft}
              </Button>
            </div>
          )}
        </div>
      )}

      {isGroupStage && (
        <label className='flex items-start gap-2 text-sm text-fg'>
          <input
            type='checkbox'
            checked={tournament.lateRule}
            onChange={(event) => host.dispatch({ type: 'setLateRule', enabled: event.target.checked })}
            className='mt-0.5'
          />
          <span>
            {t.gate.lateRule}
            <span className='block text-xs text-muted'>{t.gate.lateRuleHelp}</span>
          </span>
        </label>
      )}

      {advanceLabel && (
        <div>
          <Button variant='primary' onClick={() => host.dispatch({ type: 'advance' })} disabled={ties.length > 0 || picksMissing}>
            {advanceLabel} <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
