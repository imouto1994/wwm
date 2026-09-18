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
  { id: '1', name: 'Vô Danh Kiếm', image: '/images/weapons/vdk.png', isDps: true },
  { id: '2', name: 'Vô Danh Thương', image: '/images/weapons/vdt.png', isDps: false },
  { id: '3', name: 'Cửu Kiếm', image: '/images/weapons/9k.png', isDps: true },
  { id: '4', name: 'Cửu Thương', image: '/images/weapons/9t.png', isDps: false },
  { id: '5', name: 'Dù Công', image: '/images/weapons/ducong.png', isDps: true },
  { id: '6', name: 'Quạt Công', image: '/images/weapons/quatcong.png', isDps: false },
  { id: '7', name: 'Dù Ném', image: '/images/weapons/dunem.png', isDps: true },
  { id: '8', name: 'Roi Ném', image: '/images/weapons/roinem.png', isDps: false },
  { id: '9', name: 'Song Đao Chuột', image: '/images/weapons/2daochuot.png', isDps: true },
  { id: '10', name: 'Roi Chuột', image: '/images/weapons/roichuot.png', isDps: false },
  { id: '11', name: 'Dù Heal', image: '/images/weapons/duheal.png', isDps: false },
  { id: '12', name: 'Quạt Heal', image: '/images/weapons/quatheal.png', isDps: false },
  { id: '13', name: 'Đao Tank', image: '/images/weapons/daotank.png', isDps: true },
  { id: '14', name: 'Thương Tank', image: '/images/weapons/thuongtank.png', isDps: false },
  { id: '15', name: 'Heng', image: '/images/weapons/heng.png', isDps: true },
  { id: '16', name: 'Đao Heng', image: '/images/weapons/daoheng.png', isDps: false },
  { id: '17', name: 'Quyền Roi', image: '/images/weapons/quyenroi.png', isDps: true },
  { id: '18', name: 'Roi Quyền', image: '/images/weapons/roiquyen.png', isDps: false },
  { id: '19', name: 'Quyền Tuý', image: '/images/weapons/quyentuy.png', isDps: true },
  { id: '20', name: 'Song Đao Tuý', image: '/images/weapons/2daotuy.png', isDps: false },
];
