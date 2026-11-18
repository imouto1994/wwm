import { DEFAULT_LOCALE, LOCALES, type Locale, MESSAGES, type Messages, formatDecimal } from '@/lib/i18n';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'wwm-pvp-locale';

interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Messages;
  /** Locale-aware decimal, e.g. an over/under line: 2.5 → "2,5" in Vietnamese. */
  decimal: (value: number, fractionDigits?: number) => string;
}

const I18nContext = createContext<I18n | null>(null);

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return LOCALES.includes(stored as Locale) ? (stored as Locale) : DEFAULT_LOCALE;
  } catch {
    // Storage can be blocked (private mode, embedded browsers); the default is fine then.
    return DEFAULT_LOCALE;
  }
}

/** Holds the selected locale (Vietnamese unless the visitor picked English before) and keeps <html lang> and the title in sync. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered across visits, but the switch still works for this one.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = MESSAGES[locale].meta.title;
  }, [locale]);

  const value = useMemo<I18n>(
    () => ({ locale, setLocale, t: MESSAGES[locale], decimal: (amount, fractionDigits) => formatDecimal(locale, amount, fractionDigits) }),
    [locale, setLocale]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>.');
  return context;
}
