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
  { id: '1', name: 'Đạp Ngựa', image: '/images/skills/dapngua.png' },
  { id: '2', name: 'Tuý Quyền', image: '/images/skills/tuyquyen.png' },
  { id: '3', name: 'Thổi Lửa', image: '/images/skills/thoilua.png' },
  { id: '4', name: 'Hồi Mã Thương', image: '/images/skills/hmt.png' },
  { id: '5', name: 'Sư Tử Hống', image: '/images/skills/sutuhong.png' },
  { id: '6', name: 'Cóc', image: '/images/skills/coc.png' },
  { id: '7', name: 'Cung', image: '/images/skills/cung.png' },
  { id: '8', name: 'Như Lai', image: '/images/skills/nhulai.png' },
  { id: '9', name: 'Ngựa', image: '/images/skills/ngua.png' },
  { id: '10', name: 'Sáo', image: '/images/skills/sao.png' },
  { id: '11', name: 'Ưng Trảo', image: '/images/skills/ungtrao.png' },
  { id: '12', name: 'Tự Tại', image: '/images/skills/tutai.png' },
  { id: '13', name: 'Đá Cuống Họng', image: '/images/skills/dacuonghong.png' },
  { id: '14', name: 'Đả Cầu Bổng', image: '/images/skills/dacaubong.png' },
  { id: '15', name: 'Đầu Rồng', image: '/images/skills/daurong.png' },
  { id: '16', name: 'Giải Khống', image: '/images/skills/giaikhong.png' },
  { id: '17', name: 'Mê Tung Bộ', image: '/images/skills/metungbo.png' },
  { id: '18', name: 'Ngỗng', image: '/images/skills/ngong.png' },
  { id: '19', name: 'Chuông', image: '/images/skills/chuong.png' },
  { id: '20', name: 'Kiếm Heal', image: '/images/skills/kiemheal.png' },
  { id: '21', name: 'Điểm Huyệt', image: '/images/skills/diemhuyet.png' },
];
