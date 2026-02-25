import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GitCompareArrows, Search, X, TrendingUp, TrendingDown, Minus, Info, BarChart2, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell, CartesianGrid } from 'recharts';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';

const fmt = (v) =>
  v != null
    ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : '—';

const pct = (v) => (v != null ? `${Number(v).toFixed(1)}%` : '—');

const ROWS = [
  { key: 'equity_value', label: 'Valor Patrimonial', format: fmt },
  { key: 'sector', label: 'Setor', format: (v) => v || '—' },
  { key: 'risk_level', label: 'Nível de Risco', format: (v) => v || '—' },
  { key: 'revenue', label: 'Receita Anual', format: fmt },
  { key: 'net_profit', label: 'Lucro Líquido', format: fmt },
  { key: 'ebitda', label: 'EBITDA', format: fmt },
  { key: 'total_assets', label: 'Ativo Total', format: fmt },
  { key: 'total_liabilities', label: 'Passivo Total', format: fmt },
  { key: 'num_employees', label: 'Funcionários', format: (v) => v ?? '—' },
  { key: 'years_in_business', label: 'Anos de Operação', format: (v) => v ?? '—' },
  { key: 'dcf_value', label: 'Valor DCF', format: fmt },
  { key: 'multiples_value', label: 'Valor Múltiplos', format: fmt },
  { key: 'dlom_discount', label: 'Desconto DLOM', format: pct },
  { key: 'qualitative_adjustment', label: 'Ajuste Qualitativo', format: pct },
];

// Tooltip component
function Tooltip({ children, text, isDark }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="cursor-help"
      >
        {children}
      </span>
      {show && (
        <span className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-50 shadow-xl ${isDark ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-slate-800 text-white border border-slate-700'}`}>
          {text}
          <span className={`absolute top-full left-1/2 -translate-x-1/2 border-4 ${isDark ? 'border-t-slate-800 border-x-transparent border-b-transparent' : 'border-t-slate-800 border-x-transparent border-b-transparent'}`} />
        </span>
      )}
    </span>
  );
}

