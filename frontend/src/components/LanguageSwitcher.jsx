import { Globe, Check } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { cn } from '../lib/utils';

/* ── SVG flag icons (4×3 ratio, rounded) ───────────────── */
const FlagUS = ({ className }) => (
  <svg viewBox="0 0 640 480" className={className} aria-hidden="true">
    <rect width="640" height="480" fill="#bd3d44" />
    <rect y="37" width="640" height="37" fill="#fff" />
    <rect y="111" width="640" height="37" fill="#fff" />
    <rect y="185" width="640" height="37" fill="#fff" />
    <rect y="259" width="640" height="37" fill="#fff" />
    <rect y="333" width="640" height="37" fill="#fff" />
    <rect y="407" width="640" height="37" fill="#fff" />
    <rect width="260" height="259" fill="#192f5d" />
  </svg>
);

const FlagES = ({ className }) => (
  <svg viewBox="0 0 640 480" className={className} aria-hidden="true">
    <rect width="640" height="480" fill="#c60b1e" />
    <rect y="120" width="640" height="240" fill="#ffc400" />
  </svg>
);

const FlagBR = ({ className }) => (
  <svg viewBox="0 0 640 480" className={className} aria-hidden="true">
    <rect width="640" height="480" fill="#009b3a" />
    <polygon points="320,40 600,240 320,440 40,240" fill="#fedf00" />
    <circle cx="320" cy="240" r="90" fill="#002776" />
    <path d="M230,240 Q320,190 410,240" fill="none" stroke="#fff" strokeWidth="12" />
  </svg>
);

const FLAGS = { en: FlagUS, es: FlagES, pt: FlagBR };

const LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
];

export default function LanguageSwitcher({ className = '' }) {
  const { locale, setLocale } = useI18n();
  const current = LOCALES.find((l) => l.code === locale) || LOCALES[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200',
            'dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white',
            'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
            className,
          )}
          aria-label="Change language"
          title={current.name}
        >
          <Globe className="w-4 h-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-48 p-1.5">
        <div className="px-2.5 py-1.5 mb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Language
          </p>
        </div>
        {LOCALES.map((loc) => {
          const isActive = locale === loc.code;
          const Flag = FLAGS[loc.code];
          return (
            <button
              key={loc.code}
              onClick={() => setLocale(loc.code)}
              className={cn(
                'flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              <span className="w-5 h-3.5 rounded-[2px] overflow-hidden shrink-0 ring-1 ring-black/10 dark:ring-white/10">
                <Flag className="w-full h-full" />
              </span>
              <span className="flex-1 text-left">{loc.name}</span>
              {isActive && (
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
