import { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Users, DollarSign, BarChart3, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';

export default function PartnerHealthPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const { data } = await api.get('/partner/health');
        setHealth(data);
      } catch {
        toast.error('Failed to load health metrics');
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const metrics = health?.metrics || {};
  const trends = health?.trends || {};

  const cards = [
    { label: 'Active Clients', value: metrics.active_clients ?? 0, icon: Users, trend: trends.clients, color: 'emerald' },
    { label: 'Revenue (30d)', value: `$${(metrics.revenue_30d ?? 0).toLocaleString()}`, icon: DollarSign, trend: trends.revenue, color: 'blue' },
    { label: 'Conversion Rate', value: `${(metrics.conversion_rate ?? 0).toFixed(1)}%`, icon: BarChart3, trend: trends.conversion, color: 'violet' },
    { label: 'Avg. Report Value', value: `$${(metrics.avg_report_value ?? 0).toLocaleString()}`, icon: Activity, trend: trends.avg_value, color: 'amber' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Activity className="w-7 h-7 text-emerald-500" />
          Business Health
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Track key performance metrics and identify growth opportunities.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <c.icon className={`w-5 h-5 text-${c.color}-500`} />
              {c.trend != null && (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${
                  c.trend >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {c.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(c.trend).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{c.value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Insights */}
      {health?.insights?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Insights & Recommendations</h2>
          <div className="space-y-3">
            {health.insights.map((insight, i) => (
              <div key={i} className={`p-4 rounded-xl border ${
                insight.type === 'positive'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                  : insight.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}>
                <h3 className="font-medium text-sm text-slate-900 dark:text-white">{insight.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{insight.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Chart placeholder */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Monthly Performance</h2>
        {health?.monthly?.length > 0 ? (
          <div className="flex items-end gap-2 h-40">
            {health.monthly.map((m, i) => {
              const max = Math.max(...health.monthly.map((d) => d.revenue), 1);
              const pct = (m.revenue / max) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-500 tabular-nums">${m.revenue}</span>
                  <div
                    className="w-full bg-emerald-500/80 rounded-t min-h-[4px]"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                  <span className="text-[9px] text-slate-400">{m.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8">No data available yet. As your clients purchase reports, monthly trends will appear here.</p>
        )}
      </div>
    </div>
  );
}
