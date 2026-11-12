import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  /** Short context shown next to the title, such as "4 of 9 finished". */
  aside?: ReactNode;
  children: ReactNode;
}

export function Section({ title, aside, children }: SectionProps) {
  return (
    <section className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2 className='text-sm font-semibold uppercase tracking-wide text-muted'>{title}</h2>
        {aside && <div className='text-xs text-muted'>{aside}</div>}
      </div>
      {children}
    </section>
  );
}
