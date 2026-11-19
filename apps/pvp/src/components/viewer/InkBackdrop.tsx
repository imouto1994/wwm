import type { CSSProperties } from 'react';

// Fixed positions instead of random ones, so the scenery is the same on every render and every device.
const PETALS: { x: string; size: string; duration: string; delay: string }[] = [
  { x: '6%', size: '0.7rem', duration: '19s', delay: '-2s' },
  { x: '17%', size: '0.55rem', duration: '24s', delay: '-11s' },
  { x: '29%', size: '0.8rem', duration: '21s', delay: '-6s' },
  { x: '41%', size: '0.5rem', duration: '27s', delay: '-17s' },
  { x: '53%', size: '0.65rem', duration: '22s', delay: '-9s' },
  { x: '64%', size: '0.75rem', duration: '25s', delay: '-1s' },
  { x: '76%', size: '0.55rem', duration: '20s', delay: '-14s' },
  { x: '87%', size: '0.7rem', duration: '23s', delay: '-5s' },
  { x: '95%', size: '0.5rem', duration: '28s', delay: '-20s' },
];

const MIST: { top: string; left: string; width: string; height: string; duration: string }[] = [
  { top: '18%', left: '-10%', width: '55vw', height: '9rem', duration: '70s' },
  { top: '48%', left: '45%', width: '60vw', height: '10rem', duration: '90s' },
  { top: '72%', left: '5%', width: '50vw', height: '8rem', duration: '80s' },
];

/**
 * The scenery behind the viewer page: a pale sun, ink-wash mountains, drifting
 * mist and falling plum petals. Fixed behind the content and ignored by
 * pointers and screen readers.
 */
export function InkBackdrop() {
  return (
    <div aria-hidden='true' className='pointer-events-none fixed inset-0 -z-10 overflow-hidden'>
      <div
        className='absolute right-[8%] top-[6%] size-40 rounded-full sm:size-56'
        style={{
          background: 'radial-gradient(circle, rgb(179 54 43 / 0.16), rgb(179 54 43 / 0.06) 60%, transparent 72%)',
          animation: 'sun-float 9s ease-in-out infinite',
        }}
      />
      {MIST.map((mist) => (
        <div
          key={mist.top}
          className='mist'
          style={{ top: mist.top, left: mist.left, width: mist.width, height: mist.height, '--duration': mist.duration } as CSSProperties}
        />
      ))}
      <svg className='absolute inset-x-0 bottom-0 h-[38vh] w-full' viewBox='0 0 1200 300' preserveAspectRatio='none'>
        <defs>
          <linearGradient id='ink-fade' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0' stopColor='#2a221c' stopOpacity='1' />
            <stop offset='1' stopColor='#2a221c' stopOpacity='0.35' />
          </linearGradient>
        </defs>
        <path
          d='M0 170 C 90 120 150 150 210 105 S 330 40 400 95 S 520 160 600 110 S 740 30 820 85 S 960 150 1040 100 S 1160 70 1200 95 V300 H0 Z'
          fill='url(#ink-fade)'
          opacity='0.07'
        />
        <path
          d='M0 215 C 120 180 170 200 250 160 S 380 120 450 170 S 590 210 680 165 S 820 110 900 160 S 1060 210 1200 170 V300 H0 Z'
          fill='url(#ink-fade)'
          opacity='0.1'
        />
        <path d='M0 255 C 140 230 260 250 360 228 S 560 210 660 240 S 880 262 980 236 S 1140 225 1200 240 V300 H0 Z' fill='url(#ink-fade)' opacity='0.14' />
      </svg>
      {PETALS.map((petal) => (
        <span
          key={petal.x}
          className='petal'
          style={{ '--x': petal.x, '--size': petal.size, '--duration': petal.duration, '--delay': petal.delay } as CSSProperties}
        >
          <span />
        </span>
      ))}
    </div>
  );
}
