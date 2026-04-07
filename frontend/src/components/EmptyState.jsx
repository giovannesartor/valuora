import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Search,
  FileText,
  Inbox,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

const ILLUSTRATIONS = {
  'no-analyses': {
    icon: BarChart3,
    title: 'No analyses yet',
    description:
      'Create your first valuation analysis and discover the true value of your business.',
    cta: { label: 'Create first analysis', path: '/new-analysis' },
  },
  'no-results': {
    icon: Search,
    title: 'No results found',
    description:
      'Try adjusting your filters or search terms to find what you\'re looking for.',
    cta: null,
  },
  'empty-trash': {
    icon: Inbox,
    title: 'Trash is empty',
    description:
      'Archived analyses will appear here. You can restore or permanently delete them.',
    cta: null,
  },
  'no-pitch-decks': {
    icon: FileText,
    title: 'No Pitch Decks',
    description:
      'Create a professional pitch deck from a completed analysis.',
    cta: { label: 'Create Pitch Deck', path: '/pitch-deck/new' },
  },
  'no-notifications': {
    icon: Inbox,
    title: 'No notifications',
    description:
      'Updates about your analyses and payments will appear here.',
    cta: null,
  },
  'no-comparisons': {
    icon: TrendingUp,
    title: 'Nothing to compare',
    description:
      'Select at least two completed analyses to compare their results.',
    cta: { label: 'View analyses', path: '/dashboard' },
  },
};

export default function EmptyState({
  type = 'no-analyses',
  title,
  description,
  cta,
  icon: CustomIcon,
  compact = false,
}) {
  const preset = ILLUSTRATIONS[type] || ILLUSTRATIONS['no-analyses'];
  const Icon = CustomIcon || preset.icon;
  const displayTitle = title || preset.title;
  const displayDesc = description || preset.description;
  const displayCta = cta !== undefined ? cta : preset.cta;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8' : 'py-16'
      }`}
    >
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-5">
        <Icon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1.5">
        {displayTitle}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-5">
        {displayDesc}
      </p>
      {displayCta &&
        (displayCta.onClick ? (
          <button
            onClick={displayCta.onClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            {displayCta.label}
          </button>
        ) : (
          <Link
            to={displayCta.path}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            {displayCta.label}
          </Link>
        ))}
    </div>
  );
}
