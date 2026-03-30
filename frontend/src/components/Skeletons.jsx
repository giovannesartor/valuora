/**
 * Skeleton loading components — shimmer placeholders
 * while data is loading.
 */

function SkeletonBase({ className = '' }) {
  return (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded ${className}`} />
  );
}

/** Analysis card in dashboard grid — identical shape to real card */
export function SkeletonAnalysisCard({ isDark }) {
  const pulse = `animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`;
  return (
    <div className={`relative rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      {/* Status left border */}
      <div className={`absolute left-0 inset-y-0 w-[3px] ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
      <div className="p-6">
        {/* Header row: sector icon + badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-3.5 h-3.5 rounded ${pulse}`} />
            <div className={`h-3 w-20 rounded ${pulse}`} />
          </div>
          <div className={`h-5 w-20 rounded-full ${pulse}`} />
        </div>
        {/* Company name */}
        <div className={`h-5 w-3/4 rounded mb-1 ${pulse}`} />
        {/* Equity value */}
        <div className={`h-8 w-2/5 rounded mt-3 ${pulse}`} />
        {/* Risk score bar */}
        <div className="flex items-center gap-2 mt-2">
          <div className={`flex-1 h-1 rounded-full ${pulse}`} />
          <div className={`h-3 w-14 rounded ${pulse}`} />
        </div>
        {/* Footer */}
        <div className={`flex items-center justify-between mt-4 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className={`h-3 w-20 rounded ${pulse}`} />
          <div className="flex items-center gap-1">
            <div className={`w-7 h-7 rounded-lg ${pulse}`} />
            <div className={`w-7 h-7 rounded-lg ${pulse}`} />
            <div className={`w-4 h-4 rounded ${pulse}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Metrics (stats) card at top of dashboard */
export function SkeletonStatCard({ isDark }) {
  return (
    <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <SkeletonBase className="h-4 w-1/2 mb-3" />
      <SkeletonBase className="h-8 w-2/3 mb-2" />
      <SkeletonBase className="h-3 w-1/3" />
    </div>
  );
}

/** Full analysis page (AnalysisPage) */
export function SkeletonAnalysisPage({ isDark }) {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <SkeletonBase className="h-10 w-48" />
        <SkeletonBase className="h-6 w-20 rounded-full" />
      </div>
      {/* Hero value card */}
      <div className={`rounded-2xl border p-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <SkeletonBase className="h-5 w-48 mb-3" />
        <SkeletonBase className="h-12 w-64 mb-2" />
        <SkeletonBase className="h-4 w-40" />
      </div>
      {/* Grid de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <SkeletonStatCard key={i} isDark={isDark} />)}
      </div>
      {/* Seção longa */}
      <div className={`rounded-2xl border p-6 space-y-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <SkeletonBase className="h-5 w-40" />
        <SkeletonBase className="h-4 w-full" />
        <SkeletonBase className="h-4 w-5/6" />
        <SkeletonBase className="h-4 w-4/6" />
        <SkeletonBase className="h-40 w-full mt-4 rounded-xl" />
      </div>
    </div>
  );
}

/** Row list (tables, history) */
export function SkeletonRows({ count = 4, isDark }) {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <div key={i} className={`flex items-center gap-4 p-4 rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <SkeletonBase className="h-5 w-5 rounded-full flex-shrink-0" />
          <SkeletonBase className="h-4 flex-1" />
          <SkeletonBase className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Chart skeleton — bar chart shape */
export function SkeletonBarChart({ isDark, bars = 6, height = 160 }) {
  const pulse = `animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`;
  return (
    <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <SkeletonBase className="h-4 w-32 mb-6" />
      <div className="flex items-end gap-2" style={{ height }}>
        {[...Array(bars)].map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t-md ${pulse}`}
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {[...Array(bars)].map((_, i) => (
          <SkeletonBase key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

/** Chart skeleton — donut/pie shape */
export function SkeletonPieChart({ isDark, size = 120 }) {
  const pulse = `animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`;
  return (
    <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <SkeletonBase className="h-4 w-40 mb-6" />
      <div className="flex items-center gap-6">
        <div className={`rounded-full ${pulse}`} style={{ width: size, height: size }} />
        <div className="flex-1 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${pulse}`} />
              <SkeletonBase className="h-3 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Radar / spider chart skeleton */
export function SkeletonRadarChart({ isDark, size = 160 }) {
  const pulse = `animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`;
  return (
    <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <SkeletonBase className="h-4 w-36 mb-6" />
      <div className="flex justify-center">
        <div
          className={`rounded-full ${pulse}`}
          style={{
            width: size,
            height: size,
            clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
          }}
        />
      </div>
      <div className="flex justify-center gap-4 mt-4">
        {[...Array(3)].map((_, i) => (
          <SkeletonBase key={i} className="h-3 w-16" />
        ))}
      </div>
    </div>
  );
}

/** Table skeleton */
export function SkeletonTable({ isDark, rows = 5, cols = 4 }) {
  const pulse = `animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`;
  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className={`flex gap-4 p-4 border-b ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50'}`}>
        {[...Array(cols)].map((_, i) => (
          <SkeletonBase key={i} className={`h-4 ${i === 0 ? 'w-1/3' : 'flex-1'}`} />
        ))}
      </div>
      {/* Rows */}
      {[...Array(rows)].map((_, r) => (
        <div key={r} className={`flex gap-4 p-4 border-b ${isDark ? 'border-slate-800/50' : 'border-slate-100/50'}`}>
          {[...Array(cols)].map((_, c) => (
            <SkeletonBase key={c} className={`h-4 ${c === 0 ? 'w-1/3' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Insights / card list skeleton */
export function SkeletonInsightCards({ isDark, count = 3 }) {
  const pulse = `animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`;
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className={`rounded-xl border p-4 flex items-start gap-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className={`w-8 h-8 rounded-lg flex-shrink-0 ${pulse}`} />
          <div className="flex-1 space-y-2">
            <SkeletonBase className="h-4 w-3/4" />
            <SkeletonBase className="h-3 w-full" />
            <SkeletonBase className="h-3 w-2/3" />
          </div>
          <div className={`w-12 h-6 rounded-full ${pulse}`} />
        </div>
      ))}
    </div>
  );
}
