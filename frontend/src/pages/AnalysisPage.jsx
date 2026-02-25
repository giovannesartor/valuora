import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Gauge, TrendingUp, Shield, BarChart3, Sparkles, AlertTriangle, Info, ChevronDown, ChevronUp, Lock, Target, Users, Zap, Activity, Percent, HeartPulse, Download, CheckCircle, HelpCircle, ArrowRight, Layers, Calculator, Building2, Copy, Archive, Edit3, MoreVertical, Trash2, Share2, ShieldCheck, CreditCard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';

const QUAL_DIMENSION_LABELS = {
  governanca: 'Governança',
  mercado: 'Mercado',
  financeiro: 'Financeiro',
  clientes: 'Clientes',
  diferenciacao: 'Diferenciação',
  escalabilidade: 'Escalabilidade',
};

/* ─── Reusable section wrapper ─── */
function Section({ title, description, icon: Icon, children, isDark, className = '' }) {
  return (
    <section className={`mb-8 ${className}`}>
      <div className="flex items-start gap-3 mb-4">
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <Icon className="w-4 h-4 text-emerald-600" />
          </div>
        )}
        <div>
          <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
          {description && <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ─── Info tooltip ─── */
function InfoTip({ text, isDark }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <HelpCircle
        className={`w-3.5 h-3.5 cursor-help ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      />
      {show && (
        <span className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-lg text-xs leading-relaxed z-50 shadow-xl ${isDark ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'}`}>
          {text}
        </span>
      )}
    </span>
  );
}

