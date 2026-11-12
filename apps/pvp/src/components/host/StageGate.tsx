import { Button } from '@/components/Button';
import type { HostController } from '@/hooks/useHostTournament';
import { formatFor } from '@/lib/format';
import { nameLookup } from '@/lib/names';
import { groupSeries, groupStageOutcome, pendingTies, seedingOrder, semifinalistsOf } from '@/lib/qualification';
import { championOf, nextStage, playableSeries } from '@/lib/reducer';
import { seedSemifinalGroups } from '@/lib/seeding';
import { seriesWinner } from '@/lib/series';
import type { PlayerId, Stage, Tournament } from '@/types/tournament';
import { ChevronRight, Dice5 } from 'lucide-react';

interface StageGateProps {
  host: HostController;
  tournament: Tournament;
}

const ADVANCE_LABELS: Partial<Record<Stage, string>> = {
  playIn: 'Start the play-in',
  semis: 'Seed and start the semifinals',
  final: 'Start the grand final',
  done: 'Finish the tournament',
};

/** Readable name for a tie, from its key ("runnerUp:G3:p1,p7" → "Runner-up of Group 3"). */
function tieContext(key: string, tournament: Tournament): string {
  const context = key.slice(0, key.lastIndexOf(':'));
  if (context.startsWith('runnerUp:')) {
    const seriesId = context.split(':')[1];
    return `Runner-up of ${tournament.series.find((series) => series.id === seriesId)?.label ?? seriesId}`;
  }
  if (context === 'runnersUp') return 'Best runners-up';
  if (context === 'winners') return 'Weakest group winners (play-in)';
  if (context === 'seeding') return 'Semifinal seeding';
  return context;
}

/** The semifinal groups that advancing would create, shown before the host commits. */
function semifinalPreview(tournament: Tournament): PlayerId[][] | undefined {
  let semifinalists: PlayerId[] | undefined;
  if (tournament.stage === 'groups' && !formatFor(tournament.players.length).hasPlayIn) semifinalists = groupStageOutcome(tournament).qualifiers;
  if (tournament.stage === 'playIn') semifinalists = semifinalistsOf(tournament);
  if (!semifinalists || semifinalists.length !== 9) return undefined;
  const seeding = seedingOrder(tournament, semifinalists);
  if (seeding.ties.length > 0) return undefined;
  const origin = new Map(groupSeries(tournament).flatMap((series) => series.playerIds.map((playerId) => [playerId, series.id] as const)));
  return seedSemifinalGroups(seeding.order, (playerId) => origin.get(playerId));
}

/**
 * Shown once every series in the stage is finished: who goes through, any
 * ties that need an on-screen draw, the late-running rule, and the button to
 * move on. Advancing is blocked until all ties are drawn.
 */
export function StageGate({ host, tournament }: StageGateProps) {
  const nameOf = nameLookup(tournament);
  const ties = pendingTies(tournament);
  const next = nextStage(tournament);
  const advanceLabel = next ? ADVANCE_LABELS[next] : undefined;
  const preview = ties.length === 0 ? semifinalPreview(tournament) : undefined;
  const lateRuleEditable = tournament.stage === 'groups' || tournament.stage === 'playIn';
  const recentDraws = tournament.tieDraws.slice(-4).reverse();

  let summary: string | undefined;
  if (tournament.stage === 'groups' && ties.length === 0) {
    const outcome = groupStageOutcome(tournament);
    summary = outcome.playIn.length
      ? `Straight through: ${outcome.qualifiers.map(nameOf).join(', ')}. Play-in: ${outcome.playIn.map(nameOf).join(', ')}.`
      : `Through to the semifinals: ${outcome.qualifiers.map(nameOf).join(', ')}.`;
  } else if (tournament.stage === 'semis') {
    summary = `Grand finalists: ${playableSeries(tournament)
      .map((series) => nameOf(seriesWinner(series) ?? ''))
      .join(', ')}.`;
  } else if (tournament.stage === 'final') {
    const champion = championOf(tournament);
    summary = champion ? `${nameOf(champion)} wins the tournament.` : undefined;
  }

  return (
    <div className='flex flex-col gap-4 rounded-lg border border-gold/50 bg-surface p-4'>
      <h3 className='font-semibold text-gold'>Stage complete</h3>
      {summary && <p className='text-sm text-fg'>{summary}</p>}

      {ties.length > 0 && (
        <div className='flex flex-col gap-2'>
          <p className='text-sm text-fg'>These players are level on wins and points per game, so a random draw decides:</p>
          <ul className='flex flex-col gap-1 text-sm text-muted'>
            {ties.map((tie) => (
              <li key={tie.key}>
                <span className='text-fg'>{tieContext(tie.key, tournament)}:</span> {tie.playerIds.map(nameOf).join(', ')}
              </li>
            ))}
          </ul>
          <div>
            <Button variant='primary' onClick={() => host.dispatch({ type: 'resolveTies' })}>
              <Dice5 size={16} /> Draw to break the ties
            </Button>
          </div>
        </div>
      )}

      {recentDraws.length > 0 && (
        <div className='flex flex-col gap-1 text-xs text-muted'>
          <p className='font-semibold uppercase tracking-wide'>Recent draws</p>
          {recentDraws.map((draw) => (
            <p key={draw.key}>
              {tieContext(draw.key, tournament)}: {draw.order.map(nameOf).join(' > ')}
            </p>
          ))}
        </div>
      )}

      {preview && (
        <div className='flex flex-col gap-1 text-sm'>
          <p className='text-muted'>Semifinal groups (seeded):</p>
          {preview.map((group, index) => (
            <p key={group.join()} className='text-fg'>
              Semifinal {index + 1}: {group.map(nameOf).join(', ')}
            </p>
          ))}
        </div>
      )}

      {lateRuleEditable && (
        <label className='flex items-start gap-2 text-sm text-fg'>
          <input
            type='checkbox'
            checked={tournament.lateRule}
            onChange={(event) => host.dispatch({ type: 'setLateRule', enabled: event.target.checked })}
            className='mt-0.5'
          />
          <span>
            Late-running rule: semifinals are one match each
            <span className='block text-xs text-muted'>Use it if the break ends late. The grand final always stays first to 2.</span>
          </span>
        </label>
      )}

      {advanceLabel && (
        <div>
          <Button variant='primary' onClick={() => host.dispatch({ type: 'advance' })} disabled={ties.length > 0}>
            {advanceLabel} <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
