import { Section } from '@/components/Section';
import { useI18n } from '@/hooks/useI18n';
import { formatFor, isSupportedCount } from '@/lib/format';
import { groupStageOutcome, semifinalSelection } from '@/lib/qualification';
import type { PlayerId, Tournament } from '@/types/tournament';

interface QualificationPanelProps {
  tournament: Tournament;
  nameOf: (playerId: PlayerId) => string;
}

/** Who is through to the semifinals so far, shown during the group stage. */
export function QualificationPanel({ tournament, nameOf }: QualificationPanelProps) {
  const { t } = useI18n();
  if (tournament.stage !== 'groups' || !isSupportedCount(tournament.players.length)) return null;
  const format = formatFor(tournament.players.length);
  const outcome = groupStageOutcome(tournament);
  const { fillIns, dropped } = semifinalSelection(tournament);
  const rule =
    format.fillInSpots > 0
      ? t.qualification.ruleFillIn(format.groups, format.fillInSpots)
      : format.dropSpots > 0
        ? t.qualification.ruleDrop(format.groups, format.dropSpots)
        : t.qualification.ruleAll;

  return (
    <Section title={t.qualification.title} aside={t.qualification.groupsDecided(outcome.winners.length, format.groups)}>
      <div className='flex flex-col gap-4 rounded-lg border border-border bg-surface p-4'>
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
                  className={`rounded-md border px-2 py-1 text-sm ${
                    dropped.includes(playerId) ? 'border-border text-muted line-through' : 'border-green/40 text-green'
                  }`}
                >
                  {nameOf(playerId)}
                </span>
              ))}
            </div>
          </div>
        )}

        {(fillIns.length > 0 || dropped.length > 0) && (
          <div className='flex flex-col gap-1 text-sm'>
            {fillIns.length > 0 && (
              <p>
                {t.qualification.hostPicks(format.fillInSpots)} <span className='font-semibold text-gold'>{fillIns.map(nameOf).join(', ')}</span>
              </p>
            )}
            {dropped.length > 0 && (
              <p>
                {t.qualification.leftOut} <span className='font-semibold text-fg'>{dropped.map(nameOf).join(', ')}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
