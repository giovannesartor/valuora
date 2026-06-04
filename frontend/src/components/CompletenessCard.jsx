import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react';

export default function CompletenessCard({ analysis, isDark }) {
  const checks = [
    { label: 'Company name', ok: !!analysis.company_name },
    { label: 'Tax ID / identifier', ok: !!analysis.cnpj },
    { label: 'Company logo', ok: !!analysis.logo_path },
    { label: 'Sector selected', ok: !!analysis.sector },
    { label: 'Financial data (>3 fields)', ok: !!(analysis.extracted_data && Object.keys(analysis.extracted_data).filter(k => !k.startsWith('_') && analysis.extracted_data[k] !== null).length > 3) },
    { label: 'Qualitative assessment (5+ answers)', ok: !!(analysis.qualitative_answers && Object.keys(analysis.qualitative_answers).length >= 5) },
    { label: 'AI analysis generated', ok: !!(analysis.ai_analysis && analysis.ai_analysis.length > 50) },
    { label: 'Valuation calculated', ok: !!analysis.equity_value },
    { label: 'FCF projections', ok: !!(analysis.valuation_result && analysis.valuation_result.fcf_projections?.length > 0) },
    { label: 'Private notes', ok: !!(analysis.notes && analysis.notes.length > 0) },
  ];
  const passed = checks.filter(c => c.ok).length;
  const total = checks.length;
  const pct = Math.round((passed / total) * 100);
  const ring = pct >= 80 ? 'emerald' : pct >= 50 ? 'amber' : 'red';
  const ringClass = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-600',
    red: 'border-red-500/30 bg-red-500/5 text-red-600',
  }[ring];
  const missing = checks.filter(c => !c.ok);

  return (
    <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-5 h-5 ${ring === 'emerald' ? 'text-emerald-500' : ring === 'amber' ? 'text-amber-500' : 'text-red-500'}`} />
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Analysis Completeness</h3>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${ringClass}`}>{pct}% complete</span>
      </div>
      <div className={`h-2 rounded-full mb-4 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <div className={`h-full rounded-full transition-all duration-700 ${ring === 'emerald' ? 'bg-emerald-500' : ring === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {c.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <Circle className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            )}
            <span className={c.ok ? (isDark ? 'text-slate-300' : 'text-slate-700') : (isDark ? 'text-slate-500 line-through' : 'text-slate-400')}>{c.label}</span>
          </div>
        ))}
      </div>
      {missing.length > 0 && pct < 100 && (
        <p className={`mt-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Complete the {missing.length} pending items to improve report credibility for investors.
        </p>
      )}
    </div>
  );
}
