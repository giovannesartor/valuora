import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, DollarSign, BarChart3, Copy, Check,
  Briefcase, Percent, Clock,
  MessageCircle, Mail, Trophy, Target, QrCode, Linkedin,
  Bell, ChevronDown, ChevronUp, Link2, TrendingUp, ArrowRight,
  Award, Star, Rocket,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import api from '../lib/api';
import formatBRL from '../lib/formatBRL';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';

export default function PartnerDashboardPage() {
  usePageTitle('Parceiro');
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  // P2: Ranking
  const [ranking, setRanking] = useState([]);

  // P1: Notification state
  const prevClientCount = useRef(null);
  const prevCommissionCount = useRef(null);
  const [newClientAlert, setNewClientAlert] = useState(0);
  // Load persisted last-seen counts for cross-session detection
  useEffect(() => {
    prevClientCount.current = parseInt(localStorage.getItem('qv_partner_last_clients') || '0', 10);
    prevCommissionCount.current = parseInt(localStorage.getItem('qv_partner_last_commissions') || '0', 10);
  }, []);

  // P6: Onboarding checklist
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('qv_partner_onboarded'));

  // P7: UTM builder
  const [showUtm, setShowUtm] = useState(false);
  const [utm, setUtm] = useState({ source: 'whatsapp', medium: 'social', campaign: 'indicacao' });

  const fetchDashboard = useCallback(() => {
    api.get('/partners/dashboard')
      .then(({ data }) => {
        setDashboard(data);
        // P1: Detect new clients since last fetch
        const count = data.clients?.length || 0;
        if (prevClientCount.current !== null && count > prevClientCount.current) {
          setNewClientAlert(count - prevClientCount.current);
        }
        prevClientCount.current = count;
        localStorage.setItem('qv_partner_last_clients', String(count));

        // Detect new commissions (conversions) since last known count
        const commCount = data.commissions?.length || 0;
        if (prevCommissionCount.current !== null && commCount > prevCommissionCount.current) {
          const diff = commCount - prevCommissionCount.current;
          const latest = data.commissions?.[0];
          const earned = latest?.partner_amount || 0;
          toast.success(
            `🎉 ${diff} new ${diff > 1 ? 's' : ''} conversion${diff > 1 ? 'ões' : ''}!${earned > 0 ? ` +$ ${earned.toLocaleString('en-US', { minimumFractionDigits: 2 })} in commission` : ''}`,
            { duration: 6000 }
          );
        }
        prevCommissionCount.current = commCount;
        localStorage.setItem('qv_partner_last_commissions', String(commCount));
      })
      .catch(() => {
        toast.error('You are not a registered partner.');
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    fetchDashboard();
    const timer = setInterval(fetchDashboard, 60_000);
    // P2: Fetch ranking
    api.get('/partners/ranking').then(({ data }) => setRanking(data.ranking || [])).catch(() => {});
    return () => clearInterval(timer);
  }, [fetchDashboard]);

  const earningsTimeline = useMemo(() => {
    if (!dashboard?.commissions?.length) return [];
    const byMonth = {};
    dashboard.commissions.forEach(c => {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { month: key, total: 0, count: 0 };
      byMonth[key].total += c.partner_amount || 0;
      byMonth[key].count += 1;
    });
    return Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        label: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      }));
  }, [dashboard]);

  const statusDistribution = useMemo(() => {
    if (!dashboard?.clients?.length) return [];
    const counts = {};
    dashboard.clients.forEach(c => {
      const s = c.data_status || 'pre_filled';
      counts[s] = (counts[s] || 0) + 1;
    });
    const COLORS = { pre_filled: '#eab308', completed: '#3b82f6', report_sent: '#10b981' };
    const LABELS = { pre_filled: 'Pre-filled', completed: 'Completed', report_sent: 'Report sent' };
    return Object.entries(counts).map(([key, value]) => ({
      name: LABELS[key] || key, value, color: COLORS[key] || '#94a3b8',
    }));
  }, [dashboard]);

  // P3: Conversion funnel
  const funnelData = useMemo(() => {
    if (!dashboard) return [];
    const clients = dashboard.clients || [];
    const total = clients.length;
    const completed = clients.filter(c => c.data_status === 'completed' || c.data_status === 'report_sent').length;
    const reportSent = clients.filter(c => c.data_status === 'report_sent').length;
    const paid = dashboard.summary?.total_sales || 0;
    return [
      { label: 'Clients added', count: total, color: 'bg-blue-500', pct: 100 },
      { label: 'Analysis completed', count: completed, color: 'bg-teal-500', pct: total ? Math.round(completed / total * 100) : 0 },
      { label: 'Report sent', count: reportSent, color: 'bg-emerald-500', pct: total ? Math.round(reportSent / total * 100) : 0 },
      { label: 'Payment confirmed', count: paid, color: 'bg-green-500', pct: total ? Math.round(paid / total * 100) : 0 },
    ];
  }, [dashboard]);

  // P4: Earnings forecast
  const earningsForecast = useMemo(() => {
    if (!dashboard) return 0;
    const preFilled = (dashboard.clients || []).filter(c => c.data_status === 'pre_filled').length;
    const commissionRate = dashboard.partner?.commission_rate || 0.5;
    const avgTicket = 2000; // $2,000 avg ticket
    return preFilled * avgTicket * commissionRate;
  }, [dashboard]);

  // P7: UTM link
  const utmLink = useMemo(() => {
    if (!dashboard?.partner?.referral_link) return '';
    const base = dashboard.partner.referral_link;
    const params = new URLSearchParams({
      ...(utm.source && { utm_source: utm.source }),
      ...(utm.medium && { utm_medium: utm.medium }),
      ...(utm.campaign && { utm_campaign: utm.campaign }),
    });
    return `${base}&${params.toString()}`;
  }, [dashboard, utm]);

  // F5: Conversion donut — Compraram vs Não compraram
  const conversionData = useMemo(() => {
    if (!dashboard) return [];
    const total = dashboard.clients?.length || 0;
    const paid = dashboard.summary?.total_sales || 0;
    const notPaid = Math.max(0, total - paid);
    if (total === 0) return [];
    return [
      { name: 'Purchased', value: paid,    color: '#10b981' },
      { name: 'Did not purchase', value: notPaid, color: isDark ? '#334155' : '#e2e8f0' },
    ];
  }, [dashboard, isDark]);

  const handleCopyLink = () => {
    if (dashboard?.partner?.referral_link) {
      navigator.clipboard.writeText(dashboard.partner.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // P3: Certificate download
  const handleDownloadCertificate = async () => {
    try {
      const res = await api.get('/partners/certificate', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'partner-certificate.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Certificate downloaded!');
    } catch {
      toast.error('Error generating certificate.');
    }
  };

  const handleShareWhatsApp = () => {
    const link = dashboard?.partner?.referral_link;
    if (!link) return;
    const text = `Discover your company's value — e crie seu pitch deck profissional — com o Valuora! Use meu link: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareEmail = () => {
    const link = dashboard?.partner?.referral_link;
    if (!link) return;
    const subject = 'Descubra o valor da sua empresa e crie seu pitch deck';
    const body = `Olá!\n\nGostaria de indicar a plataforma Valuora para você.\nDiscover your company's value e crie um pitch deck profissional usando meu link:\n\n${link}\n\nAbraços!`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleShareLinkedIn = () => {
    const link = dashboard?.partner?.referral_link;
    if (!link) return;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, '_blank');
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className={`rounded-2xl border p-6 animate-pulse ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`h-4 w-48 rounded mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        <div className={`h-10 w-full rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`rounded-2xl border p-5 animate-pulse ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`h-10 w-10 rounded-xl mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className={`h-7 w-16 rounded mb-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className={`h-4 w-24 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          </div>
        ))}
      </div>
    </div>
  );

  if (!dashboard) return null;
  const { partner, summary } = dashboard;

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-emerald-500" />
            <div>
              <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Overview</h1>
              <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Welcome back, partner!
              </p>
            </div>
            <span className="ml-2 bg-emerald-500/10 text-emerald-500 text-xs font-semibold px-2.5 py-1 rounded-full">Partner</span>
          </div>
          {/* P1: New client notification bell */}
          {newClientAlert > 0 && (
            <button
              onClick={() => setNewClientAlert(0)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-colors duration-200 ${isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-700'}`}
            >
              <Bell className="w-4 h-4" />
              {newClientAlert} novo{newClientAlert > 1 ? 's' : ''} cliente{newClientAlert > 1 ? 's' : ''}!
            </button>
          )}
          {/* P3: Certificate download */}
          <button
            onClick={handleDownloadCertificate}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition ${isDark ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : 'border-amber-300 text-amber-600 hover:bg-amber-50'}`}
            title="Download Partner Certificate"
          >
            <Award className="w-4 h-4" />
            <span className="hidden sm:inline">Certificate</span>
          </button>
        </div>

        {/* P6: Onboarding Checklist */}
        {showOnboarding && (
          <div className={`rounded-2xl border p-5 mb-6 ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-semibold flex items-center gap-1.5 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                <Rocket className="w-3.5 h-3.5" /> Getting started
              </h3>
              <button
                onClick={() => { setShowOnboarding(false); localStorage.setItem('qv_partner_onboarded', '1'); }}
                className={`text-[10px] font-medium ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Dispensar
              </button>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Copy your referral link (Valuation & Pitch Deck)', done: !!dashboard?.partner?.referral_link },
                { label: 'Add your first client', done: (dashboard?.clients?.length || 0) > 0 },
                { label: 'Set up your payment info', done: !!dashboard?.partner?.pix_key },
                { label: 'Close your first sale', done: (dashboard?.summary?.total_sales || 0) > 0 },
              ].map((step, i) => (
                <div key={i} className={`flex items-center gap-3 text-sm ${step.done ? (isDark ? 'text-slate-500 line-through' : 'text-slate-400 line-through') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${step.done ? 'bg-emerald-500 border-emerald-500' : (isDark ? 'border-slate-600' : 'border-slate-300')}`}>
                    {step.done && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {step.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* P1: "How much will I earn" KPI Hero */}
        {summary.pending_commissions > 0 && (
          <div className={`rounded-2xl p-6 mb-6 border-2 ${isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-300'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>How much will I earn</span>
                </div>
                <p className={`text-4xl font-semibold mb-1 tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  {formatBRL(summary.pending_commissions)}
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>in commissions pending approval</p>
              </div>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                <DollarSign className="w-7 h-7 text-emerald-500" />
              </div>
            </div>
          </div>
        )}

        {/* Referral Link Banner */}
        <div className={`rounded-2xl p-6 mb-8 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Your referral link — Valuation & Pitch Deck</h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Compartilhe com seus clientes. Cada venda gera{' '}
                <span className="text-emerald-500 font-semibold">{(partner.commission_rate * 100).toFixed(0)}% commission</span>.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className={`px-4 py-2.5 rounded-xl text-sm tabular-nums ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-emerald-600'}`}>
                {partner.referral_link}
              </code>
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  copied ? 'bg-emerald-500 text-white' : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="px-3 py-2.5 rounded-xl text-sm font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20 transition"
                title="Compartilhar via WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              <button
                onClick={handleShareEmail}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                title="Compartilhar via E-mail"
              >
                <Mail className="w-4 h-4" />
              </button>
              <button
                onClick={handleShareLinkedIn}
                className="px-3 py-2.5 rounded-xl text-sm font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition"
                title="Compartilhar no LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowQr(true)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                title="Gerar QR Code"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Link único: detecta automaticamente valuation ou pitch deck */}
          <p className={`mt-2 text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            This link automatically tracks Valuation e Pitch Deck — um só link para tudo.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users,      label: 'Clientes',      value: summary.total_clients,             color: 'text-blue-500'    },
            { icon: BarChart3,  label: 'Vendas',        value: summary.total_sales,               color: 'text-emerald-500' },
            { icon: DollarSign, label: 'Ganhos totais', value: formatBRL(summary.total_earnings), color: 'text-green-500'   },
            { icon: Percent,    label: 'Conversion',     value: `${summary.conversion_rate}%`,     color: 'text-teal-500'    },
          ].map((kpi, i) => (
            <div key={i} className={`border rounded-2xl p-5 transition-colors duration-200 ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-2xl font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{kpi.value}</p>
              <p className={`text-xs font-semibold uppercase tracking-widest mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* P5: Expanded Gamification progress */}
        {(() => {
          const goals = [
            { label: 'Primeiro cliente',        target: 1,     current: summary.total_clients,  icon: Users,     type: 'count' },
            { label: '5 clientes',              target: 5,     current: summary.total_clients,  icon: Users,     type: 'count' },
            { label: '10 clientes',             target: 10,    current: summary.total_clients,  icon: Users,     type: 'count' },
            { label: '25 clientes',             target: 25,    current: summary.total_clients,  icon: Users,     type: 'count' },
            { label: 'Primeira venda',          target: 1,     current: summary.total_sales,    icon: BarChart3, type: 'count' },
            { label: '10 vendas',               target: 10,    current: summary.total_sales,    icon: BarChart3, type: 'count' },
            { label: '50 vendas',               target: 50,    current: summary.total_sales,    icon: BarChart3, type: 'count' },
            { label: '$5,000 in commissions',   target: 5000,  current: summary.total_earnings, icon: Target,    type: 'money' },
            { label: '$10,000 in commissions',  target: 10000, current: summary.total_earnings, icon: Target,    type: 'money' },
            { label: '$20,000 in commissions',  target: 20000, current: summary.total_earnings, icon: Target,    type: 'money' },
            { label: '$50,000 in commissions',  target: 50000, current: summary.total_earnings, icon: Trophy,    type: 'money' },
          ];
          const completed = goals.filter(g => g.current >= g.target);
          const nextGoal = goals.find(g => g.current < g.target);
          if (!nextGoal && completed.length === 0) return null;
          const pct = nextGoal ? Math.min(100, Math.round((nextGoal.current / nextGoal.target) * 100)) : 100;
          return (
            <div className={`rounded-2xl border p-5 mb-8 ${isDark ? 'bg-purple-500/5 border-purple-500/20' : 'bg-purple-50 border-purple-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-purple-500" />
                  <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                    {nextGoal ? `Próxima meta: ${nextGoal.label}` : '🏆 Todas as metas atingidas!'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{completed.length}/{goals.length} metas</span>
                  {nextGoal && <span className={`text-xs font-semibold tabular-nums ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{pct}%</span>}
                </div>
              </div>
              {nextGoal && (
                <>
                  <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-purple-100'}`}>
                    <div className="h-full rounded-full bg-purple-500 transition-colors duration-200" style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {nextGoal.type === 'money'
                      ? `${formatBRL(nextGoal.current)} / ${formatBRL(nextGoal.target)}`
                      : `${nextGoal.current}/${nextGoal.target}`}
                  </p>
                </>
              )}
              {completed.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {completed.map((g, i) => (
                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-600'}`}>
                      ✓ {g.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* P4: Earnings Forecast */}
        {earningsForecast > 0 && (
          <div className={`rounded-2xl border p-5 mb-8 ${isDark ? 'bg-teal-500/5 border-teal-500/20' : 'bg-teal-50 border-teal-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-teal-500" />
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Earnings forecast</span>
            </div>
            <p className={`text-2xl font-semibold tabular-nums mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatBRL(earningsForecast)}</p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              If all pre-filled clients convert (avg ticket $2,000 × {(dashboard.partner?.commission_rate * 100 || 50).toFixed(0)}% commission)
            </p>
          </div>
        )}

        {/* P3: Conversion Funnel */}
        {funnelData.length > 0 && funnelData[0].count > 0 && (
          <div className={`rounded-2xl border p-5 mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <BarChart3 className="inline w-4 h-4 mr-1.5 text-emerald-500" />
              Conversion funnel
            </h3>
            <div className="space-y-2.5">
              {funnelData.map((step, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{step.label}</span>
                    <span className={`text-xs font-semibold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{step.count} ({step.pct}%)</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <div className={`h-full rounded-full ${step.color} transition-all`} style={{ width: `${step.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* P7: UTM Link Builder */}
        <div className={`rounded-2xl border p-5 mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <button
            onClick={() => setShowUtm(s => !s)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-indigo-500" />
              <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>UTM link generator</span>
            </div>
            {showUtm ? <ChevronUp className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} /> : <ChevronDown className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />}
          </button>
          {showUtm && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'source', label: 'Fonte', placeholder: 'whatsapp', options: ['whatsapp', 'instagram', 'linkedin', 'email', 'outro'] },
                  { key: 'medium', label: 'Meio', placeholder: 'social', options: ['social', 'direct', 'email', 'referral', 'ads'] },
                  { key: 'campaign', label: 'Campanha', placeholder: 'indicacao', options: ['indicacao', 'cold_outreach', 'evento', 'offline'] },
                ].map(field => (
                  <div key={field.key}>
                    <label className={`block text-[10px] font-semibold uppercase tracking-wide mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{field.label}</label>
                    <select
                      value={utm[field.key]}
                      onChange={e => setUtm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className={`w-full px-2 py-1.5 text-xs rounded-lg border outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                    >
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <code className={`flex-1 text-[10px] tabular-nums truncate ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{utmLink}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(utmLink); toast.success('Link UTM copiado!'); }}
                  className={`flex-shrink-0 p-1 rounded transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Earnings timeline — P4: BarChart */}
          <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Commissions by month</h3>
            {earningsTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={earningsTimeline} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={v => formatBRL(v)}
                    contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 12 }}
                  />
                  <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={`flex items-center justify-center h-[200px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                <p className="text-sm">Insufficient data for chart</p>
              </div>
            )}
          </div>

          {/* F5 + Status distribution */}
          <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Status distribution</h3>
            {statusDistribution.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                      {statusDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusDistribution.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{s.name}: {s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`flex items-center justify-center h-[200px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                <p className="text-sm">No clients yet</p>
              </div>
            )}
          </div>
        </div>

        {/* F5: Conversion Donut */}
        {conversionData.length > 0 && (
          <div className={`border rounded-2xl p-6 mt-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Target className="inline w-4 h-4 mr-1.5 text-emerald-500" />
              Sales Conversion Rate
            </h3>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width={180} height={160}>
                <PieChart>
                  <Pie data={conversionData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={45} startAngle={90} endAngle={-270}>
                    {conversionData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div>
                <div className="space-y-3">
                  {conversionData.map((d, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <div>
                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{d.value} clientes</p>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{d.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`mt-3 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Conversion rate</p>
                  <p className={`text-xl font-semibold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{summary.conversion_rate}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* P2: Partner Ranking */}
        {ranking.length > 0 && (
          <div className={`border rounded-2xl p-6 mt-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Star className="w-4 h-4 text-amber-500" />
              Ranking de Parceiros
            </h3>
            <div className="space-y-2">
              {ranking.map((r, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${i === 0 ? 'bg-amber-400 text-amber-900' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                    {r.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{r.name}</p>
                    <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.company}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-semibold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{r.total_sales} vendas</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowQr(false)} />
          <div className={`relative w-full max-w-sm rounded-2xl border shadow-2xl p-6 text-center ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>QR Code do seu link</h3>
            <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Imprima ou compartilhe para seus clientes escanearem</p>
            <div className="flex justify-center mb-5">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(partner.referral_link)}&bgcolor=ffffff&color=000000`}
                alt="QR Code de indicação"
                className="w-48 h-48 rounded-xl border border-slate-200"
              />
            </div>
            <p className={`text-xs tabular-nums mb-5 break-all ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{partner.referral_link}</p>
            <div className="flex gap-3">
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(partner.referral_link)}&bgcolor=ffffff&color=000000&format=png`}
                download="qrcode-valuora.png"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:brightness-110 transition-colors duration-200 text-center"
              >
                Download PNG
              </a>
              <button
                onClick={() => setShowQr(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
