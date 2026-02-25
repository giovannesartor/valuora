/**
 * Skeleton loading components — substituem spinners centralizados
 * enquanto os dados são carregados.
 */

function SkeletonBase({ className = '' }) {
  return (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded ${className}`} />
  );
}

/** Card de análise no grid do dashboard */
export function SkeletonAnalysisCard({ isDark }) {
  return (
    <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <SkeletonBase className="h-5 w-2/3" />
        <SkeletonBase className="h-5 w-16 rounded-full" />
      </div>
      <SkeletonBase className="h-4 w-1/3 mb-4" />
      <div className="space-y-2">
        <SkeletonBase className="h-8 w-1/2" />
        <SkeletonBase className="h-3 w-2/3" />
      </div>
      <div className="flex gap-2 mt-5">
        <SkeletonBase className="h-3 w-16 rounded-full" />
        <SkeletonBase className="h-3 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** Card de métricas (stats) no topo do dashboard */
export function SkeletonStatCard({ isDark }) {
  return (
    <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <SkeletonBase className="h-4 w-1/2 mb-3" />
      <SkeletonBase className="h-8 w-2/3 mb-2" />
      <SkeletonBase className="h-3 w-1/3" />
    </div>
  );
}

/** Página inteira de análise (AnalysisPage) */
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

/** Lista de linhas (tabelas, histórico) */
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
