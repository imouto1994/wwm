import { EntryCard } from '@/components/EntryCard';
import { SKILLS } from '@/data/skills';
import { WEAPONS } from '@/data/weapons';
import type { LoadoutResult as LoadoutResultData } from '@/types/randomizer';

interface LoadoutResultProps {
  loadout: LoadoutResultData;
}

// Renders a placeholder slot for an id that no longer resolves against the
// current data pools - e.g. a shared link opened after that weapon/skill was
// renamed or removed from src/data/*.ts. Keeps the grid layout stable
// instead of silently dropping a slot.
function MissingEntry() {
  return (
    <div className='flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-surface p-2 text-center text-[11px] text-muted'>
      Unavailable
    </div>
  );
}

export function LoadoutResult({ loadout }: LoadoutResultProps) {
  const weapon1 = WEAPONS.find((weapon) => weapon.id === loadout.weapon1Id);
  const weapon2 = WEAPONS.find((weapon) => weapon.id === loadout.weapon2Id);

  // Display skills in their original pool order (not the shuffled draw
  // order) so the grid reads consistently every time - the randomness is in
  // *which* 8 are picked, not in how they're laid out on screen.
  const skillIdSet = new Set(loadout.skillIds);
  const resolvedSkills = SKILLS.filter((skill) => skillIdSet.has(skill.id));
  const missingSkillCount = loadout.skillIds.length - resolvedSkills.length;

  return (
    <div className='flex flex-col gap-6'>
      <section>
        <h2 className='mb-2 text-sm font-semibold uppercase tracking-wide text-muted'>Martial Arts</h2>
        <div className='grid max-w-sm grid-cols-2 gap-3'>
          {/* Both slots draw from the same full pool (see randomize.ts) and
              are displayed identically - isDps is not surfaced in the UI. */}
          {weapon1 ? <EntryCard name={weapon1.name} image={weapon1.image} /> : <MissingEntry />}
          {weapon2 ? <EntryCard name={weapon2.name} image={weapon2.image} /> : <MissingEntry />}
        </div>
      </section>

      <section>
        <h2 className='mb-2 text-sm font-semibold uppercase tracking-wide text-muted'>Mystic Skills</h2>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8'>
          {resolvedSkills.map((skill) => (
            <EntryCard key={skill.id} name={skill.name} image={skill.image} />
          ))}
          {Array.from({ length: missingSkillCount }).map((_, index) => (
            <MissingEntry key={`missing-skill-${index}`} />
          ))}
        </div>
      </section>
    </div>
  );
}
