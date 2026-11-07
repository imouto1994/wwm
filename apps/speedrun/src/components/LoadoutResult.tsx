import { EntryCard } from '@/components/EntryCard';
import { EntryPicker } from '@/components/EntryPicker';
import { SKILLS } from '@/data/skills';
import { WEAPONS } from '@/data/weapons';
import { skillPickerOptions, weaponPickerOptions, type WeaponSlot } from '@/lib/editLoadout';
import type { LoadoutResult as LoadoutResultData } from '@/types/randomizer';
import { useState } from 'react';

interface LoadoutResultProps {
  loadout: LoadoutResultData;
  isEditMode?: boolean;
  onSetWeapon?: (slot: WeaponSlot, weaponId: string) => void;
  onSetSkill?: (currentSkillId: string, newSkillId: string) => void;
}

// Which slot the host is currently picking a replacement for. `null` means
// the picker is closed. Skills are keyed by their current id (not index)
// because display order is pool-sorted and can differ from skillIds order.
type PickerTarget = { kind: 'weapon'; slot: WeaponSlot } | { kind: 'skill'; skillId: string } | null;

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

export function LoadoutResult({ loadout, isEditMode = false, onSetWeapon, onSetSkill }: LoadoutResultProps) {
  const [picker, setPicker] = useState<PickerTarget>(null);

  const weapon1 = WEAPONS.find((weapon) => weapon.id === loadout.weapon1Id);
  const weapon2 = WEAPONS.find((weapon) => weapon.id === loadout.weapon2Id);

  // Display skills in their original pool order (not the shuffled draw
  // order) so the grid reads consistently every time - the randomness is in
  // *which* 8 are picked, not in how they're laid out on screen.
  const skillIdSet = new Set(loadout.skillIds);
  const resolvedSkills = SKILLS.filter((skill) => skillIdSet.has(skill.id));
  const missingSkillCount = loadout.skillIds.length - resolvedSkills.length;

  const weaponOptions =
    picker?.kind === 'weapon' ? weaponPickerOptions(loadout, picker.slot, WEAPONS) : [];
  const skillOptions =
    picker?.kind === 'skill' ? skillPickerOptions(loadout, picker.skillId, SKILLS) : [];

  return (
    <div className='flex flex-col gap-6'>
      <section>
        <h2 className='mb-2 text-sm font-semibold uppercase tracking-wide text-muted'>Martial Arts</h2>
        <div className='grid max-w-sm grid-cols-2 gap-3'>
          {/* Both slots draw from the same full pool (see randomize.ts) and
              are displayed identically - isDps is not surfaced in the UI. */}
          {weapon1 ? (
            <EntryCard
              name={weapon1.name}
              image={weapon1.image}
              editable={isEditMode}
              onClick={isEditMode ? () => setPicker({ kind: 'weapon', slot: 1 }) : undefined}
            />
          ) : (
            <MissingEntry />
          )}
          {weapon2 ? (
            <EntryCard
              name={weapon2.name}
              image={weapon2.image}
              editable={isEditMode}
              onClick={isEditMode ? () => setPicker({ kind: 'weapon', slot: 2 }) : undefined}
            />
          ) : (
            <MissingEntry />
          )}
        </div>
      </section>

      <section>
        <h2 className='mb-2 text-sm font-semibold uppercase tracking-wide text-muted'>Mystic Skills</h2>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8'>
          {resolvedSkills.map((skill) => (
            <EntryCard
              key={skill.id}
              name={skill.name}
              image={skill.image}
              editable={isEditMode}
              onClick={isEditMode ? () => setPicker({ kind: 'skill', skillId: skill.id }) : undefined}
            />
          ))}
          {Array.from({ length: missingSkillCount }).map((_, index) => (
            <MissingEntry key={`missing-skill-${index}`} />
          ))}
        </div>
      </section>

      {picker?.kind === 'weapon' && (
        <EntryPicker
          title={picker.slot === 1 ? 'Choose martial art 1' : 'Choose martial art 2'}
          options={weaponOptions}
          selectedId={picker.slot === 1 ? loadout.weapon1Id : loadout.weapon2Id}
          onSelect={(id) => {
            onSetWeapon?.(picker.slot, id);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}

      {picker?.kind === 'skill' && (
        <EntryPicker
          title='Choose mystic skill'
          options={skillOptions}
          selectedId={picker.skillId}
          onSelect={(id) => {
            onSetSkill?.(picker.skillId, id);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