/* ─── Analysis Notes — persisted in DB ─── */
function AnalysisNotes({ analysisId, initialNotes, isDark }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  function handleChange(e) {
    setText(e.target.value);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/analyses/${analysisId}/notes`, null, { params: { notes: text } });
      setSaved(true);
    } catch {
      // fallback: save to localStorage
      try { localStorage.setItem(`qv:notes:${analysisId}`, text); } catch {}
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setText('');
    setSaved(false);
  }

  return (
    <section className="mb-8">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-3 w-full text-left group`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Notas &amp; Comentários</h3>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {open ? 'Clique para fechar' : text ? `${text.slice(0, 60)}${text.length > 60 ? '…' : ''}` : 'Adicione anotações pessoais sobre esta análise'}
          </p>
        </div>
        <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className={`mt-4 rounded-2xl border p-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <textarea
            value={text}
            onChange={handleChange}
            rows={6}
            placeholder="Escreva suas anotações, insights ou próximos passos sobre esta análise..."
            className={`w-full rounded-xl border px-4 py-3 text-sm resize-none outline-none transition focus:ring-2 focus:ring-emerald-500/40 ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
          <div className="flex items-center justify-between mt-3">
            <span className={`text-xs ${saved ? (isDark ? 'text-slate-600' : 'text-slate-400') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>
              {saved ? 'Salvo no servidor' : 'Alterações não salvas'}
            </span>
            <div className="flex gap-2">
              {text && (
                <button
                  onClick={handleClear}
                  className={`text-xs px-3 py-1.5 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-500 hover:text-red-500 hover:bg-red-50'}`}
                >
                  Limpar
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saved || saving}
                className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition disabled:opacity-40"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


/* ─── Custom Tooltip for Recharts ─── */
function CustomTooltip({ active, payload, label, isDark }) {
  if (!active || !payload || !payload.length) return null;
  
  return (
    <div className={`p-3 rounded-xl shadow-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      {label && <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: entry.color }} />
          <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <span className="font-medium">{entry.name}:</span> {typeof entry.value === 'number' && entry.value >= 1000000 
              ? `R$ ${(entry.value / 1000000).toFixed(2)}M` 
              : typeof entry.value === 'number' && entry.value >= 1000
              ? `R$ ${(entry.value / 1000).toFixed(1)}K`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AnalysisPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  usePageTitle(analysis?.company_name || 'Análise');
  const [paying, setPaying] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [couponError, setCouponError] = useState('');
  const [showFCFTable, setShowFCFTable] = useState(false);
  const [showPnlTable, setShowPnlTable] = useState(false);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showDlomDetails, setShowDlomDetails] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [genProgress, setGenProgress] = useState(null); // { step, message, pct, done, error }
  const genEsRef = useRef(null);
  const { isDark } = useTheme();
  const pollingAbortRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingAbortRef.current = true;
      if (genEsRef.current) { clearInterval(genEsRef.current); genEsRef.current = null; }
    };
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

  const handleDuplicate = async () => {
    try {
      const { data: newAnalysis } = await api.post(`/analyses/${id}/duplicate`);
      toast.success('Análise duplicada com sucesso!');
      navigate(`/analise/${newAnalysis.id}`);
      setShowActionMenu(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao duplicar análise.');
    }
  };

  const handleArchive = async () => {
    try {
      await api.patch(`/analyses/${id}`, { deleted_at: new Date().toISOString() });
      toast.success('Análise arquivada!');
      navigate('/dashboard');
      setShowActionMenu(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao arquivar análise.');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja excluir esta análise? Esta ação não pode ser desfeita.')) {
      try {
        await api.delete(`/analyses/${id}`);
        toast.success('Análise excluída!');
        navigate('/dashboard');
        setShowActionMenu(false);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Erro ao excluir análise.');
      }
    }
  };

  const handleEdit = () => {
    navigate(`/analise/${id}/editar`);
    setShowActionMenu(false);
  };

  const handleShare = async () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success('Link copiado!');
      return;
    }
    setShareLoading(true);
    try {
      const res = await api.post(`/analyses/${id}/share`);
      const link = `${window.location.origin}/compartilhado/${res.data.share_token}`;
      setShareLink(link);
      navigator.clipboard.writeText(link);
      toast.success('Link de compartilhamento copiado!');
    } catch {
      toast.error('Erro ao gerar link.');
    } finally {
      setShareLoading(false);
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

  const _startGenProgressStream = (analysisId) => {
    // Close any existing stream
    if (genEsRef.current) { clearInterval(genEsRef.current); genEsRef.current = null; }
    setGenProgress({ step: 1, message: 'Iniciando geração do relatório…', pct: 5, done: false, error: null });

    const MAX_POLLS = 150; // 150 × 2s = 5 min
    let polls = 0;

    const tick = async () => {
      polls += 1;
      if (polls > MAX_POLLS) {
        clearInterval(genEsRef.current);
        setGenProgress(null);
        return;
      }
      try {
        const { data } = await api.get(`/analyses/${analysisId}/generation-status`);
        setGenProgress(data);
        if (data.done || data.error) {
          clearInterval(genEsRef.current);
          genEsRef.current = null;
          if (!data.error) {
            setTimeout(async () => {
              const { data: updated } = await api.get(`/analyses/${analysisId}`);
              setAnalysis(updated);
              setGenProgress(null);
            }, 1200);
          }
        }
      } catch { /* ignore */ }
    };

    genEsRef.current = setInterval(tick, 2000);
    tick(); // immediate first check
  };

  const handlePayment = async (plan) => {
    setPaying(true);
    setCouponError('');
    try {
      const { data: paymentData } = await api.post('/payments/', { analysis_id: id, plan, coupon: coupon.trim() || undefined });

      // Admin bypass = instant payment (status is already PAID)
      if (paymentData.status === 'paid') {
        toast.success('Pagamento confirmado! Relatório sendo gerado...');
        window.gtag?.('event', 'ads_conversion_purchase', { plan });
        _startGenProgressStream(id);
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
      const detail = err.response?.data?.detail || 'Erro no pagamento.';
      if (detail.toLowerCase().includes('cupom')) setCouponError(detail);
      else toast.error(detail);
    } finally {
      setPaying(false);
    }
  };

  const _pollPaymentStatus = async (paymentId) => {
    pollingAbortRef.current = false;
    const pollIntervals = [1000, 2000, 5000, 10000]; // Exponential backoff: 1s, 2s, 5s, 10s
    let attempt = 0;
    const maxAttempts = 60; // poll for up to 5 minutes
    
    const poll = async () => {
      if (pollingAbortRef.current || attempt >= maxAttempts) return;
      
      try {
        const { data: statusData } = await api.get(`/payments/${paymentId}/status`);
        if (statusData.status === 'paid') {
          toast.success('Pagamento confirmado! Relatório sendo gerado...');
          window.gtag?.('event', 'ads_conversion_purchase', { plan: analysis?.plan || 'unknown' });
          _startGenProgressStream(id);
          return;
        }
      } catch {
        // ignore polling errors
      }
      
      attempt++;
      const interval = pollIntervals[Math.min(attempt - 1, pollIntervals.length - 1)];
      await new Promise(r => setTimeout(r, interval));
      
      if (!pollingAbortRef.current) {
        poll();
      }
    };
    
    poll();
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
      {/* Generation progress modal */}
      {genProgress && !genProgress.done && !genProgress.error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`rounded-2xl border p-8 w-full max-w-sm mx-4 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-500 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
              <div>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Gerando relatório</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{Math.round(genProgress.pct || 0)}% concluído</p>
              </div>
            </div>
            <div className={`h-2 rounded-full mb-4 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
                style={{ width: `${genProgress.pct || 5}%` }}
              />
            </div>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{genProgress.message}</p>
          </div>
        </div>
      )}

      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <button onClick={() => navigate('/dashboard')} className={`transition flex-shrink-0 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            {analysis.logo_path && (
              <img
                src={`${(import.meta.env.VITE_API_URL || '/api/v1').replace('/api/v1', '')}/uploads/${analysis.logo_path}`}
                alt="Logo"
                className="w-9 h-9 rounded-lg object-contain shrink-0"
                loading="lazy"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div className="min-w-0">
              <h1 className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{analysis.company_name}</h1>
              <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{analysis.sector?.charAt(0).toUpperCase() + analysis.sector?.slice(1)} • {result.parameters?.projection_years || 5} anos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Action buttons */}
            <div className="hidden sm:flex items-center gap-2">
              {isPaid && (
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}
                  title="Compartilhar análise"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{shareLoading ? 'Gerando…' : shareLink ? 'Copiado!' : 'Compartilhar'}</span>
                </button>
              )}
              <button
                onClick={handleDuplicate}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                title="Duplicar análise"
              >
                <Copy className="w-4 h-4" />
                <span>Duplicar</span>
              </button>
              <button
                onClick={handleArchive}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                title="Arquivar análise"
              >
                <Archive className="w-4 h-4" />
                <span>Arquivar</span>
              </button>
              <button
                onClick={handleEdit}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                title="Editar análise"
              >
                <Edit3 className="w-4 h-4" />
                <span>Editar</span>
              </button>
              {isPaid && (
                <Link
                  to={`/simulador/${id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}
                  title="Simular cenários"
                >
                  <Calculator className="w-4 h-4" />
                  <span>Simular</span>
                </Link>
              )}
            </div>

            {/* Mobile action menu */}
            <div className="relative sm:hidden">
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className={`p-2 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showActionMenu && (
                <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl border shadow-xl z-50 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <button
                    onClick={handleDuplicate}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <Copy className="w-4 h-4" />
                    <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Duplicar</span>
                  </button>
                  {isPaid && (
                    <button
                      onClick={() => { handleShare(); setShowActionMenu(false); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    >
                      <Share2 className="w-4 h-4 text-emerald-500" />
                      <span className={`text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Compartilhar</span>
                    </button>
                  )}
                  <button
                    onClick={handleArchive}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <Archive className="w-4 h-4" />
                    <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Arquivar</span>
                  </button>
                  <button
                    onClick={handleEdit}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Editar</span>
                  </button>
                  {isPaid && (
                    <Link
                      to={`/simulador/${id}`}
                      onClick={() => setShowActionMenu(false)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    >
                      <Calculator className="w-4 h-4 text-emerald-500" />
                      <span className={`text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Simular cenários</span>
                    </Link>
                  )}
                  <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Excluir</span>
                  </button>
                </div>
              )}
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
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-0">

        {/* ═══════════════════════════════════════════════════
            1. HERO — Valor Final + Faixa
        ═══════════════════════════════════════════════════ */}
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-500 rounded-2xl p-6 md:p-10 mb-6 relative overflow-hidden">
          {/* decorative circles */}
          <div className="absolute -right-16 -top-16 w-56 h-56 bg-white/5 rounded-full" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full" />

          <div className="relative z-10 text-center">
            <p className="text-emerald-100 text-xs uppercase tracking-widest mb-1 font-medium">Valor estimado do equity</p>
            <p className="text-emerald-200 text-[11px] mb-4">Método DCF (Fluxo de Caixa Descontado) + Múltiplos de Mercado</p>

            {isPaid ? (
              <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-1 tracking-tight">
                {formatBRL(analysis.equity_value)}
              </h2>
            ) : (
              <div className="relative mb-1">
                <h2 className="text-4xl md:text-6xl font-extrabold text-white blur-lg select-none" aria-hidden="true">
                  {formatBRL(analysis.equity_value)}
                </h2>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/10">
                    <Lock className="w-5 h-5 text-white" />
                    <span className="text-white font-semibold text-sm">Desbloqueie o valor exato</span>
                  </div>
                </div>
              </div>
            )}

            {/* Equity = 0 explanation */}
            {isPaid && analysis.equity_value <= 0 && (
              <p className="text-emerald-200 text-xs max-w-md mx-auto mb-3">
                O valor resultou em R$ 0 porque os dados financeiros da empresa (margens, receita, dívida) não geraram fluxo de caixa positivo suficiente para sustentar valor de mercado.
              </p>
            )}

            {/* Range bar */}
            <div className="max-w-sm mx-auto mt-5">
              <div className="flex justify-between text-[10px] text-emerald-200/80 mb-1 font-medium uppercase tracking-wider">
                <span>Conservador</span>
                <span>Base</span>
                <span>Otimista</span>
              </div>
              <div className="relative h-2.5 bg-white/15 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/60 z-10 rounded" />
                <div className="h-full bg-gradient-to-r from-red-400 via-emerald-300 to-green-400 rounded-full" />
              </div>
              <div className={`flex justify-between text-xs mt-1.5 font-semibold ${!isPaid ? 'blur-sm select-none' : ''}`}>
                <span className="text-red-200">{formatBRL(range.low)}</span>
                <span className="text-white">{formatBRL(range.mid)}</span>
                <span className="text-green-200">{formatBRL(range.high)}</span>
              </div>
              {range.spread_pct && (
                <p className="text-emerald-200/70 text-[10px] mt-1.5">Faixa de ±{range.spread_pct}% ajustada ao nível de risco</p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            ALERTAS (TV, engine warnings)
        ═══════════════════════════════════════════════════ */}
        {tvPct > 75 && (
          <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              <strong>{tvPct.toFixed(0)}%</strong> do valor vem do Terminal Value (crescimento futuro). Avalie com cautela — empresas jovens costumam ter esse perfil.
            </p>
          </div>
        )}
        {tvInfo.warnings && tvInfo.warnings.length > 0 && (
          <div className={`flex items-start gap-3 p-4 rounded-xl mb-4 ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              {tvInfo.warnings.map((w, i) => (
                <p key={i} className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            2. INDICADORES-CHAVE — Overview rápido
        ═══════════════════════════════════════════════════ */}
        <Section
          title="Indicadores-Chave"
          description="Métricas financeiras utilizadas no cálculo da valuation"
          icon={Activity}
          isDark={isDark}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'WACC', value: `${((result.wacc || 0) * 100).toFixed(1)}%`, icon: TrendingUp, free: true, tip: 'Custo médio ponderado de capital — a taxa usada para descontar os fluxos de caixa futuros.' },
              { label: 'Score de Risco', value: `${(analysis.risk_score || 0).toFixed(1)}/100`, icon: Shield, free: true, tip: 'Quanto maior, mais arriscada é a empresa. Considera maturidade, setor e dados financeiros.' },
              { label: 'Maturidade', value: `${(analysis.maturity_index || 0).toFixed(1)}/100`, icon: Gauge, free: false, tip: 'Nível de consolidação do negócio baseado em tempo de operação, receita e estrutura.' },
              { label: 'DLOM', value: dlom.dlom_pct ? `${(dlom.dlom_pct * 100).toFixed(0)}%` : '—', icon: Percent, free: false, tip: 'Discount for Lack of Marketability — desconto aplicado por ser uma empresa de capital fechado.' },
              { label: 'Sobrevivência', value: survival.survival_rate ? `${(survival.survival_rate * 100).toFixed(0)}%` : '—', icon: HeartPulse, free: false, tip: 'Probabilidade da empresa continuar operando nos próximos anos, baseada em dados SEBRAE/IBGE.' },
              { label: 'Qualitativo', value: qual.score !== undefined ? `${qual.score}/100` : '—', icon: Target, free: false, tip: 'Avaliação qualitativa de governança, mercado, clientes, diferenciação e escalabilidade.' },
            ].map((m, i) => (
              <div key={i} className={`relative border rounded-2xl p-4 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="w-4 h-4 text-emerald-500" />
                  <span className={`text-[10px] md:text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.label}</span>
                  <InfoTip text={m.tip} isDark={isDark} />
                </div>
                <p className={`text-xl md:text-2xl font-bold ${!isPaid && !m.free ? 'blur-md select-none' : ''} ${isDark ? 'text-white' : 'text-slate-900'}`}>{m.value}</p>
                {!isPaid && !m.free && (
                  <div className="absolute inset-0 rounded-2xl flex items-center justify-center">
                    <Lock className={`w-4 h-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* DCF Gordon vs Exit Multiple vs Múltiplos */}
        {isPaid ? (
          <>

          {/* ═══════════════════════════════════════════════════
              3. COMO CHEGAMOS NESSE VALOR — Métodos
          ═══════════════════════════════════════════════════ */}
          <Section
            title="Como chegamos nesse valor"
            description="Três métodos independentes são combinados para maior precisão"
            icon={Calculator}
            isDark={isDark}
          >
            {/* Step indicator */}
            <div className={`flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-wider mb-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 inline-flex items-center justify-center text-[10px]">1</span> DCF</span>
              <ArrowRight className="w-3 h-3" />
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-500 inline-flex items-center justify-center text-[10px]">2</span> Múltiplos</span>
              <ArrowRight className="w-3 h-3" />
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-500 inline-flex items-center justify-center text-[10px]">3</span> Ajustes</span>
              <ArrowRight className="w-3 h-3" />
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 inline-flex items-center justify-center text-[10px]">4</span> Final</span>
            </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* DCF Gordon */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>DCF Gordon Growth</h4>
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Perpétuo com crescimento constante</p>
            <p className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatBRL(eqGordon)}</p>
            <div className={`text-xs space-y-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <div className="flex justify-between"><span>Ent. Value:</span><span className="font-medium">{formatBRL(evGordon)}</span></div>
              <div className="flex justify-between"><span>Terminal Value:</span><span className="font-medium">{formatBRL(tvInfo.terminal_value)}</span></div>
              <div className="flex justify-between"><span>g perpétuo:</span><span className="font-medium">{((tvInfo.perpetuity_growth || 0.035) * 100).toFixed(1)}%</span></div>
              <div className="flex justify-between"><span>Peso no DCF:</span><span className="font-medium">{(dcfWeight * 60).toFixed(0)}%</span></div>
            </div>
          </div>

          {/* DCF Exit Multiple */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-navy-900'}`}>DCF Exit Multiple</h4>
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Venda hipotética ao final da projeção</p>
            <p className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-navy-900'}`}>{formatBRL(eqExit)}</p>
            <div className={`text-xs space-y-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <div className="flex justify-between"><span>Ent. Value:</span><span className="font-medium">{formatBRL(evExit)}</span></div>
              <div className="flex justify-between"><span>Terminal Value:</span><span className="font-medium">{formatBRL(tvExit.terminal_value)}</span></div>
              <div className="flex justify-between"><span>Múltiplo saída:</span><span className="font-medium">{(tvExit.exit_multiple || 0).toFixed(1)}× EBITDA</span></div>
              <div className="flex justify-between"><span>Peso no DCF:</span><span className="font-medium">{(dcfWeight * 40).toFixed(0)}%</span></div>
            </div>
          </div>

          {/* Múltiplos */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-navy-900'}`}>Múltiplos Setoriais</h4>
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Comparação com empresas do setor</p>
            <p className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-navy-900'}`}>{formatBRL(multVal.equity_avg_multiples)}</p>
            <div className={`text-xs space-y-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <div className="flex justify-between"><span>EV/Receita ({(multVal.multiples_used?.ev_revenue || 0).toFixed(1)}×):</span><span className="font-medium">{formatBRL(multVal.ev_by_revenue)}</span></div>
              <div className="flex justify-between"><span>EV/EBITDA ({(multVal.multiples_used?.ev_ebitda || 0).toFixed(1)}×):</span><span className="font-medium">{formatBRL(multVal.ev_by_ebitda)}</span></div>
              <div className="flex justify-between"><span>Peso total:</span><span className="font-medium">{((multWeight) * 100).toFixed(0)}%</span></div>
              <p className="text-emerald-500 text-[10px] mt-1">Fonte: {multVal.multiples_used?.source || 'Damodaran'}</p>
            </div>
          </div>
        </div>

        {/* Triangulation summary */}
        <div className={`border rounded-2xl p-5 mb-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Resultado da triangulação</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className={`text-xs mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Equity pré-ajustes (DCF {(dcfWeight * 100).toFixed(0)}% + Múltiplos {(multWeight * 100).toFixed(0)}%)</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>{formatBRL(result.equity_value_dcf)}</p>
            </div>
            <div className="flex items-center gap-5 flex-wrap">
              {[
                { label: 'Beta (U)', value: betaU.toFixed(2) },
                { label: 'Beta (L)', value: (result.beta_levered || 0).toFixed(2) },
                { label: 'WACC', value: `${((result.wacc || 0) * 100).toFixed(1)}%` },
                { label: 'Selic', value: `${((result.parameters?.selic_rate || 0) * 100).toFixed(2)}%` },
                { label: 'TV no EV', value: `${tvPct.toFixed(0)}%` },
              ].map((item, i) => (
                <div key={i} className="text-center min-w-[48px]">
                  <p className={`text-[9px] uppercase font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</p>
                  <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        </Section>

        {/* ═══════════════════════════════════════════════════
            4. AJUSTES DE DESCONTO — DLOM, Sobrevivência, Quali
        ═══════════════════════════════════════════════════ */}
        <Section
          title="Ajustes e Descontos Aplicados"
          description="Descontos que transformam o valor teórico em um valor realista de mercado"
          icon={Layers}
          isDark={isDark}
        >
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* DLOM */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-500" />
                <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-navy-900'}`}>DLOM</h4>
              </div>
              {dlom.dlom_pct && (
                <button onClick={() => setShowDlomDetails(!showDlomDetails)} className="text-emerald-500 text-[10px] hover:underline">
                  {showDlomDetails ? 'Ocultar' : 'Detalhes'}
                </button>
              )}
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Discount for Lack of Marketability</p>
            <p className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-navy-900'}`}>
              {dlom.dlom_pct ? `${(dlom.dlom_pct * 100).toFixed(1)}%` : '—'}
            </p>
            <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Desconto por ser empresa fechada (sem liquidez em bolsa)</p>
            {showDlomDetails && dlom.dlom_pct && (
              <div className={`text-xs space-y-1 pt-3 mt-3 border-t ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <div className="flex justify-between"><span>Base:</span><span>{(dlom.base_discount * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>Ajuste porte:</span><span>{dlom.size_adjustment > 0 ? '+' : ''}{(dlom.size_adjustment * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>Ajuste maturidade:</span><span>{dlom.maturity_adjustment > 0 ? '+' : ''}{(dlom.maturity_adjustment * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>Ajuste setor:</span><span>{dlom.sector_adjustment > 0 ? '+' : ''}{(dlom.sector_adjustment * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>Liquidez setorial:</span><span className="capitalize">{dlom.sector_liquidity}</span></div>
              </div>
            )}
          </div>

          {/* Survival */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <HeartPulse className="w-4 h-4 text-emerald-500" />
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-navy-900'}`}>Taxa de Sobrevivência</h4>
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Horizonte: {survival.horizon || '—'} • Dados SEBRAE/IBGE</p>
            <p className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-navy-900'}`}>
              {survival.survival_rate ? `${(survival.survival_rate * 100).toFixed(0)}%` : '—'}
            </p>
            <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Probabilidade estatística de continuar operando</p>
            {survival.survival_rate && (
              <div className={`text-xs space-y-1.5 pt-3 mt-3 border-t ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <div className="flex justify-between"><span>Taxa base setorial:</span><span>{((survival.base_rate || 0) * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>Bônus maturidade:</span><span>+{((survival.age_bonus || 0) * 100).toFixed(0)}%</span></div>
                <div className="mt-2 h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500" style={{ width: `${(survival.survival_rate || 0) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Qualitative */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-emerald-500" />
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-navy-900'}`}>Score Qualitativo</h4>
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Governança, mercado, clientes, diferenciação, escala</p>
            <p className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-navy-900'}`}>
              {qual.score !== undefined ? `${qual.score}` : '—'}<span className="text-base font-normal opacity-40">/100</span>
            </p>
            <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Ajuste: {qual.adjustment ? `${qual.adjustment > 0 ? '+' : ''}${(qual.adjustment * 100).toFixed(1)}% no valor` : 'Neutro (0%)'}
            </p>
            {qual.has_data && qualRadarData.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <ResponsiveContainer width="100%" height={130}>
                  <RadarChart data={qualRadarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 8, fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Radar name="Score" dataKey="score" stroke="#059669" fill="#059669" fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            {!qual.has_data && (
              <p className={`text-[10px] italic mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Nenhum dado qualitativo foi informado</p>
            )}
          </div>
        </div>
        </Section>

        {/* ═══════════════════════════════════════════════════
            5. WATERFALL — Composição do Equity
        ═══════════════════════════════════════════════════ */}
        {waterfall.length > 0 && (
          <Section
            title="Composição do Equity Value"
            description="Visualize como cada etapa do cálculo constrói (ou reduz) o valor final"
            icon={BarChart3}
            isDark={isDark}
          >
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={waterfall} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => formatBRL(v)} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} width={140} />
                <Tooltip content={<CustomTooltip isDark={isDark} />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {waterfall.map((entry, idx) => (
                    <Cell key={idx} fill={waterfallColors[entry.type] || '#059669'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          </Section>
        )}

        {/* ═══════════════════════════════════════════════════
            6. PROJEÇÕES — Gráficos de Receita e FCF
        ═══════════════════════════════════════════════════ */}
        {chartData.length > 0 && (
          <Section
            title="Projeções Financeiras"
            description={`Receita e fluxo de caixa livre projetados para ${result.parameters?.projection_years || 5} anos`}
            icon={TrendingUp}
            isDark={isDark}
          >
          <div className="grid md:grid-cols-2 gap-4 mb-2">
            <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h4 className={`font-semibold text-sm mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Receita Projetada</h4>
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
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                  <Area type="monotone" dataKey="receita" stroke="#047857" fill="url(#gradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h4 className={`font-semibold text-sm mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Fluxo de Caixa Livre (FCL)</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => formatBRL(v)} />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                  <Bar dataKey="fcl" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fcl >= 0 ? '#047857' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          </Section>
        )}

        {/* ═══════════════════════════════════════════════════
            7. TABELAS DETALHADAS (colapsáveis)
        ═══════════════════════════════════════════════════ */}

        {/* FCF Detail Table (collapsible) */}
        {projections.length > 0 && (
          <div className={`border rounded-2xl mb-4 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
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
                      <tr key={p.year} className={`border-b transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
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
          <div className={`border rounded-2xl mb-4 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
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
                      <tr key={p.year} className={`border-b transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
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
          <div className={`border rounded-2xl mb-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
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
                      <tr key={ri} className={`border-b transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
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

        {/* ═══════════════════════════════════════════════════
            8. SIMULAÇÃO DE RODADA
        ═══════════════════════════════════════════════════ */}
        {investRound.pre_money_valuation > 0 && (
          <Section
            title="Simulação de Rodada de Investimento"
            description="Estimativa de como ficaria uma captação com base no valuation calculado"
            icon={Zap}
            isDark={isDark}
          >
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Pre-money', value: formatBRL(investRound.pre_money_valuation), tip: 'Valor da empresa antes do investimento' },
                { label: 'Investimento', value: formatBRL(investRound.investment_amount), tip: 'Valor captado na rodada' },
                { label: 'Post-money', value: formatBRL(investRound.post_money_valuation), tip: 'Pre-money + investimento' },
                { label: 'Diluição', value: `${(investRound.dilution_pct || 0).toFixed(1)}%`, tip: 'Quanto o fundador cede ao investidor' },
              ].map((item, i) => (
                <div key={i} className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <p className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</p>
                    <InfoTip text={item.tip} isDark={isDark} />
                  </div>
                  <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className={`flex items-center justify-between mt-4 pt-4 border-t text-xs ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
              <span>% Fundador após rodada: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{(investRound.founder_equity_pct || 0).toFixed(1)}%</strong></span>
              <span>Preço por 1%: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{formatBRL(investRound.price_per_1pct)}</strong></span>
            </div>
          </div>
          </Section>
        )}

        {/* ═══════════════════════════════════════════════════
            9. ANÁLISE IA
        ═══════════════════════════════════════════════════ */}
        {analysis.ai_analysis && (
          <Section
            title="Análise Estratégica por IA"
            description="Recomendações geradas por inteligência artificial com base nos dados da empresa"
            icon={Sparkles}
            isDark={isDark}
          >
          <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`text-sm leading-relaxed whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {analysis.ai_analysis}
            </div>
          </div>
          </Section>
        )}

        {/* ═══════════════════════════════════════════════════
            10. SIMULADOR LINK
        ═══════════════════════════════════════════════════ */}
        <div className="mb-6">
          <Link
            to={`/simulador/${id}`}
            className={`flex items-center gap-4 border rounded-2xl p-5 transition group ${isDark ? 'bg-slate-900 border-slate-800 hover:border-emerald-600/40' : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'}`}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-600/20">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-navy-900'}`}>Simulador Interativo</h4>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ajuste WACC, crescimento e outros parâmetros para recalcular o valuation em tempo real</p>
            </div>
            <ArrowRight className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          </Link>
        </div>

        {/* ═══════════════════════════════════════════════════
            METODOLOGIA — Explicativo
        ═══════════════════════════════════════════════════ */}
        <div className={`rounded-2xl p-5 mb-6 ${isDark ? 'bg-slate-900/50 border border-slate-800' : 'bg-slate-50 border border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-emerald-500" />
            <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>Como funciona a metodologia</h4>
          </div>
          <div className={`text-xs leading-relaxed space-y-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <p><strong>1. DCF (Fluxo de Caixa Descontado):</strong> Projeta os fluxos de caixa futuros da empresa e traz a valor presente usando o WACC. Combina dois métodos de terminal value: Gordon Growth (crescimento perpétuo) e Exit Multiple (venda hipotética).</p>
            <p><strong>2. Múltiplos de Mercado:</strong> Compara indicadores da empresa (receita, EBITDA) com múltiplos setoriais de empresas de capital aberto (fonte: Damodaran).</p>
            <p><strong>3. Triangulação:</strong> Combina DCF ({(dcfWeight * 100).toFixed(0)}%) e Múltiplos ({(multWeight * 100).toFixed(0)}%) para um resultado mais robusto.</p>
            <p><strong>4. Ajustes:</strong> Aplica DLOM (desconto por ser capital fechado), taxa de sobrevivência (SEBRAE/IBGE), e ajuste qualitativo baseado em governança, mercado e diferenciação.</p>
          </div>
        </div>
          </>
        ) : (
          /* ─── Locked Premium Content Preview ─── */
          <div className={`relative rounded-2xl border-2 border-dashed p-8 md:p-12 mb-6 text-center ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-300 bg-slate-50'}`}>
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Relatório Completo
            </h3>
            <p className={`max-w-md mx-auto mb-6 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Desbloqueie o DCF detalhado, múltiplos, descontos aplicados, DRE projetada, simulação de rodada, análise por IA, simulador interativo e muito mais.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-lg mx-auto">
              {[
                { icon: BarChart3, label: 'DCF Duplo', desc: 'Gordon + Exit' },
                { icon: Target, label: 'Ajustes', desc: 'DLOM + Survival' },
                { icon: Sparkles, label: 'IA', desc: 'Análise estratégica' },
                { icon: Gauge, label: 'Simulador', desc: 'Recalcule ao vivo' },
              ].map((item, i) => (
                <div key={i} className={`flex flex-col items-center gap-1 p-3 rounded-xl ${isDark ? 'bg-slate-800/60' : 'bg-white'}`}>
                  <item.icon className="w-5 h-5 text-emerald-500" />
                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.label}</span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.desc}</span>
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
            <p className={`text-center mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Escolha o plano ideal para seu relatório. Cada plano gera um PDF exclusivo com conteúdo diferenciado.</p>

            {/* Coupon field */}
            <div className="max-w-sm mx-auto mb-8">
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Cupom de desconto (opcional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponError(''); }}
                  placeholder="Ex: PRIMEIRA"
                  className={`flex-1 px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${
                    couponError
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
              {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  plan: 'essencial', name: 'Essencial', price: 'R$997', pages: '~8 páginas',
                  desc: 'Valuation DCF completo',
                  features: ['Resumo executivo', 'DCF Gordon Growth', 'WACC detalhado', 'Score de risco e maturidade', 'Glossário e disclaimer', 'Envio por e-mail'],
                  popular: false,
                },
                {
                  plan: 'profissional', name: 'Profissional', price: 'R$1.797', pages: '~15 páginas',
                  desc: 'Análise completa com benchmark',
                  features: ['Tudo do Essencial', 'DCF Exit Multiple', 'Múltiplos de mercado', 'Triangulação e waterfall', 'DLOM + Sobrevivência', 'DRE projetada (P&L)', 'Projeção de FCL', 'Benchmark setorial', 'Tabela de sensibilidade'],
                  popular: false,
                },
                {
                  plan: 'estrategico', name: 'Estratégico', price: 'R$3.997', pages: '~25 páginas',
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
            {/* ─── Selos de segurança ─── */}
            <div className={`mt-8 pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              {/* Métodos de pagamento */}
              <p className={`text-center text-xs font-medium mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Pagamento processado com segurança via
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mb-5">
                {/* PIX */}
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M11.3 2.63a.984.984 0 0 1 1.4 0l2.58 2.57a3.96 3.96 0 0 0 2.8 1.16h.5a.984.984 0 0 1 .98.98v.5a3.96 3.96 0 0 0 1.16 2.8l2.6 2.58a.984.984 0 0 1 0 1.4l-2.6 2.57a3.96 3.96 0 0 0-1.16 2.8v.5a.984.984 0 0 1-.98.99h-.5a3.96 3.96 0 0 0-2.8 1.16l-2.58 2.57a.984.984 0 0 1-1.4 0l-2.58-2.57a3.96 3.96 0 0 0-2.8-1.16h-.5a.984.984 0 0 1-.98-.98v-.5a3.96 3.96 0 0 0-1.16-2.8L.68 12.7a.984.984 0 0 1 0-1.4l2.58-2.58A3.96 3.96 0 0 0 4.42 5.9v-.5a.984.984 0 0 1 .98-.98h.5a3.96 3.96 0 0 0 2.8-1.16L11.3 2.63z"/></svg>
                  PIX
                </span>
                {/* Boleto */}
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  Boleto
                </span>
                {/* Cartão */}
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  Cartão de Crédito
                </span>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-4">
                {/* SSL */}
                <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Conexão SSL 256-bit</span>
                </div>
                <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
                {/* Asaas */}
                <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Processado pela <strong className={isDark ? 'text-slate-300' : 'text-slate-600'}>Asaas</strong></span>
                </div>
                <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
                {/* PCI */}
                <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PCI DSS Compliant</span>
                </div>
              </div>
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

        {/* Notes & Comments */}
        <div className={`border-t pt-8 mt-8 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <AnalysisNotes analysisId={id} initialNotes={analysis.notes} isDark={isDark} />
        </div>
      </main>
    </>
  );
}
