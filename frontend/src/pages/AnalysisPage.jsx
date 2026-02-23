import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Gauge, TrendingUp, Shield, BarChart3, Sparkles, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import toast from 'react-hot-toast';
import api from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function AnalysisPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [showFCFTable, setShowFCFTable] = useState(false);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    api.get(`/analyses/${id}`)
      .then((res) => setAnalysis(res.data))
      .catch(() => {
        toast.error('Análise não encontrada.');
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const formatBRL = (v) => {
    if (v === null || v === undefined) return '—';
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(1)}K`;
    return `${sign}R$ ${abs.toFixed(2)}`;
  };

  const handlePayment = async (plan) => {
    setPaying(true);
    try {
      await api.post('/payments/', { analysis_id: id, plan });
      toast.success('Pagamento confirmado! Relatório sendo gerado...');
      // Refresh analysis
      const { data } = await api.get(`/analyses/${id}`);
      setAnalysis(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro no pagamento.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Carregando...</div>;
  if (!analysis) return null;

  const result = analysis.valuation_result || {};
  const projections = result.fcf_projections || [];
  const range = result.valuation_range || {};
  const multVal = result.multiples_valuation || {};
  const sensitivity = result.sensitivity_table || {};
  const waterfall = result.waterfall || [];
  const tvInfo = result.terminal_value_info || {};
  const tvPct = result.tv_percentage || 0;

  const chartData = projections.map((p) => ({
    name: `Ano ${p.year}`,
    receita: p.revenue,
    fcl: p.fcf,
  }));

  const waterfallColors = { positive: '#22c55e', negative: '#ef4444', subtotal: '#3b82f6', total: '#8b5cf6' };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className={`transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-navy-900'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>{analysis.company_name}</h1>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{analysis.sector?.charAt(0).toUpperCase() + analysis.sector?.slice(1)} • {result.parameters?.projection_years || 5} anos de projeção</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero Value */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-10 mb-8 text-center">
          <p className="text-blue-100 text-sm mb-2">Valor estimado do equity (DCF + Múltiplos)</p>
          <h2 className="text-5xl font-extrabold text-white mb-4">
            {formatBRL(analysis.equity_value)}
          </h2>
          <div className="max-w-md mx-auto mb-4">
            <div className="flex justify-between text-xs text-blue-200 mb-1">
              <span>Conservador</span>
              <span>Base</span>
              <span>Otimista</span>
            </div>
            <div className="relative h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white z-10" />
              <div className="h-full bg-gradient-to-r from-red-400 via-green-400 to-emerald-400 rounded-full" />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-red-200">{formatBRL(range.low)}</span>
              <span className="text-white font-semibold">{formatBRL(range.mid)}</span>
              <span className="text-green-200">{formatBRL(range.high)}</span>
            </div>
            {range.spread_pct && (
              <p className="text-blue-200 text-xs mt-1">Faixa de ±{range.spread_pct}% (ajustada por risco)</p>
            )}
          </div>
        </div>

        {/* TV Warning */}
        {tvPct > 75 && (
          <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              <strong>{tvPct.toFixed(0)}%</strong> do valor vem do Terminal Value. Isso indica alta dependência de crescimento futuro — avalie com cautela.
            </p>
          </div>
        )}

        {/* Engine Warnings */}
        {tvInfo.warnings && tvInfo.warnings.length > 0 && (
          <div className={`flex items-start gap-3 p-4 rounded-xl mb-6 ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              {tvInfo.warnings.map((w, i) => (
                <p key={i} className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'WACC', value: `${((result.wacc || 0) * 100).toFixed(1)}%`, icon: TrendingUp },
            { label: 'Score de Risco', value: `${(analysis.risk_score || 0).toFixed(1)}/100`, icon: Shield },
            { label: 'Maturidade', value: `${(analysis.maturity_index || 0).toFixed(1)}/100`, icon: Gauge },
            { label: 'Percentil', value: `${(analysis.percentile || 0).toFixed(1)}%`, icon: BarChart3 },
            { label: 'TV no EV', value: `${tvPct.toFixed(0)}%`, icon: Info },
          ].map((m, i) => (
            <div key={i} className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <m.icon className="w-4 h-4 text-blue-500" />
                <span className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.label}</span>
              </div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* DCF vs Múltiplos Comparison */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Método DCF</h3>
            <p className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-navy-900'}`}>{formatBRL(result.equity_value_dcf)}</p>
            <div className={`text-sm space-y-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <p>Enterprise Value: {formatBRL(result.enterprise_value)}</p>
              <p>Beta (alavancado): {(result.beta_levered || 0).toFixed(2)}</p>
              <p>WACC: {((result.wacc || 0) * 100).toFixed(1)}%</p>
              <p>Selic: {((result.parameters?.selic_rate || 0) * 100).toFixed(2)}%</p>
            </div>
          </div>

          <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Múltiplos Setoriais</h3>
            <p className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-navy-900'}`}>{formatBRL(multVal.equity_avg_multiples)}</p>
            <div className={`text-sm space-y-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <p>EV/Revenue ({multVal.ev_revenue_multiple}×): {formatBRL(multVal.equity_by_revenue)}</p>
              <p>EV/EBITDA ({multVal.ev_ebitda_multiple}×): {formatBRL(multVal.equity_by_ebitda)}</p>
              <p>EBITDA estimado: {formatBRL(multVal.ebitda_estimated)}</p>
            </div>
          </div>
        </div>

        {/* Waterfall Chart */}
        {waterfall.length > 0 && (
          <div className={`border rounded-2xl p-6 mb-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Composição do Equity Value</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={waterfall} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => formatBRL(v)} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} width={140} />
                <Tooltip formatter={(v) => formatBRL(v)} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: '12px' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {waterfall.map((entry, idx) => (
                    <Cell key={idx} fill={waterfallColors[entry.type] || '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Charts */}
        {chartData.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Projeção de Receita</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => formatBRL(v)} />
                  <Tooltip formatter={(v) => formatBRL(v)} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="receita" stroke="#2563eb" fill="url(#gradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Fluxo de Caixa Livre</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => formatBRL(v)} />
                  <Tooltip formatter={(v) => formatBRL(v)} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: '12px' }} />
                  <Bar dataKey="fcl" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fcl >= 0 ? '#2563eb' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* FCF Detail Table (collapsible) */}
        {projections.length > 0 && (
          <div className={`border rounded-2xl mb-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <button
              onClick={() => setShowFCFTable(!showFCFTable)}
              className={`w-full flex items-center justify-between p-6 ${isDark ? 'text-white' : 'text-navy-900'}`}
            >
              <h3 className="font-semibold">Tabela Detalhada de FCF Projetado</h3>
              {showFCFTable ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showFCFTable && (
              <div className="px-6 pb-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      {['Ano', 'Receita', 'Cresc.', 'EBIT', 'NOPAT', 'D&A', 'CapEx', 'ΔNWC', 'FCF'].map(h => (
                        <th key={h} className={`py-2 px-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map((p) => (
                      <tr key={p.year} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <td className={`py-2 px-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.year}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.revenue)}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{((p.growth_rate || 0) * 100).toFixed(1)}%</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.ebit)}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.nopat)}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.depreciation)}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.capex)}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.delta_nwc)}</td>
                        <td className={`py-2 px-3 font-semibold ${p.fcf >= 0 ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>{formatBRL(p.fcf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sensitivity Table (collapsible) */}
        {sensitivity.equity_matrix && (
          <div className={`border rounded-2xl mb-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <button
              onClick={() => setShowSensitivity(!showSensitivity)}
              className={`w-full flex items-center justify-between p-6 ${isDark ? 'text-white' : 'text-navy-900'}`}
            >
              <h3 className="font-semibold">Tabela de Sensibilidade (WACC × Crescimento)</h3>
              {showSensitivity ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showSensitivity && (
              <div className="px-6 pb-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={`py-2 px-3 text-left text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>WACC \ Cresc.</th>
                      {sensitivity.growth_values?.map((g, i) => (
                        <th key={i} className={`py-2 px-3 text-center text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{g}%</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivity.equity_matrix?.map((row, ri) => (
                      <tr key={ri} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <td className={`py-2 px-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{sensitivity.wacc_values?.[ri]}%</td>
                        {row.map((val, ci) => {
                          const isCenter = ri === 2 && ci === 2;
                          return (
                            <td key={ci} className={`py-2 px-3 text-center ${isCenter ? 'font-bold bg-blue-500/20 rounded' : ''} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              {formatBRL(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  O valor destacado (centro) é o cenário base. Linhas = WACC, Colunas = Taxa de crescimento.
                </p>
              </div>
            )}
          </div>
        )}

        {/* AI Analysis */}
        {analysis.ai_analysis && (
          <div className={`border rounded-2xl p-8 mb-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>Análise Estratégica IA</h3>
            </div>
            <div className={`text-sm leading-relaxed whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {analysis.ai_analysis}
            </div>
          </div>
        )}

        {/* Simulator Link */}
        <div className="flex gap-4 mb-8">
          <Link
            to={`/simulador/${id}`}
            className={`flex-1 border rounded-2xl p-6 transition text-center ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-md'}`}
          >
            <Gauge className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-navy-900'}`}>Simulador</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ajuste parâmetros e recalcule em tempo real</p>
          </Link>
        </div>

        {/* Payment / Unlock */}
        {!analysis.plan && (
          <div className={`border-2 rounded-2xl p-8 ${isDark ? 'border-blue-500/30 bg-slate-900' : 'border-blue-200 bg-white'}`}>
            <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-white' : 'text-navy-900'}`}>Desbloqueie o relatório completo</h3>
            <p className={`text-center mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Escolha um plano para receber o PDF premium por e-mail.</p>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                { plan: 'essencial', name: 'Essencial', price: 'R$499' },
                { plan: 'profissional', name: 'Profissional', price: 'R$899', popular: true },
                { plan: 'estrategico', name: 'Estratégico', price: 'R$1.999' },
              ].map((p) => (
                <button
                  key={p.plan}
                  onClick={() => handlePayment(p.plan)}
                  disabled={paying}
                  className={`p-6 rounded-xl border-2 transition text-left ${
                    p.popular
                      ? 'border-blue-500 bg-blue-500/10'
                      : isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300'
                  } disabled:opacity-50`}
                >
                  <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>{p.name}</h4>
                  <p className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-navy-900'}`}>{p.price}</p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>pagamento único</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {analysis.plan && (
          <div className={`border rounded-2xl p-6 text-center ${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
            <p className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
              Plano {analysis.plan} ativo — Relatório enviado por e-mail
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
