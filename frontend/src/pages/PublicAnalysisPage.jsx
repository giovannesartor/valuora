import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, TrendingUp, Gauge, BarChart3, Building2, Calendar } from 'lucide-react';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';

const fmt = (v) =>
  v != null
    ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : '—';

export default function PublicAnalysisPage() {
  const { token } = useParams();
  const { isDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageTitle(data ? `${data.company_name} — Valuation` : 'Análise Compartilhada');

  useEffect(() => {
    api.get(`/analyses/public/${token}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Link inválido ou expirado.'))
      .finally(() => setLoading(false));
  }, [token]);

  const card = `rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="text-center max-w-sm">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Link inválido</h2>
          <p className={`text-sm ${muted}`}>{error}</p>
          <a href="https://quantovale.online" className="inline-block mt-6 text-sm text-emerald-500 hover:text-emerald-400 font-medium">
            Ir para Quanto Vale →
          </a>
        </div>
      </div>
    );
  }

  const result = data.valuation_result || {};

  return (
    <div className={`min-h-screen transition-colors ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`border-b sticky top-0 z-10 backdrop-blur-xl ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Quanto Vale</span>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${isDark ? 'border-slate-700 text-slate-400 bg-slate-800/50' : 'border-slate-200 text-slate-500 bg-slate-50'}`}>
            Visualização pública · somente leitura
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Company Header */}
        <div className={`${card} mb-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
              <Building2 className="w-7 h-7 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{data.company_name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className={`text-sm ${muted}`}>{data.sector}</span>
                {data.created_at && (
                  <span className={`flex items-center gap-1 text-xs ${muted}`}>
                    <Calendar className="w-3 h-3" />
                    {new Date(data.created_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className={`text-xs font-medium uppercase tracking-wide ${muted}`}>Valor Estimado</p>
              <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {fmt(data.equity_value)}
              </p>
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Score de Risco', value: `${Number(data.risk_score || 0).toFixed(1)}/100`, icon: Shield, color: 'text-red-400', bg: isDark ? 'bg-red-500/10' : 'bg-red-50' },
            { label: 'Índice de Maturidade', value: `${Number(data.maturity_index || 0).toFixed(1)}/100`, icon: Gauge, color: 'text-blue-400', bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50' },
            { label: 'Percentil', value: data.percentile ? `Top ${(100 - data.percentile).toFixed(0)}%` : '—', icon: BarChart3, color: 'text-purple-400', bg: isDark ? 'bg-purple-500/10' : 'bg-purple-50' },
          ].map((kpi) => (
            <div key={kpi.label} className={`${card}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${kpi.bg}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{kpi.value}</p>
              <p className={`text-xs mt-1 ${muted}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* AI Analysis */}
        {data.ai_analysis && (
          <div className={`${card} mb-6`}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                <span className="text-xs">✦</span>
              </div>
              <h2 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Análise QV Intelligence</h2>
            </div>
            <div className={`text-sm leading-relaxed whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {data.ai_analysis.slice(0, 1200)}{data.ai_analysis.length > 1200 ? '…' : ''}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className={`${card} text-center`}>
          <p className={`text-sm ${muted} mb-3`}>Quer saber o valor real da sua empresa?</p>
          <a
            href="https://quantovale.online"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-600/20"
          >
            <TrendingUp className="w-4 h-4" />
            Criar minha análise grátis
          </a>
        </div>
      </div>
    </div>
  );
}