export default function ComparePage() {
  usePageTitle('Comparar Análises');
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/analyses/', { params: { page_size: 200, status: 'completed' } });
        setAnalyses(res.data.items || res.data || []);
      } catch {
        toast.error('Erro ao carregar análises.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return analyses;
    const q = search.toLowerCase();
    return analyses.filter(
      (a) =>
        a.company_name?.toLowerCase().includes(q) ||
        a.sector?.toLowerCase().includes(q)
    );
  }, [analyses, search]);

  const selectedAnalyses = useMemo(
    () => selected.map((id) => analyses.find((a) => a.id === id)).filter(Boolean),
    [selected, analyses]
  );

  // ─── Radar / Bar chart data ──────────────────────────────────
  const CHART_COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b'];

  const radarData = useMemo(() => {
    if (selectedAnalyses.length < 2) return [];
    const norm = (val, max) => (max > 0 ? Math.min(100, (Number(val || 0) / max) * 100) : 0);
    const maxEq  = Math.max(...selectedAnalyses.map((a) => Number(a.equity_value || 0)));
    const maxRev = Math.max(...selectedAnalyses.map((a) => Number(a.revenue || 0)));
    const maxEb  = Math.max(...selectedAnalyses.map((a) => Number(a.ebitda  || 0)));

    const metrics = [
      { subject: 'Valor', key: (a) => norm(a.equity_value, maxEq) },
      { subject: 'Receita', key: (a) => norm(a.revenue, maxRev) },
      { subject: 'EBITDA', key: (a) => norm(a.ebitda, maxEb) },
      { subject: 'Maturidade', key: (a) => Number(a.maturity_index || 0) },
      { subject: 'Saúde', key: (a) => Math.max(0, 100 - Number(a.risk_score || 50)) },
      { subject: 'Percentil', key: (a) => Number(a.percentile || 0) },
    ];

    return metrics.map(({ subject, key }) => {
      const row = { subject };
      selectedAnalyses.forEach((a) => { row[a.id] = parseFloat(key(a).toFixed(1)); });
      return row;
    });
  }, [selectedAnalyses]);

  const barData = useMemo(() => selectedAnalyses.map((a) => ({
    name: a.company_name?.length > 16 ? a.company_name.slice(0, 14) + '…' : a.company_name,
    value: Number(a.equity_value || 0),
    id: a.id,
  })), [selectedAnalyses]);

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : (toast.error('Máximo 4 análises'), prev)
    );
  };

  const card = `rounded-2xl border p-5 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Comparar Análises</h1>
          <p className={`text-sm mt-1 ${muted}`}>Selecione até 4 análises para comparação lado a lado.</p>
        </div>
      </div>

      {/* Search & picker */}
      <div className={`${card} mb-6`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`relative flex-1`}>
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${muted}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por empresa ou setor..."
              className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
            />
          </div>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} className={`text-xs font-medium px-3 py-2 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
              Limpar ({selected.length})
            </button>
          )}
        </div>

        {loading ? (
          <p className={`text-sm text-center py-6 ${muted}`}>Carregando análises...</p>
        ) : filtered.length === 0 ? (
          <p className={`text-sm text-center py-6 ${muted}`}>Nenhuma análise concluída encontrada.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-60 overflow-y-auto pr-1">
            {filtered.map((a) => {
              const isSelected = selected.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleSelect(a.id)}
                  className={`text-left p-3 rounded-xl border text-sm transition ${
                    isSelected
                      ? isDark
                        ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
                        : 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200'
                      : isDark
                      ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{a.company_name}</p>
                  <p className={`text-xs mt-0.5 ${muted}`}>{a.sector || 'Sem setor'} · {fmt(a.equity_value)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action bar with Compare button */}
      <div className="flex items-center justify-between mb-6">
        <div className={`text-sm ${muted}`}>
          {selected.length > 0 ? `${selected.length} de 4 selecionadas` : 'Nenhuma selecionada'}
        </div>
        {selectedAnalyses.length >= 2 ? (
          <button className="px-6 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20">
            Comparar Análises ({selectedAnalyses.length})
          </button>
        ) : (
          <Tooltip text={`Selecione pelo menos ${2 - selected.length} ${selected.length === 0 || selected.length === 1 ? 'análise' : 'análises'} para comparar`} isDark={isDark}>
            <button disabled className="px-6 py-2.5 rounded-xl font-medium text-sm bg-slate-300 text-slate-500 cursor-not-allowed opacity-50" title={`Selecione pelo menos ${2 - selected.length} ${selected.length === 0 || selected.length === 1 ? 'análise' : 'análises'} para comparar`}>
              Comparar Análises
            </button>
          </Tooltip>
        )}
      </div>

      {/* Comparison Table */}
      {selectedAnalyses.length >= 2 ? (
        <>
          {/* Charts Section */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Radar Chart */}
            <div className={`${card}`}>
              <div className="flex items-center gap-2 mb-4">
                <Activity className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Perfil Comparativo</h3>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                  {selectedAnalyses.map((a, i) => (
                    <Radar
                      key={a.id}
                      name={a.company_name}
                      dataKey={a.id}
                      stroke={CHART_COLORS[i]}
                      fill={CHART_COLORS[i]}
                      fillOpacity={0.12}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(value) => <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{value}</span>}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart — Valor */}
            <div className={`${card}`}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Comparação de Valor</h3>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                    tickFormatter={(v) => v >= 1e6 ? `R$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$${(v / 1e3).toFixed(0)}K` : `R$${v}`}
                    axisLine={false} tickLine={false} width={58}
                  />
                  <RechartsTooltip
                    formatter={(v) => [Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }), 'Valor']}
                    contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`, borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={entry.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        {/* Comparison Table */}
        <div className={`${card} overflow-x-auto`}>
          <div className="flex items-center gap-2 mb-5">
            <GitCompareArrows className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Comparação</h2>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <th className={`text-left py-3 pr-4 font-medium ${muted}`}>Métrica</th>
                {selectedAnalyses.map((a) => (
                  <th key={a.id} className={`text-left py-3 px-3 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[140px]">{a.company_name}</span>
                      <button onClick={() => toggleSelect(a.id)} className={`p-0.5 rounded ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const values = selectedAnalyses.map((a) => a[row.key]);
                const numericVals = values.filter((v) => v != null && !isNaN(Number(v)));
                const max = numericVals.length > 1 ? Math.max(...numericVals.map(Number)) : null;
                const min = numericVals.length > 1 ? Math.min(...numericVals.map(Number)) : null;

                return (
                  <tr key={row.key} className={`border-b last:border-0 transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <td className={`py-3 pr-4 font-medium ${muted}`}>{row.label}</td>
                    {selectedAnalyses.map((a) => {
                      const v = a[row.key];
                      const numV = Number(v);
                      const isMax = max != null && !isNaN(numV) && numV === max && max !== min;
                      const isMin = min != null && !isNaN(numV) && numV === min && max !== min;

                      return (
                        <td key={a.id} className={`py-3 px-3 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          <span className="flex items-center gap-1.5">
                            {row.format(v)}
                            {isMax && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
                            {isMin && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      ) : selected.length === 1 ? (
        <div className={`${card} text-center py-12`}>
          <GitCompareArrows className={`w-12 h-12 mx-auto mb-3 ${muted}`} />
          <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Selecione mais uma análise</p>
          <p className={`text-sm mt-1 ${muted}`}>Pelo menos 2 análises são necessárias para a comparação.</p>
        </div>
      ) : (
        <div className={`${card} text-center py-12`}>
          <GitCompareArrows className={`w-12 h-12 mx-auto mb-3 ${muted}`} />
          <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Selecione análises acima</p>
          <p className={`text-sm mt-1 ${muted}`}>Escolha de 2 a 4 análises concluídas para comparar lado a lado.</p>
        </div>
      )}
    </div>
  );
}
