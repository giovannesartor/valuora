import { useState, useEffect, useRef } from 'react';
import { FileText, DollarSign, TrendingUp, Shield } from 'lucide-react';
import formatBRL from '../lib/formatBRL';

const fmtBRL = (v) => formatBRL(v, { abbreviate: true });

export function useCountAnimation(target, duration = 1500) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (!target) { setCount(0); return; }
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(target * eased);
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => ref.current && cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return count;
}

/** Renders a simple inline SVG polyline sparkline. */
function Sparkline({ data, color = '#10b981', isDark }) {
  if (!data || data.length < 2) return null;
  const W = 80, H = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const trend = data[data.length - 1] >= data[0];
  const lineColor = trend ? color : (isDark ? '#f87171' : '#ef4444');
  return (
    <svg width={W} height={H} className="mt-2 opacity-70" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function KpiCards({ kpis, isDark }) {
  const animTotal = useCountAnimation(kpis.total, 1000);
  const animAvg = useCountAnimation(kpis.avgValue, 1500);
  const animMax = useCountAnimation(kpis.maxValue, 1500);
  const animRisk = useCountAnimation(kpis.avgRisk, 1200);

  const sl = kpis.sparklines;

  const items = [
    { label: 'Total Analyses', value: Math.round(animTotal), icon: FileText, iconColor: 'text-emerald-500', format: (v) => v, sparkData: sl?.count },
    { label: 'Average Value', value: animAvg, icon: DollarSign, iconColor: 'text-emerald-500', format: fmtBRL, sparkData: sl?.avg_value },
    { label: 'Highest Valuation', value: animMax, icon: TrendingUp, iconColor: 'text-emerald-500', format: fmtBRL, sparkData: sl?.avg_value },
    { label: 'Average Risk', value: animRisk, icon: Shield, iconColor: 'text-amber-500', format: (v) => `${v.toFixed(1)}/100`, sparkData: null },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {items.map((kpi, i) => (
        <div key={i} className={`rounded-2xl border p-4 md:p-5 transition-colors duration-200 ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-[10px] md:text-xs font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {kpi.label}
            </span>
            <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
              <kpi.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${kpi.iconColor}`} />
            </div>
          </div>
          <p className={`text-lg md:text-2xl font-semibold truncate tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{kpi.format(kpi.value)}</p>
          {kpi.sparkData && <Sparkline data={kpi.sparkData} isDark={isDark} />}
        </div>
      ))}
    </div>
  );
}
