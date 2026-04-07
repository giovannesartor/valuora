import { Lock, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * BlurredResult — Shows a blurred preview of valuation data
 * with a CTA to purchase the full report.
 * Used on unpaid analyses to tease the value and drive conversion.
 */
export default function BlurredResult({ analysisId, companyName, isDark }) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Blurred fake content behind */}
      <div className="select-none pointer-events-none filter blur-md opacity-60">
        <div className={`p-8 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
          <div className="space-y-6">
            {/* Fake equity value */}
            <div>
              <p className="text-sm text-slate-500 mb-1">Estimated equity value</p>
              <p className="text-4xl font-bold text-emerald-600">$X,XXX,XXX</p>
            </div>
            {/* Fake metrics grid */}
            <div className="grid grid-cols-3 gap-4">
              {['Risk Score', 'Maturity', 'Percentile'].map((label) => (
                <div
                  key={label}
                  className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    XX.X
                  </p>
                </div>
              ))}
            </div>
            {/* Fake chart bars */}
            <div className="flex items-end gap-2 h-32">
              {[40, 65, 80, 55, 70, 90, 60].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-emerald-500/30 rounded-t"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-white/80 to-white dark:via-slate-900/80 dark:to-slate-900">
        <div className="text-center max-w-sm px-4">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Analysis for {companyName || 'your company'} is ready!
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
            The full valuation, risk score, strategic analysis, and more are
            ready. Choose a plan to unlock your results.
          </p>
          <Link
            to={`/analysis/${analysisId}?upgrade=true`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/20"
          >
            <CreditCard className="w-4 h-4" />
            Unlock results
          </Link>
        </div>
      </div>
    </div>
  );
}
