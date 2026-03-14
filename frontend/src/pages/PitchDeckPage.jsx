import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Download, CreditCard, Loader2, FileText, CheckCircle,
  Clock, AlertCircle, ExternalLink, Sparkles, RefreshCw, Edit3,
  Presentation, BarChart3, Users, Eye,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import api from '../lib/api';
import toast from 'react-hot-toast';
import formatBRL from '../lib/formatBRL';

const STATUS_CONFIG = {
  draft: { label: 'Rascunho', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: Clock },
  pending_payment: { label: 'Pending payment', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: CreditCard },
  processing: { label: 'Generating PDF...', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Loader2 },
  completed: { label: 'Completo', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
  error: { label: 'Erro', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertCircle },
};

export default function PitchDeckPage() {
  const { id } = useParams();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [polling, setPolling] = useState(false);
  const [progress, setProgress] = useState({ pct: 0, message: 'Iniciando...', done: false, error: null });
  const [downloadingPptx, setDownloadingPptx] = useState(false);
  const [downloadingExec, setDownloadingExec] = useState(false);
  const [generatingCompetitive, setGeneratingCompetitive] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const pollAbortRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { pollAbortRef.current = true; };
  }, []);

  usePageTitle(deck ? `Pitch Deck — ${deck.company_name}` : 'Pitch Deck');

  const fetchDeck = useCallback(async () => {
    try {
      const res = await api.get(`/pitch-deck/${id}`);
      setDeck(res.data);
    } catch {
      toast.error('Pitch Deck não encontrado.');
      navigate('/pitch-deck');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchDeck(); }, [fetchDeck]);

  // Poll status when processing
  useEffect(() => {
    if (deck?.status !== 'processing') return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/pitch-deck/${id}`);
        setDeck(res.data);
        if (res.data.status !== 'processing') clearInterval(interval);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [deck?.status, id]);

  // Poll progress when processing
  useEffect(() => {
    if (deck?.status !== 'processing') return;
    setProgress({ pct: 5, message: 'Iniciando geração...', done: false, error: null });
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/pitch-deck/${id}/progress`);
        const p = res.data;
        if (p && typeof p.pct === 'number') setProgress(p);
        if (p?.done) clearInterval(interval);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [deck?.status, id]);

  async function handlePayment() {
    setPaying(true);
    try {
      const res = await api.post('/pitch-deck/payment', {
        pitch_deck_id: id,
        billing_type: 'PIX',
      });
      setPaymentUrl(res.data.invoice_url);
      // Start polling payment status
      pollPayment(res.data.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error creating payment.');
    } finally {
      setPaying(false);
    }
  }

  async function pollPayment(paymentId) {
    setPolling(true);
    pollAbortRef.current = false;
    const check = async () => {
      try {
        const resp = await api.get(`/pitch-deck/payment/${paymentId}/status`);
        if (resp.data.status === 'CONFIRMED' || resp.data.status === 'RECEIVED') {
          setPolling(false);
          toast.success('Pagamento confirmado!');
          fetchDeck();
          return true;
        }
      } catch {}
      return false;
    };

    for (let i = 0; i < 60; i++) {
      if (pollAbortRef.current) { setPolling(false); return; }
      await new Promise(r => setTimeout(r, 5000));
      if (pollAbortRef.current) { setPolling(false); return; }
      const done = await check();
      if (done) return;
    }
    setPolling(false);
    toast('Verificação encerrada. Atualize a página para conferir.', { icon: '⏰' });
  }

  async function handleGeneratePDF() {
    setGenerating(true);
    try {
      await api.post(`/pitch-deck/${id}/generate-pdf`);
      toast.success('PDF being generated... Please wait.');
      fetchDeck();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error generating PDF.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    try {
      const res = await api.get(`/pitch-deck/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PitchDeck_${deck.company_name.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error downloading PDF.');
    }
  }

  async function handleDownloadPptx() {
    setDownloadingPptx(true);
    try {
      const res = await api.get(`/pitch-deck/${id}/download-pptx`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PitchDeck_${deck.company_name.replace(/\s+/g, '_')}.pptx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PPTX baixado!');
    } catch {
      toast.error('Error downloading PPTX.');
    } finally {
      setDownloadingPptx(false);
    }
  }

  async function handleDownloadExecSummary() {
    setDownloadingExec(true);
    try {
      const res = await api.get(`/pitch-deck/${id}/executive-summary`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Resumo_Executivo_${deck.company_name.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Resumo executivo baixado!');
    } catch {
      toast.error('Error generating executive summary.');
    } finally {
      setDownloadingExec(false);
    }
  }

  async function handleGenerateCompetitive() {
    setGeneratingCompetitive(true);
    try {
      await api.post(`/pitch-deck/${id}/competitive-analysis`);
      toast.success('Competitive analysis generated with AI!');
      fetchDeck();
    } catch {
      toast.error('Error generating competitive analysis.');
    } finally {
      setGeneratingCompetitive(false);
    }
  }

  async function handleLoadAnalytics() {
    try {
      const res = await api.get(`/pitch-deck/${id}/analytics`);
      setAnalytics(res.data);
      setShowAnalytics(true);
    } catch {
      toast.error('Error loading analytics.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!deck) return null;

  const status = STATUS_CONFIG[deck.status] || STATUS_CONFIG.draft;
  const StatusIcon = status.icon;

  const cardCls = `rounded-xl border p-5 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`;
  const sectionTitle = `font-semibold text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`;
  const sectionBody = `text-sm mt-2 whitespace-pre-wrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/pitch-deck')}
          className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{deck.company_name}</h1>
          <div className="flex items-center gap-3 mt-1">
            {deck.sector && <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{deck.sector}</span>}
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
              <StatusIcon className={`w-3 h-3 ${deck.status === 'processing' ? 'animate-spin' : ''}`} />
              {status.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {deck.status === 'draft' && (
            <Link to={`/pitch-deck/novo?edit=${id}`}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}>
              <Edit3 className="w-4 h-4" /> Editar
            </Link>
          )}
        </div>
      </div>

      {/* Action cards */}
      {deck.status === 'draft' && !deck.is_paid && (
        <div className={`rounded-xl border p-6 mb-6 ${isDark ? 'bg-gradient-to-r from-purple-950/30 to-slate-900 border-purple-500/30' : 'bg-gradient-to-r from-purple-50 to-white border-purple-200'}`}>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <h3 className={`font-bold text-lg mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Gerar Pitch Deck Profissional
              </h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                PDF premium com design profissional, gráficos e narrativa estratégica por IA.
              </p>
              <div className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Pagamento único · PIX, boleto ou cartão
              </div>
            </div>
            <div className="text-center flex-shrink-0">
              <div className={`font-extrabold text-3xl mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>R$ 897</div>
              <button
                onClick={handlePayment}
                disabled={paying}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-600/30 hover:scale-[1.02] disabled:opacity-50"
              >
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Pagar e gerar
              </button>
            </div>
          </div>
          {paymentUrl && (
            <div className={`mt-4 p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-blue-50 border-blue-200'}`}>
              <p className={`text-sm font-medium mb-2 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                {polling ? '⏳ Awaiting payment confirmation...' : 'Payment link generated:'}
              </p>
              <a href={paymentUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-purple-500 hover:text-purple-400 font-medium">
                Open payment page <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      )}

      {deck.is_paid && deck.status === 'draft' && (
        <div className={`rounded-xl border p-4 mb-6 ${isDark ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div>
                <p className={`font-medium text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Pagamento confirmado!</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Clique para gerar seu PDF.</p>
              </div>
            </div>
            <button
              onClick={handleGeneratePDF}
              disabled={generating}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/30"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Gerar PDF com IA
            </button>
          </div>
        </div>
      )}

      {deck.status === 'processing' && (
        <div className={`rounded-xl border p-6 mb-6 ${isDark ? 'bg-blue-950/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin flex-shrink-0" />
            <div>
              <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Gerando seu Pitch Deck...</h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{progress.message}</p>
            </div>
          </div>
          <div className={`w-full rounded-full h-2 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-700 ease-out"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className={`text-xs mt-1.5 text-right ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{progress.pct}%</p>
        </div>
      )}

      {deck.status === 'completed' && (
        <div className={`rounded-xl border p-6 mb-6 ${isDark ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
              <div>
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Pitch Deck pronto!</h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Gerado em {deck.pdf_generated_at ? new Date(deck.pdf_generated_at).toLocaleString('pt-BR') : '—'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleGeneratePDF} disabled={generating}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}>
                <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> Regerar
              </button>
              <button onClick={handleDownload}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/30">
                <Download className="w-4 h-4" /> Baixar PDF
              </button>
              <button onClick={handleDownloadPptx} disabled={downloadingPptx}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'} disabled:opacity-60`}>
                {downloadingPptx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />} PPTX
              </button>
              <button onClick={handleDownloadExecSummary} disabled={downloadingExec}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'} disabled:opacity-60`}>
                {downloadingExec ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Resumo 1-pager
              </button>
            </div>
          </div>
        </div>
      )}

      {deck.status === 'error' && (
        <div className={`rounded-xl border p-4 mb-6 ${isDark ? 'bg-red-950/20 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                Error generating the PDF. Try again.
              </p>
            </div>
            <button onClick={handleGeneratePDF} disabled={generating}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-500 transition">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Content preview */}
      <div className="space-y-4">
        {deck.headline && (
          <div className={cardCls}>
            <h3 className={sectionTitle}>Headline</h3>
            <p className={`text-lg mt-2 italic ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>"{deck.ai_headline || deck.headline}"</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deck.problem && (
            <div className={cardCls}>
              <h3 className={sectionTitle}>Problema</h3>
              <p className={sectionBody}>{deck.ai_problem || deck.problem}</p>
            </div>
          )}
          {deck.solution && (
            <div className={cardCls}>
              <h3 className={sectionTitle}>Solução</h3>
              <p className={sectionBody}>{deck.ai_solution || deck.solution}</p>
            </div>
          )}
        </div>

        {deck.target_market && (
          <div className={cardCls}>
            <h3 className={sectionTitle}>Mercado-alvo</h3>
            {deck.target_market.description && <p className={sectionBody}>{deck.target_market.description}</p>}
            <div className="grid grid-cols-3 gap-4 mt-3">
              {deck.target_market.tam && (
                <div className={`text-center p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>TAM</div>
                  <div className={`font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{deck.target_market.tam}</div>
                </div>
              )}
              {deck.target_market.sam && (
                <div className={`text-center p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>SAM</div>
                  <div className={`font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{deck.target_market.sam}</div>
                </div>
              )}
              {deck.target_market.som && (
                <div className={`text-center p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>SOM</div>
                  <div className={`font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{deck.target_market.som}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {deck.competitive_landscape && deck.competitive_landscape.length > 0 && (
          <div className={cardCls}>
            <h3 className={sectionTitle}>Cenário Competitivo</h3>
            <div className="mt-3 space-y-2">
              {deck.competitive_landscape.map((c, i) => (
                <div key={i} className={`flex justify-between items-center p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-700'}`}>{c.competitor}</span>
                  <span className={`text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{c.advantage}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deck.business_model && (
            <div className={cardCls}>
              <h3 className={sectionTitle}>Modelo de Negócios</h3>
              <p className={sectionBody}>{deck.ai_business_model || deck.business_model}</p>
            </div>
          )}
          {deck.sales_channels && (
            <div className={cardCls}>
              <h3 className={sectionTitle}>Canais de Vendas</h3>
              <p className={sectionBody}>{deck.ai_sales_channels || deck.sales_channels}</p>
            </div>
          )}
        </div>

        {deck.financial_projections && deck.financial_projections.length > 0 && (
          <div className={cardCls}>
            <h3 className={sectionTitle}>Projeções Financeiras</h3>
            <div className={`mt-3 overflow-x-auto`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                    <th className="text-left py-2 px-3 font-medium">Ano</th>
                    <th className="text-right py-2 px-3 font-medium">Receita</th>
                    <th className="text-right py-2 px-3 font-medium">Despesas</th>
                    <th className="text-right py-2 px-3 font-medium">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {deck.financial_projections.map((p, i) => (
                    <tr key={i} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <td className={`py-2 px-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.year}</td>
                      <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.revenue)}</td>
                      <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(p.expenses)}</td>
                      <td className={`py-2 px-3 text-right font-medium ${p.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatBRL(p.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {deck.team && deck.team.length > 0 && (
          <div className={cardCls}>
            <h3 className={sectionTitle}>Equipe</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              {deck.team.map((m, i) => (
                <div key={i} className={`text-center p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{m.name}</div>
                  <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{m.role}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {deck.funding_needs && deck.funding_needs.amount > 0 && (
          <div className={cardCls}>
            <h3 className={sectionTitle}>Necessidade de Capital</h3>
            <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {formatBRL(deck.funding_needs.amount)}
            </div>
            {deck.funding_needs.description && <p className={sectionBody}>{deck.ai_funding_use || deck.funding_needs.description}</p>}
          </div>
        )}

        {/* ─── AI Competitive Analysis ─── */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={sectionTitle}>AI Competitive Analysis</h3>
            <button
              onClick={handleGenerateCompetitive}
              disabled={generatingCompetitive}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition ${isDark ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'} disabled:opacity-50`}
            >
              {generatingCompetitive ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {deck.ai_competitive_analysis ? 'Regenerar' : 'Gerar com IA'}
            </button>
          </div>
          {deck.ai_competitive_analysis ? (() => {
            try {
              const ca = typeof deck.ai_competitive_analysis === 'string' ? JSON.parse(deck.ai_competitive_analysis) : deck.ai_competitive_analysis;
              return (
                <div>
                  {ca.competitive_summary && <p className={`text-sm mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{ca.competitive_summary}</p>}
                  {ca.competitors?.length > 0 && (
                    <div className="space-y-2">
                      {ca.competitors.map((c, i) => (
                        <div key={i} className={`rounded-lg p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.type === 'direto' ? (isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600') : (isDark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600')}`}>
                              {c.type}
                            </span>
                          </div>
                          {c.our_advantage && <p className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Nossa vantagem: {c.our_advantage}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {ca.differentiation?.length > 0 && (
                    <div className="mt-3">
                      <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Diferenciais:</p>
                      <div className="flex flex-wrap gap-2">
                        {ca.differentiation.map((d, i) => <span key={i} className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>{d}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            } catch { return <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Analysis available — click Regenerate to update.</p>; }
          })() : (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Clique em "Gerar com IA" para criar uma análise dos concorrentes deste setor.</p>
          )}
        </div>

        {/* ─── View Analytics ─── */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={sectionTitle}>Analytics de Visualizações</h3>
            <button
              onClick={handleLoadAnalytics}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition ${isDark ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
            >
              <Eye className="w-3 h-3" /> {showAnalytics ? 'Refresh' : 'Carregar'}
            </button>
          </div>
          {showAnalytics && analytics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total de Vizualizações', value: analytics.total_views },
                { label: 'Visitantes Únicos', value: analytics.unique_viewers },
                { label: 'Via Link Compartilhado', value: analytics.share_link_views },
                { label: 'Últ. 30 dias', value: analytics.views_last_30_days },
              ].map(({ label, value }) => (
                <div key={label} className={`rounded-xl p-3 text-center ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value ?? 0}</p>
                </div>
              ))}
            </div>
          ) : (
            !showAnalytics && <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Veja quantas vezes seu pitch foi visualizado e de onde.</p>
          )}
        </div>
      </div>
    </div>
  );
}
