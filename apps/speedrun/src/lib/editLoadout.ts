import type { LoadoutResult, SkillEntry, WeaponEntry } from '@/types/randomizer';

export type WeaponSlot = 1 | 2;

/**
 * Replaces one weapon slot in a loadout. Returns `null` (and leaves the
 * loadout unchanged) if the new id is missing from the pool, or if it would
 * make the two weapon slots identical - the same "must differ" invariant the
 * randomizer enforces. Pure and framework-free so the UI can call it without
 * inventing its own validation.
 */
export function replaceWeapon(
  loadout: LoadoutResult,
  slot: WeaponSlot,
  newWeaponId: string,
  weapons: readonly WeaponEntry[]
): LoadoutResult | null {
  if (!weapons.some((weapon) => weapon.id === newWeaponId)) return null;

  const otherId = slot === 1 ? loadout.weapon2Id : loadout.weapon1Id;
  if (newWeaponId === otherId) return null;

  // No-op replace of the same id is fine - still returns a valid loadout so
  // the caller can close the picker without special-casing "picked current".
  if (slot === 1) return { ...loadout, weapon1Id: newWeaponId };
  return { ...loadout, weapon2Id: newWeaponId };
}

/**
 * Replaces one mystic skill in a loadout (matched by its current id). Returns
 * `null` if the current id isn't in the loadout, the new id isn't in the
 * pool, or the new id is already used by a *different* slot - skills must
 * stay unique. Replacing a skill with itself is a valid no-op.
 *
 * The returned `skillIds` keep the same array order as the input (only the
 * matched index is overwritten). Display order is still re-sorted to the
 * pool order by `LoadoutResult`, so the on-screen grid stays stable.
 */
export function replaceSkill(
  loadout: LoadoutResult,
  currentSkillId: string,
  newSkillId: string,
  skills: readonly SkillEntry[]
): LoadoutResult | null {
  const index = loadout.skillIds.indexOf(currentSkillId);
  if (index < 0) return null;
  if (!skills.some((skill) => skill.id === newSkillId)) return null;

  // Allow keeping the current skill; block only a collision with a *other* slot.
  if (newSkillId !== currentSkillId && loadout.skillIds.includes(newSkillId)) return null;

  const skillIds = [...loadout.skillIds];
  skillIds[index] = newSkillId;
  return { ...loadout, skillIds };
}

/**
 * Candidates for a weapon-slot picker: every weapon in the pool except the
 * *other* slot's current id (so the host can't create a duplicate pair). The
 * current slot's own weapon is included so the picker can show it as selected.
 */
export function weaponPickerOptions(
  loadout: LoadoutResult,
  slot: WeaponSlot,
  weapons: readonly WeaponEntry[]
): WeaponEntry[] {
  const otherId = slot === 1 ? loadout.weapon2Id : loadout.weapon1Id;
  return weapons.filter((weapon) => weapon.id !== otherId);
}

/**
 * Candidates for a skill-slot picker: every skill in the pool except those
 * already held by *other* slots. The current skill is included so it can
 * show as selected / be "kept" without being treated as a duplicate.
 */
export function skillPickerOptions(
  loadout: LoadoutResult,
  currentSkillId: string,
  skills: readonly SkillEntry[]
): SkillEntry[] {
  const takenByOthers = new Set(loadout.skillIds.filter((id) => id !== currentSkillId));
  return skills.filter((skill) => !takenByOthers.has(skill.id));
}
