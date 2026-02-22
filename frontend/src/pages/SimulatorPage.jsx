import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function SimulatorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
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

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Carregando...</div>;
  if (!analysis) return null;

  const activeResult = simResult?.result || analysis.valuation_result || {};
  const projections = activeResult.fcf_projections || [];
  const chartData = projections.map((p) => ({
    name: `Ano ${p.year}`,
    fcl: p.fcf,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => navigate(`/analise/${id}`)} className="text-slate-400 hover:text-navy-900 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-navy-900">Simulador — {analysis.company_name}</h1>
            <p className="text-xs text-slate-400">Ajuste parâmetros e recalcule em tempo real</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sticky top-24">
              <h3 className="font-semibold text-navy-900 mb-6">Parâmetros</h3>

              <div className="space-y-5">
                <div>
                  <label className="flex items-center justify-between text-sm text-slate-600 mb-2">
                    <span>Crescimento (%)</span>
                    <span className="font-semibold text-navy-900">{params.growth_rate}%</span>
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="50"
                    step="1"
                    value={params.growth_rate}
                    onChange={(e) => setParams({ ...params, growth_rate: e.target.value })}
                    className="w-full accent-brand-600"
                  />
                </div>

                <div>
                  <label className="flex items-center justify-between text-sm text-slate-600 mb-2">
                    <span>Margem Líquida (%)</span>
                    <span className="font-semibold text-navy-900">{params.net_margin}%</span>
                  </label>
                  <input
                    type="range"
                    min="-5"
                    max="40"
                    step="0.5"
                    value={params.net_margin}
                    onChange={(e) => setParams({ ...params, net_margin: e.target.value })}
                    className="w-full accent-brand-600"
                  />
                </div>

                <div>
                  <label className="flex items-center justify-between text-sm text-slate-600 mb-2">
                    <span>Dependência Fundador (%)</span>
                    <span className="font-semibold text-navy-900">{params.founder_dependency}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={params.founder_dependency}
                    onChange={(e) => setParams({ ...params, founder_dependency: e.target.value })}
                    className="w-full accent-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-2">Taxa de desconto customizada (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={params.discount_rate}
                    onChange={(e) => setParams({ ...params, discount_rate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                    placeholder="Automático (WACC)"
                  />
                </div>
              </div>

              <button
                onClick={simulate}
                disabled={simulating}
                className="w-full mt-6 bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
                {simulating ? 'Simulando...' : 'Recalcular'}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Value */}
            <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-8 text-center">
              <p className="text-slate-400 text-sm mb-1">Equity Value (simulado)</p>
              <h2 className="text-4xl font-extrabold text-white">
                {formatBRL(simResult?.equity_value || analysis.equity_value)}
              </h2>
              {simResult && (
                <p className="text-xs text-slate-400 mt-2">
                  Base: {formatBRL(analysis.equity_value)} • Diferença: {formatBRL((simResult.equity_value || 0) - (analysis.equity_value || 0))}
                </p>
              )}
            </div>

            {/* Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="font-semibold text-navy-900 mb-4">Projeção FCL</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} />
                  <Tooltip formatter={(v) => formatBRL(v)} />
                  <Bar dataKey="fcl" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">WACC</p>
                <p className="text-xl font-bold text-navy-900">{((activeResult.wacc || 0) * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Enterprise Value</p>
                <p className="text-xl font-bold text-navy-900">{formatBRL(activeResult.enterprise_value)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Score de Risco</p>
                <p className="text-xl font-bold text-navy-900">{(activeResult.risk_score || 0).toFixed(1)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Maturidade</p>
                <p className="text-xl font-bold text-navy-900">{(activeResult.maturity_index || 0).toFixed(1)}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
