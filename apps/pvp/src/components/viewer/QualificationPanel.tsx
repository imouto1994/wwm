import { Section } from '@/components/Section';
import { Seal } from '@/components/viewer/Seal';
import { useI18n } from '@/hooks/useI18n';
import { formatFor, isSupportedCount } from '@/lib/format';
import { groupStageOutcome, semifinalSelection, survivalPlan } from '@/lib/qualification';
import type { PlayerId, Tournament } from '@/types/tournament';

interface QualificationPanelProps {
  tournament: Tournament;
  nameOf: (playerId: PlayerId) => string;
}

/** Who is through to the semifinals so far, shown during the group stage and, at 30 players, the survival game. */
export function QualificationPanel({ tournament, nameOf }: QualificationPanelProps) {
  const { t } = useI18n();
  if ((tournament.stage !== 'groups' && tournament.stage !== 'survival') || !isSupportedCount(tournament.players.length)) return null;
  const format = formatFor(tournament.players.length);
  const outcome = groupStageOutcome(tournament);
  const { fillIns, dropped } = semifinalSelection(tournament);
  const plan = survivalPlan(tournament);
  const survivalSeries = tournament.series.find((series) => series.stage === 'survival');
  const seats = survivalSeries?.playerIds ?? plan?.seats;
  const rule =
    format.fillInSpots > 0
      ? t.qualification.ruleFillIn(format.groups, format.fillInSpots)
      : plan
        ? t.qualification.ruleSurvival(format.groups)
        : t.qualification.ruleAll;

  return (
    <Section title={t.qualification.title} aside={t.qualification.groupsDecided(outcome.winners.length, format.groups)} icon={<Seal text='路' />}>
      <div className='paper flex flex-col gap-4 p-4'>
        <p className='text-sm text-muted'>
          {rule} {t.qualification.seeding}
        </p>

        {outcome.winners.length > 0 && (
          <div className='flex flex-col gap-2'>
            <h3 className='text-xs font-semibold uppercase tracking-wide text-muted'>{t.qualification.groupWinners}</h3>
            <div className='flex flex-wrap gap-1.5'>
              {outcome.winners.map((playerId) => (
                <span
                  key={playerId}
                  className={`feed-item rounded-full border px-3 py-1 text-sm font-semibold ${
                    dropped.includes(playerId) ? 'border-border text-muted line-through' : 'border-green/40 bg-green/10 text-green'
                  }`}
                >
                  {nameOf(playerId)}
                </span>
              ))}
            </div>
          </div>
        )}

        {(fillIns.length > 0 || seats || (plan && plan.ties.length > 0) || dropped.length > 0) && (
          <div className='flex flex-col gap-1 text-sm'>
            {fillIns.length > 0 && (
              <p>
                {t.qualification.hostPicks(format.fillInSpots)} <span className='font-semibold text-gold'>{fillIns.map(nameOf).join(', ')}</span>
              </p>
            )}
            {plan && plan.ties.length > 0 && <p className='italic text-muted'>{t.qualification.survivalDrawPending}</p>}
            {seats && (
              <p>
                {t.qualification.survivalSeats} <span className='font-semibold text-fg'>{seats.map(nameOf).join(', ')}</span>
              </p>
            )}
            {dropped.length > 0 && (
              <p>
                {t.qualification.knockedOut} <span className='font-semibold text-red'>{dropped.map(nameOf).join(', ')}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
