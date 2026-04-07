import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Building2,
  CreditCard,
  FileText,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    id: 'create',
    icon: Building2,
    title: 'Create analysis',
    description: "Fill in your company's financial data",
    path: '/new-analysis',
    cta: 'Start now',
  },
  {
    id: 'pay',
    icon: CreditCard,
    title: 'Choose a plan',
    description: 'Select the report that fits your needs',
    path: null,
    cta: 'View plans',
  },
  {
    id: 'report',
    icon: FileText,
    title: 'Download report',
    description: 'Get the PDF with the full analysis',
    path: null,
    cta: 'View report',
  },
  {
    id: 'compare',
    icon: BarChart3,
    title: 'Compare results',
    description: 'Compare multiple analyses and spot trends',
    path: '/compare',
    cta: 'Compare',
  },
];

export default function OnboardingSteps({
  totalAnalyses = 0,
  completedAnalyses = 0,
  reportsDownloaded = 0,
  isDark = false,
  onDismiss,
}) {
  const completed = {
    create: totalAnalyses > 0,
    pay: completedAnalyses > 0,
    report: reportsDownloaded > 0,
    compare: completedAnalyses >= 2,
  };
  const completedCount = Object.values(completed).filter(Boolean).length;
  const progress = (completedCount / STEPS.length) * 100;

  if (completedCount === STEPS.length) return null;

  return (
    <div
      className={cn(
        'rounded-2xl border p-6 mb-6',
        isDark
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-slate-200',
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Getting started
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {completedCount} of {STEPS.length} steps completed
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STEPS.map((step, idx) => {
          const isDone = completed[step.id];
          const isNext =
            !isDone && (idx === 0 || completed[STEPS[idx - 1]?.id]);
          return (
            <div
              key={step.id}
              className={cn(
                'relative rounded-xl p-4 border transition-all',
                isDone
                  ? isDark
                    ? 'bg-emerald-950/30 border-emerald-800/40'
                    : 'bg-emerald-50/50 border-emerald-200/60'
                  : isNext
                    ? isDark
                      ? 'bg-slate-800/60 border-emerald-500/40 ring-1 ring-emerald-500/20'
                      : 'bg-white border-emerald-300 ring-1 ring-emerald-500/10'
                    : isDark
                      ? 'bg-slate-800/30 border-slate-700/40 opacity-60'
                      : 'bg-slate-50/50 border-slate-200/60 opacity-60',
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Circle
                    className={cn(
                      'w-5 h-5 flex-shrink-0',
                      isNext
                        ? 'text-emerald-500'
                        : 'text-slate-300 dark:text-slate-600',
                    )}
                  />
                )}
                <span
                  className={cn(
                    'text-sm font-medium',
                    isDone
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-900 dark:text-white',
                  )}
                >
                  {step.title}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                {step.description}
              </p>
              {isNext && step.path && (
                <Link
                  to={step.path}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                >
                  {step.cta}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
