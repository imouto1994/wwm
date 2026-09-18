/**
 * Domain types for the Speedrun Loadout Randomizer.
 *
 * The whole app revolves around two flat, hand-maintained data pools
 * (see src/data/weapons.ts and src/data/skills.ts) and one derived result.
 * Keep these types minimal - each pool entry is just a name + an image, per
 * the event's requirements, so adding new martial arts / mystic skills down
 * the line is a one-line data change, never a schema change.
 */

// A single martial art (weapon) pool entry. `isDps` decides eligibility for
// the 1st randomized pick (DPS pool); the 2nd pick draws from the full pool
// (this array, unfiltered).
export interface WeaponEntry {
  id: string; // stable, unique, kebab-case - referenced directly in shareable URLs
  name: string;
  image: string; // path under /images/weapons/...; any format works (png/jpg/webp/svg)
  isDps: boolean;
}

// A single mystic skill pool entry. All mystic skills share one pool - there
// is no DPS/non-DPS split for skills, unlike weapons.
export interface SkillEntry {
  id: string;
  name: string;
  image: string; // path under /images/skills/...; any format works (png/jpg/webp/svg)
}

// The outcome of one randomization: which weapon/skill ids were drawn.
// This is the only thing persisted - into the URL, not localStorage - so a
// shared link fully describes a run (see src/lib/shareLink.ts).
export interface LoadoutResult {
  weapon1Id: string; // drawn from the DPS pool
  weapon2Id: string; // drawn from the full pool, guaranteed != weapon1Id
  skillIds: string[]; // 8 unique ids drawn from the full skills pool
}
