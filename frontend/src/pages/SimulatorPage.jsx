import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import api from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function SimulatorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const { isDark } = useTheme();
  const [params, setParams] = useState({
    growth_rate: 10,
    net_margin: 15,
    discount_rate: '',
    founder_dependency: 0,
  });

  useEffect(() => {
    api.get(`/analyses/${id}`)
      .then((res) => {
        const a = res.data;
        setAnalysis(a);
        setParams({
          growth_rate: ((a.valuation_result?.parameters?.growth_rate || 0.10) * 100).toFixed(1),
          net_margin: ((a.valuation_result?.parameters?.net_margin || 0.15) * 100).toFixed(1),
          discount_rate: '',
          founder_dependency: ((a.valuation_result?.parameters?.founder_dependency || 0) * 100).toFixed(0),
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const simulate = useCallback(async () => {
    setSimulating(true);
    try {
      const payload = {
        analysis_id: id,
        growth_rate: params.growth_rate ? parseFloat(params.growth_rate) / 100 : null,
        net_margin: params.net_margin ? parseFloat(params.net_margin) / 100 : null,
        discount_rate: params.discount_rate ? parseFloat(params.discount_rate) / 100 : null,
        founder_dependency: params.founder_dependency ? parseFloat(params.founder_dependency) / 100 : null,
      };
      const { data } = await api.post('/analyses/simulate', payload);
      setSimResult(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro na simulação.');
    } finally {
      setSimulating(false);
    }
  }, [id, params]);

  const formatBRL = (v) => {
    if (!v) return '—';
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
    return `R$ ${v.toFixed(2)}`;
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Carregando...</div>;
  if (!analysis) return null;

  const activeResult = simResult?.result || analysis.valuation_result || {};
  const projections = activeResult.fcf_projections || [];
  const chartData = projections.map((p) => ({
    name: `Ano ${p.year}`,
    fcl: p.fcf,
  }));

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/analise/${id}`)} className={`transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-navy-900'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>Simulador — {analysis.company_name}</h1>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ajuste parâmetros e recalcule em tempo real</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-1">
            <div className={`border rounded-2xl p-6 sticky top-24 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-semibold mb-6 ${isDark ? 'text-white' : 'text-navy-900'}`}>Parâmetros</h3>

              <div className="space-y-5">
                <div>
                  <label className={`flex items-center justify-between text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span>Crescimento (%)</span>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>{params.growth_rate}%</span>
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="50"
                    step="1"
                    value={params.growth_rate}
                    onChange={(e) => setParams({ ...params, growth_rate: e.target.value })}
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <label className={`flex items-center justify-between text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span>Margem Líquida (%)</span>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>{params.net_margin}%</span>
                  </label>
                  <input
                    type="range"
                    min="-5"
                    max="40"
                    step="0.5"
                    value={params.net_margin}
                    onChange={(e) => setParams({ ...params, net_margin: e.target.value })}
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <label className={`flex items-center justify-between text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span>Dependência Fundador (%)</span>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>{params.founder_dependency}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={params.founder_dependency}
                    onChange={(e) => setParams({ ...params, founder_dependency: e.target.value })}
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <label className={`block text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Taxa de desconto customizada (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={params.discount_rate}
                    onChange={(e) => setParams({ ...params, discount_rate: e.target.value })}
                    className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    placeholder="Automático (WACC)"
                  />
                </div>
              </div>

              <button
                onClick={simulate}
                disabled={simulating}
                className="w-full mt-6 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-xl font-semibold hover:from-blue-500 hover:to-cyan-500 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
              >
                <RefreshCw className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
                {simulating ? 'Simulando...' : 'Recalcular'}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-8 text-center">
              <p className="text-blue-100 text-sm mb-1">Equity Value (simulado)</p>
              <h2 className="text-4xl font-extrabold text-white">
                {formatBRL(simResult?.equity_value || analysis.equity_value)}
              </h2>
              {simResult && (
                <p className="text-xs text-blue-100 mt-2">
                  Base: {formatBRL(analysis.equity_value)} • Diferença: {formatBRL((simResult.equity_value || 0) - (analysis.equity_value || 0))}
                </p>
              )}
            </div>

            <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Projeção FCL</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} />
                  <Tooltip formatter={(v) => formatBRL(v)} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: '12px' }} />
                  <Bar dataKey="fcl" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'WACC', value: `${((activeResult.wacc || 0) * 100).toFixed(1)}%` },
                { label: 'Enterprise Value', value: formatBRL(activeResult.enterprise_value) },
                { label: 'Score de Risco', value: (activeResult.risk_score || 0).toFixed(1) },
                { label: 'Maturidade', value: (activeResult.maturity_index || 0).toFixed(1) },
              ].map((m, i) => (
                <div key={i} className={`border rounded-xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <p className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.label}</p>
                  <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
