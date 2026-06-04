import { useState, useMemo } from 'react';
import { Sliders, RotateCcw } from 'lucide-react';

/**
 * Interactive sensitivity sliders — recompute equity client-side with simplified Gordon DCF.
 * eq ≈ revenue * margin * (1 + g) / (wacc - g_terminal)
 */
export default function SensitivitySliders({ baseEquity, baseRevenue, baseMargin, baseWacc, baseGrowth, isDark }) {
  const [margin, setMargin] = useState(baseMargin || 0.15);
  const [wacc, setWacc] = useState(baseWacc || 0.15);
  const [growth, setGrowth] = useState(baseGrowth || 0.05);

  const equity = useMemo(() => {
    const gTerm = Math.min(0.03, growth * 0.5);
    if (wacc <= gTerm) return baseEquity;
    const revenue = baseRevenue || baseEquity / Math.max(0.01, baseMargin || 0.15);
    return (revenue * margin * (1 + growth)) / (wacc - gTerm);
  }, [margin, wacc, growth, baseRevenue, baseEquity, baseMargin]);

  const delta = baseEquity ? ((equity - baseEquity) / baseEquity) * 100 : 0;
  const deltaColor = delta > 5 ? 'text-emerald-500' : delta < -5 ? 'text-red-500' : isDark ? 'text-slate-400' : 'text-slate-500';

  const fmt = (v) => v >= 1_000_000_000
    ? `$ ${(v / 1_000_000_000).toFixed(2)}B`
    : v >= 1_000_000 ? `$ ${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000 ? `$ ${(v / 1_000).toFixed(0)}K` : `$ ${v.toFixed(0)}`;

  const reset = () => {
    setMargin(baseMargin || 0.15);
    setWacc(baseWacc || 0.15);
    setGrowth(baseGrowth || 0.05);
  };

  const sliderRow = (label, value, setValue, min, max, step, fmtVal) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</span>
        <span className={`text-xs font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmtVal(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => setValue(parseFloat(e.target.value))}
        className="w-full accent-emerald-500"
      />
    </div>
  );

  return (
    <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-500" />
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Interactive Simulator</h3>
        </div>
        <button onClick={reset} className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>
      <div className="space-y-4">
        {sliderRow('Net margin', margin, setMargin, 0.01, 0.50, 0.01, v => `${(v * 100).toFixed(1)}%`)}
        {sliderRow('WACC / Cost of capital', wacc, setWacc, 0.05, 0.35, 0.005, v => `${(v * 100).toFixed(2)}%`)}
        {sliderRow('Annual growth', growth, setGrowth, -0.10, 0.40, 0.01, v => `${(v * 100).toFixed(1)}%`)}
      </div>
      <div className={`mt-5 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'} flex items-baseline justify-between`}>
        <div>
          <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Estimated equity</p>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmt(equity)}</p>
        </div>
        <span className={`text-sm font-semibold ${deltaColor}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</span>
      </div>
      <p className={`mt-2 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        * Gordon DCF approximation. For official valuation, regenerate the analysis.
      </p>
    </div>
  );
}
