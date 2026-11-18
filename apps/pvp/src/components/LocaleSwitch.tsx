import { useI18n } from '@/hooks/useI18n';
import { LOCALES } from '@/lib/i18n';

const LABELS = { vi: 'VI', en: 'EN' } as const;

/** Two-button language toggle shown in the page headers. */
export function LocaleSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role='group' aria-label={t.meta.language} className='flex overflow-hidden rounded-md border border-border text-xs'>
      {LOCALES.map((option) => (
        <button
          key={option}
          type='button'
          lang={option}
          aria-pressed={option === locale}
          onClick={() => setLocale(option)}
          className={`px-2 py-1 transition ${option === locale ? 'bg-gold/15 font-semibold text-gold' : 'text-muted hover:text-fg'}`}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
