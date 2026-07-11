import { useState, useEffect } from 'react';
import {
  HeartPulse, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronUp, Loader2, Search, ArrowRight,
  TrendingUp, TrendingDown, AlertCircle, FileText, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import formatBRL from '../lib/formatBRL';
import { usePageTitle } from '../lib/usePageTitle';
import { useI18n } from '../lib/i18n';

const STATUS_MAP = {
  pre_filled: { label: 'Pré-preenchido', color: 'bg-yellow-500', icon: Clock },
  completed: { label: 'Dados completos', color: 'bg-blue-500', icon: CheckCircle2 },
  report_sent: { label: 'Relatório enviado', color: 'bg-emerald-500', icon: FileText },
};

export default function PartnerSaudePage() {
  const { t } = useI18n();
  usePageTitle(t('ps_page_title'));
  const { isDark } = useTheme();
  const [healthData, setHealthData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [filter, setFilter] = useState('all'); // all, alerts, ok

  useEffect(() => { loadHealth(); }, []);

  const loadHealth = async () => {
    try {
      const res = await api.get('/partners/clients/health');
      setHealthData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(t('ps_load_error'));
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const filtered = healthData.filter(h => {
    const matchSearch = !search ||
      h.client_name.toLowerCase().includes(search.toLowerCase()) ||
      (h.client_company || '').toLowerCase().includes(search.toLowerCase());

    if (filter === 'alerts') return matchSearch && h.alerts.length > 0;
    if (filter === 'ok') return matchSearch && h.alerts.length === 0;
    return matchSearch;
  });

  const totalAlerts = healthData.reduce((sum, h) => sum + h.alerts.length, 0);
  const totalMissing = healthData.reduce((sum, h) => sum + h.missing_fields.length, 0);
  const healthyCount = healthData.filter(h => h.alerts.length === 0 && h.missing_fields.length === 0).length;

  const card = `rounded-2xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <HeartPulse className="w-7 h-7 inline-block mr-2 text-emerald-500" />
          Painel de Saúde
        </h1>
        <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Visão rápida de cada cliente — onde parou, o que falta, e o que fazer.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Clientes', value: healthData.length, icon: Users, color: 'text-blue-500' },
          { label: 'Alertas', value: totalAlerts, icon: AlertTriangle, color: 'text-amber-500' },
          { label: 'Campos vazios', value: totalMissing, icon: XCircle, color: 'text-red-500' },
          { label: 'Saudáveis', value: healthyCount, icon: CheckCircle2, color: 'text-emerald-500' },
        ].map(kpi => (
          <div key={kpi.label} className={`${card} p-4`}>
            <div className="flex items-center gap-2">
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'alerts', label: 'Com alertas' },
            { key: 'ok', label: 'Saudáveis' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-medium transition ${
                filter === f.key
                  ? 'bg-emerald-500 text-white'
                  : isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client health cards */}
      {filtered.length === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(client => {
            const isOpen = expanded[client.client_id];
            const status = STATUS_MAP[client.data_status] || STATUS_MAP.pre_filled;
            const StatusIcon = status.icon;
            const hasIssues = client.alerts.length > 0 || client.missing_fields.length > 0;

            return (
              <div key={client.client_id} className={`${card} overflow-hidden`}>
                {/* Header row */}
                <button
                  onClick={() => toggleExpand(client.client_id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  {/* Health indicator */}
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    hasIssues ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {client.client_name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {client.client_company || 'Sem empresa'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs">
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
                      {client.alerts.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-amber-500">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {client.alerts.length} alerta{client.alerts.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {client.missing_fields.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-500">
                          <XCircle className="w-3.5 h-3.5" />
                          {client.missing_fields.length} campo{client.missing_fields.length > 1 ? 's' : ''} vazio{client.missing_fields.length > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                        Há {client.days_since_registration} dia{client.days_since_registration !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Equity value if available */}
                  {client.equity_value && (
                    <div className="text-right hidden sm:block">
                      <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Equity</span>
                      <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        {formatBRL(client.equity_value, { abbreviate: true })}
                      </p>
                    </div>
                  )}

                  {client.risk_score != null && (
                    <div className="text-right hidden sm:block">
                      <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Risk</span>
                      <p className={`text-sm font-bold tabular-nums ${
                        client.risk_score > 7 ? 'text-red-500' : client.risk_score > 4 ? 'text-amber-500' : 'text-emerald-500'
                      }`}>
                        {client.risk_score.toFixed(1)}/10
                      </p>
                    </div>
                  )}

                  {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div className={`px-4 pb-4 space-y-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    {/* Alerts */}
                    {client.alerts.length > 0 && (
                      <div className="pt-3">
                        <h4 className={`text-xs font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                          Alertas
                        </h4>
                        <div className="space-y-1.5">
                          {client.alerts.map((alert, i) => (
                            <div key={i} className={`flex items-start gap-2 text-sm ${isDark ? 'text-amber-300/80' : 'text-amber-600'}`}>
                              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span>{alert}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing fields */}
                    {client.missing_fields.length > 0 && (
                      <div>
                        <h4 className={`text-xs font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                          Campos Faltantes
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {client.missing_fields.map((field, i) => (
                            <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                              isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
                            }`}>
                              <XCircle className="w-3 h-3" /> {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggestions */}
                    {client.suggestions.length > 0 && (
                      <div>
                        <h4 className={`text-xs font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          Sugestões
                        </h4>
                        <div className="space-y-1.5">
                          {client.suggestions.map((sug, i) => (
                            <div key={i} className={`flex items-start gap-2 text-sm ${isDark ? 'text-emerald-300/80' : 'text-emerald-600'}`}>
                              <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span>{sug}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No issues */}
                    {!hasIssues && client.suggestions.length === 0 && (
                      <div className="pt-3 flex items-center gap-2 text-sm text-emerald-500">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Cliente saudável — sem alertas ou campos faltantes</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
