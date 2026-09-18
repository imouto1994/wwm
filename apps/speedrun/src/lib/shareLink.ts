import type { LoadoutResult, SkillEntry, WeaponEntry } from '@/types/randomizer';

// Query param names for the shareable URL: ?w1=<id>&w2=<id>&s=<id1>,<id2>,...,<id8>
const WEAPON1_PARAM = 'w1';
const WEAPON2_PARAM = 'w2';
const SKILLS_PARAM = 's';
const REQUIRED_SKILL_COUNT = 8;

/**
 * Encodes a loadout result into URL query params. Pure and DOM-free - the
 * caller (useLoadout) is responsible for turning this into a full URL and
 * pushing it into the address bar via history.replaceState.
 */
export function encodeLoadout(loadout: LoadoutResult): URLSearchParams {
  const params = new URLSearchParams();
  params.set(WEAPON1_PARAM, loadout.weapon1Id);
  params.set(WEAPON2_PARAM, loadout.weapon2Id);
  params.set(SKILLS_PARAM, loadout.skillIds.join(','));
  return params;
}

/**
 * Decodes URL query params back into a LoadoutResult, strictly validating
 * against the current data pools. Returns `null` for anything that doesn't
 * fully check out - a missing param, a malformed skill list, duplicate/unknown
 * ids, or `w1 === w2` - so a stale, hand-edited, or garbage URL just falls
 * back to the empty host state instead of rendering a broken/partial result.
 */
export function decodeLoadout(params: URLSearchParams, weapons: readonly WeaponEntry[], skills: readonly SkillEntry[]): LoadoutResult | null {
  const weapon1Id = params.get(WEAPON1_PARAM);
  const weapon2Id = params.get(WEAPON2_PARAM);
  const skillsRaw = params.get(SKILLS_PARAM);
  if (!weapon1Id || !weapon2Id || !skillsRaw) return null;
  if (weapon1Id === weapon2Id) return null;

  const weaponIds = new Set(weapons.map((weapon) => weapon.id));
  if (!weaponIds.has(weapon1Id) || !weaponIds.has(weapon2Id)) return null;

  const skillIds = skillsRaw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (skillIds.length !== REQUIRED_SKILL_COUNT) return null;
  if (new Set(skillIds).size !== REQUIRED_SKILL_COUNT) return null;

  const skillIdPool = new Set(skills.map((skill) => skill.id));
  if (!skillIds.every((id) => skillIdPool.has(id))) return null;

  return { weapon1Id, weapon2Id, skillIds };
}

/**
 * Builds the full, absolute, pasteable share URL for a loadout. Takes
 * `origin`/`pathname` as plain arguments (rather than reading `window`
 * directly) so this stays pure and unit-testable; the hook supplies
 * `window.location.origin` / `window.location.pathname`.
 */
export function buildShareUrl(loadout: LoadoutResult, origin: string, pathname: string): string {
  const params = encodeLoadout(loadout);
  return `${origin}${pathname}?${params.toString()}`;
}
