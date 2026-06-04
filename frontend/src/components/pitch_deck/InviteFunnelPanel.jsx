import { useState, useEffect } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import api from '../../lib/api';

/**
 * Painel de funil com KPIs + barras mensais.
 */
export default function InviteFunnelPanel({ isDark }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get('/pitch-deck/invites/stats/funnel')
      .then((r) => mounted && setData(r.data))
      .catch(() => mounted && setData(null))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const cardCls = isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900';
  const subtxt = isDark ? 'text-slate-400' : 'text-slate-500';

  if (loading) {
    return (
      <div className={`rounded-2xl border p-6 flex items-center justify-center ${cardCls}`}>
        <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`rounded-2xl border p-6 text-sm ${cardCls} ${subtxt}`}>
        Sem dados de funil.
      </div>
    );
  }

  const kpis = [
    { label: 'Total', value: data.total, color: 'text-slate-700 dark:text-slate-200' },
    { label: 'Pendentes', value: data.pending, color: 'text-slate-600' },
    { label: 'Submetidos', value: data.submitted, color: 'text-blue-600' },
    { label: 'Em revisão', value: data.in_review, color: 'text-amber-600' },
    { label: 'Convertidos', value: data.converted, color: 'text-emerald-600' },
    { label: 'Pagos', value: data.converted_paid ?? 0, color: 'text-emerald-700' },
    { label: 'SLA estourado', value: data.sla_breached ?? 0, color: 'text-red-500' },
  ];

  const months = Array.isArray(data.by_month) ? data.by_month : [];
  const max = Math.max(1, ...months.map((m) => Math.max(m.created || 0, m.submitted || 0, m.converted || 0)));

  return (
    <div className={`rounded-2xl border p-5 ${cardCls}`}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-purple-500" />
        <h3 className="font-semibold text-sm">Funil de convites</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-lg px-3 py-2 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
            <div className={`text-[10px] uppercase tracking-wider ${subtxt}`}>{k.label}</div>
            <div className={`text-lg font-bold ${k.color}`}>{k.value ?? 0}</div>
          </div>
        ))}
      </div>

      {months.length > 0 && (
        <div>
          <div className={`text-xs ${subtxt} mb-2`}>Últimos meses (criados / submetidos / convertidos)</div>
          <div className="flex items-end gap-2 h-32 overflow-x-auto pb-2">
            {months.map((m) => (
              <div key={m.month} className="flex flex-col items-center gap-1 min-w-[44px]">
                <div className="flex items-end gap-0.5 h-24">
                  <Bar value={m.created} max={max} cls="bg-slate-400" />
                  <Bar value={m.submitted} max={max} cls="bg-blue-500" />
                  <Bar value={m.converted} max={max} cls="bg-emerald-500" />
                </div>
                <div className={`text-[10px] ${subtxt}`}>{m.month}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Bar({ value, max, cls }) {
  const h = Math.max(2, Math.round(((value || 0) / max) * 96));
  return <div className={`w-2 rounded-t ${cls}`} style={{ height: `${h}px` }} title={String(value || 0)} />;
}
