import { Button } from '@/components/Button';
import { RearrangePanel } from '@/components/host/RearrangePanel';
import { SemifinalPicker } from '@/components/host/SemifinalPicker';
import type { HostController } from '@/hooks/useHostTournament';
import { useI18n } from '@/hooks/useI18n';
import { type Messages, describeRecord } from '@/lib/i18n';
import { nameLookup } from '@/lib/names';
import { groupSeries, groupStageOutcome, pendingTies, semifinalGroups, semifinalSelection, semifinalSeriesFrom, survivalPlan } from '@/lib/qualification';
import { finalStandings, nextStage, playableSeries } from '@/lib/reducer';
import { seriesWinner } from '@/lib/series';
import type { Tournament } from '@/types/tournament';
import { ChevronRight, Dice5 } from 'lucide-react';

interface StageGateProps {
  host: HostController;
  tournament: Tournament;
}

/** Readable name for a tie, from its key ("seeding:lan,minh" → "Semifinal seeding"). */
function tieContext(key: string, t: Messages): string {
  const context = key.slice(0, key.lastIndexOf(':'));
  return context === 'seeding' ? t.gate.seedingTie : context === 'survival' ? t.gate.survivalTie : context;
}

/** At 30 players: every group winner, best first, with the three survival seats marked once they're settled. */
function SurvivalSeats({ tournament }: { tournament: Tournament }) {
  const { t, locale } = useI18n();
  const plan = survivalPlan(tournament);
  if (!plan) return null;
  const nameOf = nameLookup(tournament);
  const { records } = groupStageOutcome(tournament);
  const groupOf = new Map(groupSeries(tournament).flatMap((series) => series.playerIds.map((playerId) => [playerId, series] as const)));
  // Before the draw, anyone ranked below the tie at the cut is certain to play; the tied players are dashed until the draw settles it.
  const tied = new Set(plan.ties.flatMap((tie) => tie.playerIds));
  const lastTied = Math.max(-1, ...plan.ranking.map((playerId, index) => (tied.has(playerId) ? index : -1)));
  return (
    <div className='flex flex-col gap-2'>
      <p className='text-sm text-fg'>{t.gate.survivalIntro}</p>
      <ol className='grid gap-1 text-sm sm:grid-cols-2'>
        {plan.ranking.map((playerId, index) => {
          const seated = plan.seats ? plan.seats.includes(playerId) : lastTied >= 0 && index > lastTied;
          const group = groupOf.get(playerId);
          return (
            <li
              key={playerId}
              className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 ${
                seated ? 'border-red/60 bg-red/10 text-red' : tied.has(playerId) ? 'border-dashed border-red/50 text-fg' : 'border-border text-fg'
              }`}
            >
              <span className='flex min-w-0 items-center gap-1.5'>
                <span className={`truncate ${seated ? 'font-semibold' : ''}`}>{nameOf(playerId)}</span>
                {group && <span className='shrink-0 text-xs text-muted'>{t.seriesName(group)}</span>}
              </span>
              <span className='shrink-0 text-xs text-muted'>{describeRecord(records.get(playerId), t, locale)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Shown once every series in the stage is finished: who goes through, the
 * host's semifinal picks (21 and 24 players) or the survival seats (30
 * players), any ties that need an on-screen draw, the semifinal draw and its
 * groups to rearrange (private until the semifinals start), and the button to move on.
 */
export function StageGate({ host, tournament }: StageGateProps) {
  const { t } = useI18n();
  const nameOf = nameLookup(tournament);
  const ties = pendingTies(tournament);
  const next = nextStage(tournament);
  const advanceLabel = next ? t.gate.advance[next] : undefined;
  const beforeSemis = tournament.stage === 'groups' || tournament.stage === 'survival';
  const plan = tournament.stage === 'groups' ? survivalPlan(tournament) : undefined;
  const selection = beforeSemis ? semifinalSelection(tournament) : undefined;
  const picksMissing = tournament.stage === 'groups' && !plan && Boolean(selection && !selection.semifinalists);
  const canDrawSemis = Boolean(selection?.semifinalists);
  const draftGroups = beforeSemis ? semifinalGroups(tournament) : undefined;
  const recentDraws = tournament.tieDraws.slice(-4).reverse();

  let summary: string | undefined;
  if (beforeSemis) {
    const through = selection?.semifinalists ? t.gate.throughSemis(selection.semifinalists.map(nameOf).join(', ')) : undefined;
    const knockedOut = selection?.dropped[0];
    summary =
      tournament.stage === 'survival' && knockedOut
        ? `${t.gate.survivalOut(nameOf(knockedOut))} ${through ?? ''}`
        : (through ?? t.gate.groupWinners(groupStageOutcome(tournament).winners.map(nameOf).join(', ')));
  } else if (tournament.stage === 'semis') {
    summary = t.gate.finalists(
      playableSeries(tournament)
        .map((series) => nameOf(seriesWinner(series) ?? ''))
        .join(', ')
    );
  } else if (tournament.stage === 'final') {
    const standings = finalStandings(tournament);
    summary = standings
      ? [
          t.gate.championWins(nameOf(standings[0].playerId)),
          ...standings.slice(1).map(({ playerId, place }) => `${t.common.podium[place - 1]}: ${nameOf(playerId)}.`),
        ].join(' ')
      : undefined;
  }

  return (
    <div className='flex flex-col gap-4 rounded-lg border border-gold/50 bg-surface p-4'>
      <h3 className='font-semibold text-gold'>{t.gate.complete}</h3>
      {summary && <p className='text-sm text-fg'>{summary}</p>}

      {tournament.stage === 'groups' && selection && <SemifinalPicker host={host} tournament={tournament} selection={selection} />}
      {plan && <SurvivalSeats tournament={tournament} />}

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

      {canDrawSemis && (
        <div className='flex flex-col gap-2'>
          <p className='text-sm text-fg'>{draftGroups ? t.gate.semisPrivate : t.gate.semisDrawIntro}</p>
          {draftGroups && (
            <RearrangePanel
              host={host}
              tournament={tournament}
              series={semifinalSeriesFrom(draftGroups)}
              onSwap={(firstId, secondId) => host.dispatch({ type: 'arrangeSemifinals', firstId, secondId })}
            />
          )}
          <div>
            <Button
              variant={draftGroups ? 'secondary' : 'primary'}
              onClick={() => {
                if (!draftGroups || window.confirm(t.gate.redrawSemisConfirm)) host.dispatch({ type: 'drawSemifinals' });
              }}
            >
              <Dice5 size={16} /> {draftGroups ? t.gate.redrawSemis : t.gate.drawSemis}
            </Button>
          </div>
        </div>
      )}

      {advanceLabel && (
        <div>
          <Button
            variant='primary'
            onClick={() => host.dispatch({ type: 'advance' })}
            disabled={ties.length > 0 || picksMissing || (next === 'semis' && !draftGroups)}
          >
            {advanceLabel} <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
