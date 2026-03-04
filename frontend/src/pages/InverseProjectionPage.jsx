import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, TrendingUp, Calculator } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../lib/api';
import formatBRL from '../lib/formatBRL';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';

const fmt = (v) => formatBRL(v, { abbreviate: true });

export default function InverseProjectionPage() {
  usePageTitle('Projeção Inversa');
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [analyses, setAnalyses] = useState([]);
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [analysesLoaded, setAnalysesLoaded] = useState(false);

  const [analysisId, setAnalysisId] = useState('');
  const [targetEquity, setTargetEquity] = useState('');
  const [variable, setVariable] = useState('growth_rate');
  const [rangeMin, setRangeMin] = useState('0');
  const [rangeMax, setRangeMax] = useState('150');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const loadAnalyses = async () => {
    if (analysesLoaded) return;
    setAnalysesLoading(true);
    try {
      const { data } = await api.get('/analyses/?status=COMPLETED&limit=50');
      setAnalyses(data?.analyses || data || []);
      setAnalysesLoaded(true);
    } catch { /* ignore */ } finally {
      setAnalysesLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!analysisId) { toast.error('Selecione uma análise base.'); return; }
    if (!targetEquity || Number(targetEquity) <= 0) { toast.error('Informe um valuation alvo positivo.'); return; }

    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/analyses/inverse-projection', {
        analysis_id: analysisId,
        target_equity: Number(targetEquity),
        variable,
        range_min: Number(rangeMin) / 100,
        range_max: Number(rangeMax) / 100,
      });
      setResult(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao calcular projeção inversa.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 transition ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-400'
  }`;

  const labelCls = `block text-xs font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className={`transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h1 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Projeção Inversa</h1>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Descubra qual taxa de crescimento ou margem gera o valuation desejado
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-base font-semibold mb-5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Configurar busca
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Analysis picker */}
              <div>
                <label className={labelCls}>Análise base</label>
                <select
                  className={inputCls}
                  value={analysisId}
                  onChange={e => setAnalysisId(e.target.value)}
                  onFocus={loadAnalyses}
                  required
                >
                  <option value="">{analysesLoading ? 'Carregando...' : 'Selecione uma análise...'}</option>
                  {analyses.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.company_name} — {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(a.equity_value || 0)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target equity */}
              <div>
                <label className={labelCls}>Valuation alvo (R$)</label>
                <input
                  type="number"
                  className={inputCls}
                  value={targetEquity}
                  onChange={e => setTargetEquity(e.target.value)}
                  placeholder="Ex: 5000000"
                  required
                  min="1"
                />
              </div>

              {/* Variable */}
              <div>
                <label className={labelCls}>Variável a encontrar</label>
                <div className="flex gap-2">
                  {[
                    { value: 'growth_rate', label: 'Taxa de Crescimento' },
                    { value: 'net_margin', label: 'Margem Líquida' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVariable(opt.value)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition border ${
                        variable === opt.value
                          ? 'bg-purple-500 text-white border-purple-500'
                          : isDark
                          ? 'text-slate-400 border-slate-700 hover:border-slate-600'
                          : 'text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Mínimo (%)</label>
                  <input type="number" className={inputCls} value={rangeMin} onChange={e => setRangeMin(e.target.value)} min="-50" max="200" />
                </div>
                <div>
                  <label className={labelCls}>Máximo (%)</label>
                  <input type="number" className={inputCls} value={rangeMax} onChange={e => setRangeMax(e.target.value)} min="0" max="500" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition disabled:opacity-60"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Calculando...</>
                ) : (
                  <><Calculator className="w-4 h-4" /> Calcular</>
                )}
              </button>
            </form>
          </div>

          {/* Result */}
          {result ? (
            <div className="space-y-4">
              {/* Solution card */}
              <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <p className={`text-xs uppercase font-semibold mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Solução encontrada
                </p>
                <div className="flex items-end gap-4 mb-4">
                  <div>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{result.variable_label}</p>
                    <p className="text-4xl font-extrabold text-purple-500">{result.solution_x_pct?.toFixed(1)}%</p>
                  </div>
                  <div className="text-2xl text-slate-400">→</div>
                  <div>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Equity Value estimado</p>
                    <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmt(result.solution_equity)}</p>
                  </div>
                </div>
                <div className={`flex justify-between text-xs pt-4 border-t ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                  <span>Valor atual: <strong className={isDark ? 'text-slate-300' : 'text-slate-700'}>{fmt(result.current_equity)}</strong> (a {result.current_x_pct?.toFixed(1)}%)</span>
                  <span>Alvo: <strong className="text-purple-500">{fmt(result.target_equity)}</strong></span>
                </div>
              </div>

              {/* Curve chart */}
              {result.curve?.length > 0 && (
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <p className={`text-xs uppercase font-semibold mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Curva de Sensibilidade — {result.variable_label}
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={result.curve}>
                      <defs>
                        <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                      <XAxis dataKey="x" tickFormatter={v => `${v}%`} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                      <YAxis tickFormatter={v => fmt(v)} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                      <Tooltip
                        formatter={(v) => [fmt(v), 'Equity Value']}
                        labelFormatter={(l) => `${result.variable_label}: ${l}%`}
                        contentStyle={{ background: isDark ? '#0f172a' : '#fff', border: '1px solid', borderColor: isDark ? '#334155' : '#e2e8f0', borderRadius: 8 }}
                      />
                      {/* Target line */}
                      <ReferenceLine y={result.target_equity} stroke="#a855f7" strokeDasharray="4 4" label={{ value: 'Alvo', fill: '#a855f7', fontSize: 10 }} />
                      {/* Current line */}
                      {result.current_x_pct != null && (
                        <ReferenceLine x={result.current_x_pct} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Atual', fill: '#10b981', fontSize: 10 }} />
                      )}
                      <Area type="monotone" dataKey="equity" stroke="#a855f7" fill="url(#invGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className={`rounded-2xl border p-8 flex flex-col items-center justify-center text-center gap-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-purple-400" />
              </div>
              <div>
                <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Como funciona</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Escolha uma análise concluída, informe o valuation desejado e selecione a variável alvo.<br /><br />
                  O motor faz uma busca binária para encontrar o valor da variável que produz exatamente o equity value desejado.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
