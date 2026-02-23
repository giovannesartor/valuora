import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Download, Gauge, TrendingUp, Shield, BarChart3, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
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
    if (!v) return '—';
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
    return `R$ ${v.toFixed(2)}`;
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

  const chartData = projections.map((p) => ({
    name: `Ano ${p.year}`,
    receita: p.revenue,
    fcl: p.fcf,
  }));

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
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{analysis.sector?.charAt(0).toUpperCase() + analysis.sector?.slice(1)}</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero Value */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-10 mb-8 text-center">
          <p className="text-blue-100 text-sm mb-2">Valor estimado do equity</p>
          <h2 className="text-5xl font-extrabold text-white mb-4">
            {formatBRL(analysis.equity_value)}
          </h2>
          <div className="flex items-center justify-center gap-8 text-sm">
            <span className="text-red-200">▼ Conservador: {formatBRL(range.low)}</span>
            <span className="text-white font-semibold">Base: {formatBRL(range.mid)}</span>
            <span className="text-green-200">▲ Otimista: {formatBRL(range.high)}</span>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'WACC', value: `${((result.wacc || 0) * 100).toFixed(1)}%`, icon: TrendingUp },
            { label: 'Score de Risco', value: `${(analysis.risk_score || 0).toFixed(1)}/100`, icon: Shield },
            { label: 'Maturidade', value: `${(analysis.maturity_index || 0).toFixed(1)}/100`, icon: Gauge },
            { label: 'Percentil', value: `${(analysis.percentile || 0).toFixed(1)}%`, icon: BarChart3 },
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
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} />
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
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} />
                  <Tooltip formatter={(v) => formatBRL(v)} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: '12px' }} />
                  <Bar dataKey="fcl" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
