import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../lib/api';

/**
 * Detects outliers in user-entered margin / growth vs sector benchmark.
 * Renders a non-blocking yellow warning when value deviates significantly.
 */
export default function OutlierAlert({ sector, margin, growth, isDark }) {
  const [bench, setBench] = useState(null);

  useEffect(() => {
    if (!sector) { setBench(null); return; }
    let cancelled = false;
    api.get(`/benchmarks/internal/${encodeURIComponent(sector)}`)
      .then(({ data }) => { if (!cancelled && data?.available) setBench(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sector]);

  if (!bench || !bench.available) return null;

  const warnings = [];
  const m = parseFloat(margin);
  const g = parseFloat(growth);
  if (!isNaN(m) && bench.avg_margin > 0) {
    const ratio = m / (bench.avg_margin * 100);
    if (ratio > 3) warnings.push(`Net margin entered (${m.toFixed(1)}%) is more than 3× the sector average (${(bench.avg_margin * 100).toFixed(1)}%). Verify it is in the correct proportion.`);
    else if (ratio < 0.2 && m > 0) warnings.push(`Net margin entered (${m.toFixed(1)}%) is less than 20% of the sector average (${(bench.avg_margin * 100).toFixed(1)}%). May be underestimated.`);
  }
  if (!isNaN(g) && bench.avg_growth > 0) {
    if (g > 100) warnings.push(`Growth rate entered (${g.toFixed(0)}%) is extremely high. Consider using a 3-year average.`);
    else if (g > bench.avg_growth * 100 * 5) warnings.push(`Growth rate entered (${g.toFixed(1)}%) is more than 5× the sector average (${(bench.avg_growth * 100).toFixed(1)}%).`);
  }

  if (warnings.length === 0) return null;

  return (
    <div className={`rounded-xl border p-3 mt-2 ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>{w}</p>
          ))}
          <p className={`text-[10px] ${isDark ? 'text-amber-400/70' : 'text-amber-700/70'}`}>
            Benchmark: {bench.count} analyses in sector {sector}
          </p>
        </div>
      </div>
    </div>
  );
}
