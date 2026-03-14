import { useI18n } from '../lib/i18n';

const LOCALE_LABELS = {
  en: { flag: '🇺🇸', label: 'EN' },
  es: { flag: '🇪🇸', label: 'ES' },
};

export default function LanguageSwitcher({ className = '' }) {
  const { locale, setLocale, availableLocales } = useI18n();

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {availableLocales.map((loc) => {
        const { flag, label } = LOCALE_LABELS[loc] || { flag: '🌐', label: loc.toUpperCase() };
        const isActive = locale === loc;
        return (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            className={`
              px-2 py-1 text-xs rounded-md font-medium transition-colors
              ${isActive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
            title={label}
          >
            {flag} {label}
          </button>
        );
      })}
    </div>
  );
}
