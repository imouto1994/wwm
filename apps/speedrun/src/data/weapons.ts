import type { WeaponEntry } from '@/types/randomizer';

/**
 * The martial art (weapon) pool.
 *
 * "DPS pool" (the 1st randomized weapon) is just `WEAPONS.filter((w) => w.isDps)`;
 * the "ALL pool" (the 2nd randomized weapon) is `WEAPONS` itself. There is no
 * separate array to keep in sync - a weapon's DPS-eligibility is just a flag
 * on its own entry.
 *
 * To add a new martial art: append one entry below with a unique `id`, then
 * drop its image (any format - png/jpg/webp/svg) into public/images/weapons/.
 * Never remove or repurpose an `id` that a live event's shared links might
 * still reference while the event is ongoing.
 *
 * These are PLACEHOLDER entries (no real game names/art yet) so the app is
 * runnable and testable immediately - swap in real names and drop real
 * screenshots into public/images/weapons/ whenever they're ready.
 */
export const WEAPONS: WeaponEntry[] = [
  // DPS pool
  { id: 'sword-placeholder', name: 'Longsword (Placeholder)', image: '/images/weapons/sword-placeholder.svg', isDps: true },
  { id: 'dual-blades-placeholder', name: 'Dual Blades (Placeholder)', image: '/images/weapons/dual-blades-placeholder.svg', isDps: true },
  { id: 'spear-placeholder', name: 'Spear (Placeholder)', image: '/images/weapons/spear-placeholder.svg', isDps: true },
  // Non-DPS (support/utility) weapons - still part of the ALL pool
  { id: 'shield-placeholder', name: 'Shield (Placeholder)', image: '/images/weapons/shield-placeholder.svg', isDps: false },
  { id: 'fan-placeholder', name: 'Fan (Placeholder)', image: '/images/weapons/fan-placeholder.svg', isDps: false },
  { id: 'flute-placeholder', name: 'Flute (Placeholder)', image: '/images/weapons/flute-placeholder.svg', isDps: false },
];
