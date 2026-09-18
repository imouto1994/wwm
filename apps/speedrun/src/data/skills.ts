import type { SkillEntry } from '@/types/randomizer';

/**
 * The mystic skill pool (single pool - no DPS/non-DPS split).
 *
 * To add a new mystic skill: append one entry below with a unique `id`, then
 * drop its image (any format - png/jpg/webp/svg) into public/images/skills/.
 * Keep at least 8 entries at all times - the randomizer draws 8 unique
 * skills and throws a friendly error if the pool is smaller than that.
 *
 * These are PLACEHOLDER entries (no real game names/art yet) so the app is
 * runnable and testable immediately - swap in real names and drop real
 * screenshots into public/images/skills/ whenever they're ready.
 */
export const SKILLS: SkillEntry[] = [
  { id: 'skill-flame-placeholder', name: 'Flame Palm (Placeholder)', image: '/images/skills/skill-flame-placeholder.svg' },
  { id: 'skill-frost-placeholder', name: 'Frost Needle (Placeholder)', image: '/images/skills/skill-frost-placeholder.svg' },
  { id: 'skill-thunder-placeholder', name: 'Thunder Step (Placeholder)', image: '/images/skills/skill-thunder-placeholder.svg' },
  { id: 'skill-wind-placeholder', name: 'Wind Slash (Placeholder)', image: '/images/skills/skill-wind-placeholder.svg' },
  { id: 'skill-shadow-placeholder', name: 'Shadow Veil (Placeholder)', image: '/images/skills/skill-shadow-placeholder.svg' },
  { id: 'skill-stone-placeholder', name: 'Stone Guard (Placeholder)', image: '/images/skills/skill-stone-placeholder.svg' },
  { id: 'skill-poison-placeholder', name: 'Poison Mist (Placeholder)', image: '/images/skills/skill-poison-placeholder.svg' },
  { id: 'skill-heal-placeholder', name: 'Healing Chant (Placeholder)', image: '/images/skills/skill-heal-placeholder.svg' },
  { id: 'skill-light-placeholder', name: 'Light Beam (Placeholder)', image: '/images/skills/skill-light-placeholder.svg' },
  { id: 'skill-void-placeholder', name: 'Void Pull (Placeholder)', image: '/images/skills/skill-void-placeholder.svg' },
];
