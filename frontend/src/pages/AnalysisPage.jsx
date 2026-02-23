import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Gauge, TrendingUp, Shield, BarChart3, Sparkles, AlertTriangle, Info, ChevronDown, ChevronUp, Lock, Target, Users, Zap, Activity, Percent, HeartPulse, Download, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

const QUAL_DIMENSION_LABELS = {
  equipe: 'Equipe',
  mercado: 'Mercado',
  produto: 'Produto',
  tracao: 'Tração',
  operacao: 'Operação',
};

export default function AnalysisPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [showFCFTable, setShowFCFTable] = useState(false);
  const [showPnlTable, setShowPnlTable] = useState(false);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showDlomDetails, setShowDlomDetails] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { isDark } = useTheme();
  const pollingAbortRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { pollingAbortRef.current = true; };
  }, []);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/analyses/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-quantovale-${analysis?.company_name || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF baixado com sucesso!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao baixar PDF.');
    } finally {
      setDownloading(false);
    }
  };

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
      const { data: paymentData } = await api.post('/payments/', { analysis_id: id, plan });

      // Admin bypass = instant payment (status is already PAID)
      if (paymentData.status === 'paid') {
        toast.success('Pagamento confirmado! Relatório sendo gerado...');
        const { data } = await api.get(`/analyses/${id}`);
        setAnalysis(data);
      } else if (paymentData.asaas_invoice_url) {
        // Regular user: redirect to Asaas payment page
        toast.success('Redirecionando para pagamento...');
        window.open(paymentData.asaas_invoice_url, '_blank');
        // Start polling for payment confirmation
        _pollPaymentStatus(paymentData.id);
      } else {
        toast.error('Erro: URL de pagamento não disponível.');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro no pagamento.');
    } finally {
      setPaying(false);
    }
  };

  const _pollPaymentStatus = async (paymentId) => {
    pollingAbortRef.current = false;
    const maxAttempts = 60; // poll for up to 5 minutes
    for (let i = 0; i < maxAttempts; i++) {
      if (pollingAbortRef.current) return; // abort on unmount
      await new Promise(r => setTimeout(r, 5000)); // every 5 seconds
      if (pollingAbortRef.current) return;
      try {
        const { data: statusData } = await api.get(`/payments/${paymentId}/status`);
        if (statusData.status === 'paid') {
          toast.success('Pagamento confirmado! Relatório sendo gerado...');
          const { data } = await api.get(`/analyses/${id}`);
          setAnalysis(data);
          return;
        }
      } catch {
        // ignore polling errors
      }
    }
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Carregando...</div>;
  if (!analysis) return null;

  const isPaid = !!analysis.plan;

  const result = analysis.valuation_result || {};
  const projections = result.fcf_projections || [];
  const pnlProjections = result.pnl_projections || [];
  const range = result.valuation_range || {};
  const multVal = result.multiples_valuation || {};
  const sensitivity = result.sensitivity_table || {};
  const waterfall = result.waterfall || [];
  const tvInfo = result.terminal_value_gordon || result.terminal_value_info || {};
  const tvExit = result.terminal_value_exit || {};
  const tvPct = result.tv_percentage || 0;
  const dlom = result.dlom || {};
  const survival = result.survival || {};
  const qual = result.qualitative || {};
  const investRound = result.investment_round || {};
  const eqGordon = result.equity_value_gordon || 0;
  const eqExit = result.equity_value_exit_multiple || 0;
  const evGordon = result.enterprise_value_gordon || 0;
  const evExit = result.enterprise_value_exit || 0;
  const betaU = result.beta_unlevered || 0;
  const dcfWeight = result.dcf_weight || 0.6;
  const multWeight = result.multiples_weight || 0.4;

  const chartData = projections.map((p) => ({
    name: `Ano ${p.year}`,
    receita: p.revenue,
    fcl: p.fcf,
  }));

  const qualRadarData = qual.dimensions ? Object.entries(qual.dimensions).map(([key, val]) => ({
    dimension: QUAL_DIMENSION_LABELS[key] || key,
    score: val,
    fullMark: 5,
  })) : [];

  const waterfallColors = { positive: '#22c55e', negative: '#ef4444', subtotal: '#059669', total: '#8b5cf6' };

  return (
    <>
      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <button onClick={() => navigate('/dashboard')} className={`transition flex-shrink-0 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-navy-900'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className={`font-bold truncate ${isDark ? 'text-white' : 'text-navy-900'}`}>{analysis.company_name}</h1>
              <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{analysis.sector?.charAt(0).toUpperCase() + analysis.sector?.slice(1)} • {result.parameters?.projection_years || 5} anos</p>
            </div>
          </div>
          {isPaid && (
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/20"
            >
              <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{downloading ? 'Baixando...' : 'Baixar PDF'}</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* Hero Value */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 md:p-10 mb-8 text-center">
          <p className="text-emerald-100 text-sm mb-2">Valor estimado do equity (DCF + Múltiplos)</p>
          {isPaid ? (
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
              {formatBRL(analysis.equity_value)}
            </h2>
          ) : (
            <div className="relative mb-4">
              <h2 className="text-3xl md:text-5xl font-extrabold text-white blur-lg select-none" aria-hidden="true">
                {formatBRL(analysis.equity_value)}
              </h2>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-5 py-2.5 rounded-xl">
                  <Lock className="w-5 h-5 text-white" />
                  <span className="text-white font-semibold text-sm">Desbloqueie o valor exato</span>
                </div>
              </div>
            </div>
          )}
          <div className="max-w-md mx-auto mb-4">
            <div className="flex justify-between text-xs text-emerald-200 mb-1">
              <span>Conservador</span>
              <span>Base</span>
              <span>Otimista</span>
            </div>
            <div className="relative h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white z-10" />
              <div className="h-full bg-gradient-to-r from-red-400 via-green-400 to-emerald-400 rounded-full" />
            </div>
            <div className={`flex justify-between text-xs mt-1 ${!isPaid ? 'blur-sm select-none' : ''}`}>
              <span className="text-red-200">{formatBRL(range.low)}</span>
              <span className="text-white font-semibold">{formatBRL(range.mid)}</span>
              <span className="text-green-200">{formatBRL(range.high)}</span>
            </div>
            {range.spread_pct && (
              <p className="text-emerald-200 text-xs mt-1">Faixa de ±{range.spread_pct}% (ajustada por risco)</p>
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 mb-8">
          {[
            { label: 'WACC', value: `${((result.wacc || 0) * 100).toFixed(1)}%`, icon: TrendingUp, free: true },
            { label: 'Score de Risco', value: `${(analysis.risk_score || 0).toFixed(1)}/100`, icon: Shield, free: true },
            { label: 'Maturidade', value: `${(analysis.maturity_index || 0).toFixed(1)}/100`, icon: Gauge, free: false },
            { label: 'DLOM', value: dlom.dlom_pct ? `${(dlom.dlom_pct * 100).toFixed(0)}%` : '—', icon: Percent, free: false },
            { label: 'Sobrevivência', value: survival.survival_rate ? `${(survival.survival_rate * 100).toFixed(0)}%` : '—', icon: HeartPulse, free: false },
            { label: 'Qualitativo', value: qual.score !== undefined ? `${qual.score}/100` : '—', icon: Target, free: false },
          ].map((m, i) => (
            <div key={i} className={`relative border rounded-2xl p-4 md:p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <m.icon className="w-4 h-4 text-emerald-500" />
                <span className={`text-[10px] md:text-xs font-medium uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.label}</span>
              </div>
              <p className={`text-xl md:text-2xl font-bold ${!isPaid && !m.free ? 'blur-md select-none' : ''} ${isDark ? 'text-white' : 'text-navy-900'}`}>{m.value}</p>
              {!isPaid && !m.free && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center">
                  <Lock className={`w-4 h-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* DCF Gordon vs Exit Multiple vs Múltiplos */}
        {isPaid ? (
          <>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-8">
          {/* DCF Gordon */}
          <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-navy-900'}`}>DCF Gordon Growth</h3>
            </div>
            <p className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-navy-900'}`}>{formatBRL(eqGordon)}</p>
            <div className={`text-xs space-y-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <p>EV: {formatBRL(evGordon)}</p>
              <p>TV (Gordon): {formatBRL(tvInfo.terminal_value)}</p>
              <p>g perpétuo: {((tvInfo.perpetuity_growth || 0.035) * 100).toFixed(1)}%</p>
              <p>Peso: {(dcfWeight * 60).toFixed(0)}% do DCF</p>
            </div>
          </div>

          {/* DCF Exit Multiple */}
          <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-teal-500" />
              <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-navy-900'}`}>DCF Exit Multiple</h3>
            </div>
            <p className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-navy-900'}`}>{formatBRL(eqExit)}</p>
            <div className={`text-xs space-y-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <p>EV: {formatBRL(evExit)}</p>
              <p>TV (Exit): {formatBRL(tvExit.terminal_value)}</p>
              <p>Múltiplo: {(tvExit.exit_multiple || 0).toFixed(1)}× EBITDA</p>
              <p>Peso: {(dcfWeight * 40).toFixed(0)}% do DCF</p>
            </div>
          </div>

          {/* Múltiplos */}
          <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-navy-900'}`}>Múltiplos Setoriais</h3>
            </div>
            <p className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-navy-900'}`}>{formatBRL(multVal.equity_avg_multiples)}</p>
            <div className={`text-xs space-y-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <p>EV/Rev ({(multVal.multiples_used?.ev_revenue || 0).toFixed(1)}×): {formatBRL(multVal.ev_by_revenue)}</p>
              <p>EV/EBITDA ({(multVal.multiples_used?.ev_ebitda || 0).toFixed(1)}×): {formatBRL(multVal.ev_by_ebitda)}</p>
              <p>Peso: {((multWeight) * 100).toFixed(0)}% do total</p>
              <p className="text-emerald-500">Fonte: {multVal.multiples_used?.source || 'Damodaran'}</p>
            </div>
          </div>
        </div>

        {/* Triangulation summary bar */}
        <div className={`border rounded-2xl p-5 mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Equity triangulado (DCF + Múltiplos)</p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>{formatBRL(result.equity_value_dcf)}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className={`text-[10px] uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Beta (U)</p>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{betaU.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className={`text-[10px] uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Beta (L)</p>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{(result.beta_levered || 0).toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className={`text-[10px] uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>WACC</p>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{((result.wacc || 0) * 100).toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className={`text-[10px] uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Selic</p>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{((result.parameters?.selic_rate || 0) * 100).toFixed(2)}%</p>
              </div>
              <div className="text-center">
                <p className={`text-[10px] uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>TV no EV</p>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tvPct.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* DLOM + Survival + Qualitative */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-8">
          {/* DLOM */}
          <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-navy-900'}`}>DLOM</h3>
              {dlom.dlom_pct && (
                <button onClick={() => setShowDlomDetails(!showDlomDetails)} className="text-emerald-500 text-xs hover:underline">
                  {showDlomDetails ? 'Ocultar' : 'Detalhes'}
                </button>
              )}
            </div>
            <p className={`text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-navy-900'}`}>
              {dlom.dlom_pct ? `${(dlom.dlom_pct * 100).toFixed(1)}%` : '—'}
            </p>
            <p className={`text-xs mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Desconto por falta de liquidez</p>
            {showDlomDetails && dlom.dlom_pct && (
              <div className={`text-xs space-y-1 pt-3 border-t ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <p>Base: {(dlom.base_discount * 100).toFixed(0)}%</p>
                <p>Ajuste porte: {dlom.size_adjustment > 0 ? '+' : ''}{(dlom.size_adjustment * 100).toFixed(0)}%</p>
                <p>Ajuste maturidade: {dlom.maturity_adjustment > 0 ? '+' : ''}{(dlom.maturity_adjustment * 100).toFixed(0)}%</p>
                <p>Ajuste setor: {dlom.sector_adjustment > 0 ? '+' : ''}{(dlom.sector_adjustment * 100).toFixed(0)}%</p>
                <p>Liquidez: {dlom.sector_liquidity}</p>
              </div>
            )}
          </div>

          {/* Survival */}
          <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold text-sm mb-3 ${isDark ? 'text-white' : 'text-navy-900'}`}>Taxa de Sobrevivência</h3>
            <p className={`text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-navy-900'}`}>
              {survival.survival_rate ? `${(survival.survival_rate * 100).toFixed(0)}%` : '—'}
            </p>
            <p className={`text-xs mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Horizonte: {survival.horizon || '—'} • SEBRAE/IBGE
            </p>
            {survival.survival_rate && (
              <div className={`text-xs space-y-1 pt-3 border-t ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <p>Taxa base setorial: {((survival.base_rate || 0) * 100).toFixed(0)}%</p>
                <p>Bônus maturidade: +{((survival.age_bonus || 0) * 100).toFixed(0)}%</p>
                <div className="mt-2 h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500" style={{ width: `${(survival.survival_rate || 0) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Qualitative */}
          <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold text-sm mb-3 ${isDark ? 'text-white' : 'text-navy-900'}`}>Score Qualitativo</h3>
            <p className={`text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-navy-900'}`}>
              {qual.score !== undefined ? `${qual.score}` : '—'}<span className="text-lg font-normal opacity-50">/100</span>
            </p>
            <p className={`text-xs mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Ajuste: {qual.adjustment ? `${qual.adjustment > 0 ? '+' : ''}${(qual.adjustment * 100).toFixed(1)}%` : '0%'}
            </p>
            {qual.has_data && qualRadarData.length > 0 && (
              <div className="mt-1">
                <ResponsiveContainer width="100%" height={140}>
                  <RadarChart data={qualRadarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9, fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Radar name="Score" dataKey="score" stroke="#059669" fill="#059669" fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            {!qual.has_data && (
              <p className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Sem dados qualitativos informados</p>
            )}
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
                    <Cell key={idx} fill={waterfallColors[entry.type] || '#059669'} />
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
                      <stop offset="0%" stopColor="#047857" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#047857" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => formatBRL(v)} />
                  <Tooltip formatter={(v) => formatBRL(v)} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="receita" stroke="#047857" fill="url(#gradient)" strokeWidth={2} />
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
                      <Cell key={idx} fill={entry.fcl >= 0 ? '#047857' : '#ef4444'} />
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

        {/* P&L Projected Table (collapsible) */}
        {pnlProjections.length > 0 && (
          <div className={`border rounded-2xl mb-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <button
              onClick={() => setShowPnlTable(!showPnlTable)}
              className={`w-full flex items-center justify-between p-6 ${isDark ? 'text-white' : 'text-navy-900'}`}
            >
              <h3 className="font-semibold">DRE Projetada (P&L)</h3>
              {showPnlTable ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showPnlTable && (
              <div className="px-6 pb-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      {['Ano', 'Receita', 'CPV', 'Lucro Bruto', 'Mg Bruta', 'OpEx', 'EBITDA', 'Mg EBITDA', 'D&A', 'EBIT', 'Impostos', 'Lucro Líq.'].map(h => (
                        <th key={h} className={`py-2 px-2 text-left text-[10px] font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pnlProjections.map((p) => (
                      <tr key={p.year} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <td className={`py-2 px-2 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.year}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.revenue)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.cogs)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.gross_profit)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{((p.gross_margin || 0) * 100).toFixed(1)}%</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.opex)}</td>
                        <td className={`py-2 px-2 font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatBRL(p.ebitda)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{((p.ebitda_margin || 0) * 100).toFixed(1)}%</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.depreciation)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.ebit)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.taxes)}</td>
                        <td className={`py-2 px-2 font-semibold ${(p.net_income || 0) >= 0 ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>{formatBRL(p.net_income)}</td>
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
                            <td key={ci} className={`py-2 px-3 text-center ${isCenter ? 'font-bold bg-emerald-500/20 rounded' : ''} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
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

        {/* Investment Round Simulation */}
        {investRound.pre_money_valuation > 0 && (
          <div className={`border rounded-2xl p-6 md:p-8 mb-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-5">
              <Zap className="w-4 h-4 text-emerald-500" />
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>Simulação de Rodada de Investimento</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Pre-money', value: formatBRL(investRound.pre_money_valuation) },
                { label: 'Investimento', value: formatBRL(investRound.investment_amount) },
                { label: 'Post-money', value: formatBRL(investRound.post_money_valuation) },
                { label: 'Diluição', value: `${(investRound.dilution_pct || 0).toFixed(1)}%` },
              ].map((item, i) => (
                <div key={i} className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] uppercase tracking-wide font-medium mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</p>
                  <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className={`flex items-center justify-between mt-4 pt-4 border-t text-xs ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
              <span>% Fundador após rodada: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{(investRound.founder_equity_pct || 0).toFixed(1)}%</strong></span>
              <span>Preço por 1%: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{formatBRL(investRound.price_per_1pct)}</strong></span>
            </div>
          </div>
        )}

        {/* AI Analysis */}
        {analysis.ai_analysis && (
          <div className={`border rounded-2xl p-8 mb-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-emerald-500" />
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
            className={`flex-1 border rounded-2xl p-6 transition text-center ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-200 hover:shadow-md'}`}
          >
            <Gauge className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-navy-900'}`}>Simulador</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ajuste parâmetros e recalcule em tempo real</p>
          </Link>
        </div>
          </>
        ) : (
          /* ─── Locked Premium Content Preview ─── */
          <div className={`relative rounded-2xl border-2 border-dashed p-8 md:p-12 mb-8 text-center ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-300 bg-slate-50'}`}>
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Conteúdo Premium
            </h3>
            <p className={`max-w-md mx-auto mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Desbloqueie o relatório completo: DCF Gordon + Exit Multiple, DLOM, sobrevivência, análise qualitativa, DRE projetada, simulação de rodada, waterfall, tabela de sensibilidade, análise por IA e simulador.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 max-w-lg mx-auto">
              {[
                { icon: BarChart3, label: 'DCF Duplo' },
                { icon: Target, label: 'DLOM + Quali' },
                { icon: Sparkles, label: 'Análise IA' },
                { icon: Gauge, label: 'Simulador' },
              ].map((item, i) => (
                <div key={i} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ${isDark ? 'bg-slate-800/60' : 'bg-white'}`}>
                  <item.icon className="w-5 h-5 text-emerald-500" />
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.label}</span>
                </div>
              ))}
            </div>
            <a href="#payment-section" className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3.5 rounded-xl font-semibold text-sm hover:from-emerald-500 hover:to-teal-500 transition shadow-xl shadow-emerald-600/20">
              <Lock className="w-4 h-4" />
              Desbloquear relatório completo
            </a>
          </div>
        )}

        {/* Payment / Unlock */}
        {!analysis.plan && (
          <div id="payment-section" className={`border-2 rounded-2xl p-6 md:p-8 ${isDark ? 'border-emerald-500/30 bg-slate-900' : 'border-emerald-200 bg-white'}`}>
            <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-white' : 'text-navy-900'}`}>Desbloqueie o relatório completo</h3>
            <p className={`text-center mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Escolha o plano ideal para seu relatório. Cada plano gera um PDF exclusivo com conteúdo diferenciado.</p>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  plan: 'essencial', name: 'Essencial', price: 'R$499', pages: '~8 páginas',
                  desc: 'Valuation DCF completo',
                  features: ['Resumo executivo', 'DCF Gordon Growth', 'WACC detalhado', 'Score de risco e maturidade', 'Glossário e disclaimer', 'Envio por e-mail'],
                  popular: false,
                },
                {
                  plan: 'profissional', name: 'Profissional', price: 'R$899', pages: '~15 páginas',
                  desc: 'Análise completa com benchmark',
                  features: ['Tudo do Essencial', 'DCF Exit Multiple', 'Múltiplos de mercado', 'Triangulação e waterfall', 'DLOM + Sobrevivência', 'DRE projetada (P&L)', 'Projeção de FCL', 'Benchmark setorial', 'Tabela de sensibilidade'],
                  popular: false,
                },
                {
                  plan: 'estrategico', name: 'Estratégico', price: 'R$1.999', pages: '~25 páginas',
                  desc: 'Máximo nível de análise',
                  features: ['Tudo do Profissional', 'Análise estratégica por IA', 'Avaliação qualitativa radar', 'Simulação de rodada', 'Relatório mais completo do mercado'],
                  popular: true,
                },
              ].map((p) => (
                <div key={p.plan} className={`relative flex flex-col rounded-xl border-2 transition ${
                  p.popular
                    ? 'border-emerald-500 shadow-xl shadow-emerald-600/10 scale-[1.02]'
                    : isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300'
                }`}>
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold px-4 py-1 rounded-full shadow-lg whitespace-nowrap">
                      O mais completo
                    </div>
                  )}
                  <div className={`flex-1 p-6 ${p.popular ? (isDark ? 'bg-gradient-to-b from-slate-900 to-slate-950' : 'bg-gradient-to-b from-emerald-50/50 to-white') : (isDark ? 'bg-slate-900' : 'bg-white')} rounded-t-xl`}>
                    <h4 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-navy-900'}`}>{p.name}</h4>
                    <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{p.desc}</p>
                    <div className="mb-1">
                      <span className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-navy-900'}`}>{p.price}</span>
                      <span className={`text-xs ml-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ único</span>
                    </div>
                    <p className={`text-xs font-medium mb-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{p.pages}</p>
                    <ul className="space-y-2.5">
                      {p.features.map((f, j) => (
                        <li key={j} className={`flex items-start gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`p-4 rounded-b-xl ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <button
                      onClick={() => handlePayment(p.plan)}
                      disabled={paying}
                      className={`w-full py-3 rounded-xl font-semibold text-sm transition disabled:opacity-50 ${
                        p.popular
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/25'
                          : isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      {paying ? 'Processando...' : `Escolher ${p.name}`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className={`text-center text-xs mt-6 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Pagamento seguro via PIX, boleto ou cartão de crédito
            </p>
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
    </>
  );
}
