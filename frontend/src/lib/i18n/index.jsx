/**
 * Valuora i18n — lightweight internationalization system
 *
 * Usage:
 *   import { useI18n } from './lib/i18n';
 *   const { t, locale, setLocale } = useI18n();
 *   t('hero_title')  // → "Know Your Company's True Worth"
 *   t('footer_rights', { year: 2025 })  // → "© 2025 Valuora. All rights reserved."
 */
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import en from './en';
import es from './es';

const translations = { en, es };
const STORAGE_KEY = 'valuora_locale';
const DEFAULT_LOCALE = 'en';

// Detect browser language
function detectLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && translations[stored]) return stored;
    const nav = navigator.language?.toLowerCase() || '';
    if (nav.startsWith('es')) return 'es';
    return DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale);

  const setLocale = useCallback((newLocale) => {
    if (translations[newLocale]) {
      setLocaleState(newLocale);
      try { localStorage.setItem(STORAGE_KEY, newLocale); } catch {}
      document.documentElement.lang = newLocale;
    }
  }, []);

  const t = useCallback((key, params = {}) => {
    let text = translations[locale]?.[key] || translations[DEFAULT_LOCALE]?.[key] || key;
    // Replace {placeholder} patterns
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
    return text;
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t,
    availableLocales: Object.keys(translations),
  }), [locale, setLocale, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for components outside provider
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key) => translations[DEFAULT_LOCALE]?.[key] || key,
      availableLocales: Object.keys(translations),
    };
  }
  return ctx;
}

export { translations };
