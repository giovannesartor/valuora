import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BarChart3, CreditCard, TrendingUp,
  FileText, DollarSign, Activity, Briefcase,
  Key, Calendar, CheckCircle, Ban, Banknote, ChevronDown, ChevronUp, AlertCircle,
  Search, Download, Filter, X, Printer,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import formatBRL from '../lib/formatBRL';
import ConfirmDialog from '../components/ConfirmDialog';
import { usePageTitle } from '../lib/usePageTitle';
import { useTheme } from '../context/ThemeContext';

const PIX_LABELS = { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', phone: 'Telefone', random: 'Chave Aleatória' };

export default function AdminDashboardPage() {
  const { user, fetchUser } = useAuthStore();
  const { isDark } = useTheme();
  usePageTitle('Admin');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [payoutSummary, setPayoutSummary] = useState([]);
  const [expandedPartner, setExpandedPartner] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [adminTab, setAdminTab] = useState('overview'); // overview | payouts
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [payoutConfirm, setPayoutConfirm] = useState({ open: false, partnerId: null, partnerName: '' });

  // A1: Revenue timeline
  const [revenueTimeline, setRevenueTimeline] = useState([]);

  // A1: All-time stats snapshot for delta
  const [statsAll, setStatsAll] = useState(null);

  // A2: Dismissed alerts
  const [dismissedAlerts, setDismissedAlerts] = useState([]);

  // A3: User search modal
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  // Revenue breakdown by plan
  const [planBreakdown, setPlanBreakdown] = useState([]);

  // A2: Period filter
  const [periodFilter, setPeriodFilter] = useState('all');

  const loadPayoutSummary = () => {
    setPayoutLoading(true);
    api.get('/partners/admin/payout-summary').then(r => setPayoutSummary(r.data.partners || [])).catch(() => {}).finally(() => setPayoutLoading(false));
  };

  useEffect(() => {
    fetchUser();
    loadPayoutSummary();
  }, []);

  // Reload stats when period changes
  useEffect(() => {
    setLoading(true);
    const params = periodFilter !== 'all' ? `?period=${periodFilter}` : '';
    api.get(`/admin/stats${params}`)
      .then((res) => {
        setStats(res.data);
        if (periodFilter === 'all') setStatsAll(res.data); // A1: cache all-time snapshot
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    api.get('/partners/admin/all').then(r => setPartners(r.data)).catch(() => {});
    api.get('/admin/revenue-timeline?months=6').then(r => setRevenueTimeline(r.data)).catch(() => {});
    api.get('/admin/plan-breakdown').then(r => setPlanBreakdown(r.data)).catch(() => {});
  }, [periodFilter]);

  const handleBulkPayout = (partnerId, partnerName) => {
    setPayoutConfirm({ open: true, partnerId, partnerName: partnerName || 'este parceiro' });
  };

  const confirmBulkPayout = async () => {
    const { partnerId, partnerName } = payoutConfirm;
    setPayoutConfirm({ open: false, partnerId: null, partnerName: '' });
    setActionLoading(partnerId);
    try {
      const res = await api.post(`/partners/admin/partners/${partnerId}/payout`);
      toast.success(res.data.message || 'Payout realizado com sucesso!');
      loadPayoutSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao processar payout.');
    } finally {
      setActionLoading(null);
    }
  };

  // A6: Bulk approve — single API call
  const handleApproveAll = async (partnerId) => {
    setActionLoading(`approve-${partnerId}`);
    try {
      const res = await api.post(`/admin/bulk-approve/${partnerId}`);
      toast.success(res.data.message || 'Comissões aprovadas!');
      loadPayoutSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao aprovar.');
    } finally {
      setActionLoading(null);
    }
  };


  const statCards = stats
    ? [
        { label: 'Total Usuários', value: stats.total_users, rawValue: stats.total_users, allKey: 'total_users', icon: Users, iconColor: 'text-blue-500' },
        { label: 'Análises', value: stats.total_analyses, rawValue: stats.total_analyses, allKey: 'total_analyses', icon: BarChart3, iconColor: 'text-teal-500' },
        { label: 'Pagamentos', value: stats.total_payments, rawValue: stats.total_payments, allKey: 'total_payments', icon: CreditCard, iconColor: 'text-green-500' },
        { label: 'Receita Total', value: formatBRL(stats.total_revenue), rawValue: stats.total_revenue, allKey: 'total_revenue', icon: DollarSign, iconColor: 'text-emerald-500' },
        { label: 'Usuarios recentes', value: stats.recent_users, rawValue: stats.recent_users, allKey: 'recent_users', icon: TrendingUp, iconColor: 'text-purple-500' },
        { label: 'Concluídas', value: stats.completed_analyses, rawValue: stats.completed_analyses, allKey: 'completed_analyses', icon: Activity, iconColor: 'text-orange-500' },
      ]
    : [];

  // A5: Export admin CSV
  const handleAdminExport = () => {
    if (!stats) return;
    const headers = ['Métrica', 'Valor'];
    const rows = [
      ['Total Usuários', stats.total_users],
      ['Verificados', stats.verified_users],
      ['Análises', stats.total_analyses],
      ['Concluídas', stats.completed_analyses],
      ['Pagamentos', stats.total_payments],
      ['Pagos', stats.paid_payments],
      ['Receita Total', stats.total_revenue],
      ['Usuários Recentes', stats.recent_users],
      ['Usuários c/ Análises', stats.users_with_analyses],
      ['Usuários c/ Pagamentos', stats.users_with_payments],
    ];
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado!');
  };

  // A4: Export admin PDF (html summary printed)
  const handleAdminPdfExport = () => {
    if (!stats) return;
    const lines = [
      `Relatório Administrativo — ${new Date().toLocaleDateString('pt-BR')}`,
      `Período: ${{'all':'Todo período','7d':'Últimos 7 dias','30d':'Últimos 30 dias','90d':'Últimos 90 dias'}[periodFilter]}`,
      '',
      `Total Usuários: ${stats.total_users}`,
      `Verificados: ${stats.verified_users}`,
      `Análises: ${stats.total_analyses}`,
      `Concluídas: ${stats.completed_analyses}`,
      `Pagamentos: ${stats.total_payments}`,
      `Receita Total: ${formatBRL(stats.total_revenue)}`,
      `Usuários c/ Análises: ${stats.users_with_analyses}`,
      `Usuários c/ Pagamentos: ${stats.users_with_payments}`,
    ];
    const win = window.open('', '_blank');
    win.document.write(`<pre style="font-family:monospace;font-size:14px;padding:24px">${lines.join('\n')}</pre>`);
    win.document.close();
    win.print();
  };

  // A3: User search handler
  const handleUserSearch = async (q) => {
    if (!q.trim()) { setUserSearchResults([]); return; }
    setUserSearchLoading(true);
    try {
      const res = await api.get('/admin/users', { params: { search: q, page_size: 10 } });
      setUserSearchResults(res.data.items || res.data || []);
    } catch {
      setUserSearchResults([]);
    } finally {
      setUserSearchLoading(false);
    }
  };

  const chartData = stats ? [
    { name: 'Usuários', total: stats.total_users, verified: stats.verified_users },
    { name: 'Análises', total: stats.total_analyses, verified: stats.completed_analyses },
    { name: 'Pagamentos', total: stats.total_payments, verified: stats.paid_payments },
  ] : [];

  const pieData = stats ? [
    { name: 'Verificados', value: stats.verified_users, color: '#10b981' },
    { name: 'Não verif.', value: Math.max(0, stats.total_users - stats.verified_users), color: '#64748b' },
  ] : [];

  return (
    <>
      <main className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className={`text-xl md:text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel Administrativo</h1>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Bem-vindo, {user?.full_name?.split(' ')[0] || 'Admin'}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              SUPERADMIN
            </div>
          </div>

          {/* A2: Period filter + A5: Export + A3: Search + A4: PDF */}
          {!loading && (
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <Filter className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer transition ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'} border`}
              >
                <option value="all">Todo período</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
              </select>
              <button
                onClick={handleAdminExport}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
              {/* A4: PDF export */}
              <button
                onClick={handleAdminPdfExport}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                <Printer className="w-3.5 h-3.5" />
                PDF
              </button>
              {/* A3: User search */}
              <button
                onClick={() => setUserSearchOpen(true)}
                className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                <Search className="w-3.5 h-3.5" />
                Buscar usuário
              </button>
            </div>
          )}

          {/* A2: Automatic alert strips */}
          {!loading && stats && (() => {
            const totalPending = payoutSummary.reduce((s, p) => s + (p.pending || 0), 0);
            const convRate = stats.total_users > 0 ? stats.users_with_payments / stats.total_users : 1;
            const alerts = [
              totalPending > 0 && !dismissedAlerts.includes('pending') && {
                id: 'pending', type: 'warning',
                msg: `${formatBRL(totalPending)} em comissões pendentes de aprovação para parceiros.`,
              },
              (convRate < 0.1 && stats.total_users > 10) && !dismissedAlerts.includes('conv') && {
                id: 'conv', type: 'info',
                msg: `Taxa de conversão baixa: ${(convRate * 100).toFixed(1)}% dos usuários pagaram.`,
              },
            ].filter(Boolean);
            if (!alerts.length) return null;
            return (
              <div className="space-y-2 mb-6">
                {alerts.map(alert => (
                  <div key={alert.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm ${
                    alert.type === 'warning'
                      ? (isDark ? 'bg-amber-500/5 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700')
                      : (isDark ? 'bg-blue-500/5 border-blue-500/20 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700')
                  }`}>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{alert.msg}</span>
                    </div>
                    <button onClick={() => setDismissedAlerts(prev => [...prev, alert.id])} className="ml-4 opacity-60 hover:opacity-100 transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* A3: User search modal */}
          {userSearchOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setUserSearchOpen(false); setUserSearchQuery(''); setUserSearchResults([]); }} />
              <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="p-5">
                  <div className={`flex items-center gap-3 mb-4 border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <Search className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Buscar por nome ou email..."
                      value={userSearchQuery}
                      onChange={e => { setUserSearchQuery(e.target.value); handleUserSearch(e.target.value); }}
                      className={`flex-1 outline-none text-sm bg-transparent ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
                    />
                    <button onClick={() => { setUserSearchOpen(false); setUserSearchQuery(''); setUserSearchResults([]); }}>
                      <X className={`w-4 h-4 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`} />
                    </button>
                  </div>
                  {userSearchLoading && <p className={`text-sm text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Buscando...</p>}
                  {!userSearchLoading && userSearchResults.length === 0 && userSearchQuery.length > 1 && (
                    <p className={`text-sm text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum usuário encontrado.</p>
                  )}
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {userSearchResults.map((u, i) => (
                      <Link
                        key={i}
                        to="/admin/usuarios"
                        onClick={() => { setUserSearchOpen(false); setUserSearchQuery(''); setUserSearchResults([]); }}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                          <span className="text-xs font-semibold text-emerald-500">{(u.full_name || u.email || '?')[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{u.full_name || '—'}</p>
                          <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{u.email}</p>
                        </div>
                        {u.is_verified && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">Verificado</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="animate-pulse grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className={`h-10 w-10 rounded-xl mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className={`h-7 w-20 rounded mb-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className={`h-4 w-28 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {statCards.map((card, i) => (
                  <div key={i} className={`rounded-2xl border p-5 md:p-6 transition-colors duration-200 ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-300 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                        <card.icon className={`w-4 h-4 md:w-5 md:h-5 ${card.iconColor}`} />
                      </div>
                      {/* A1: Period delta badge */}
                      {periodFilter !== 'all' && statsAll && card.allKey && (() => {
                        const allVal = statsAll[card.allKey];
                        if (!allVal || allVal === 0) return null;
                        const pct = Math.round((card.rawValue / allVal) * 100);
                        return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>{pct}% do total</span>;
                      })()}
                    </div>
                    <p className={`text-xl md:text-2xl font-semibold tabular-nums mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{card.value}</p>
                    <p className={`text-xs md:text-sm font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid lg:grid-cols-2 gap-6 mb-8">

                {/* A1: Revenue Timeline */}
                {revenueTimeline.length > 0 && (
                  <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <DollarSign className="inline w-4 h-4 mr-1.5 text-emerald-500" />
                      Receita Mensal
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={revenueTimeline}>
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 12 }} formatter={v => [formatBRL(v), 'Receita']} />
                        <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revenueGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Visão geral</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 12 }} />
                      <Bar dataKey="total" fill="#64748b" radius={[6, 6, 0, 0]} name="Total" />
                      <Bar dataKey="verified" fill="#10b981" radius={[6, 6, 0, 0]} name="Ativos" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Usuários verificados</h3>
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={45}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderRadius: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {pieData.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{s.name}: {s.value}</span>
                        </div>
                      ))}
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {stats.verified_users && stats.total_users ? `${((stats.verified_users / stats.total_users) * 100).toFixed(0)}% verificados` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* A7: Conversion Funnel */}
              {stats && (
                <div className={`rounded-2xl border p-6 mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <TrendingUp className="inline w-4 h-4 mr-1.5 text-teal-500" />
                      Funil de Conversão
                    </h3>
                    {stats.total_users > 0 && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                        Taxa final: {stats.total_users > 0 ? Math.round((stats.users_with_payments / stats.total_users) * 100) : 0}%
                      </span>
                    )}
                  </div>
                  <div className="space-y-4">
                    {(() => {
                      const steps = [
                        { label: 'Cadastrados', value: stats.total_users, color: 'bg-blue-500', textColor: isDark ? 'text-blue-400' : 'text-blue-600' },
                        { label: 'Verificados', value: stats.verified_users ?? stats.total_users, color: 'bg-indigo-500', textColor: isDark ? 'text-indigo-400' : 'text-indigo-600' },
                        { label: 'Criaram análise', value: stats.users_with_analyses, color: 'bg-teal-500', textColor: isDark ? 'text-teal-400' : 'text-teal-600' },
                        { label: 'Pagaram', value: stats.users_with_payments, color: 'bg-emerald-500', textColor: isDark ? 'text-emerald-400' : 'text-emerald-600' },
                      ];
                      const base = stats.total_users || 1;
                      return steps.map((step, i) => {
                        const pct = Math.round((step.value / base) * 100);
                        const dropOff = i > 0 ? steps[i - 1].value - step.value : 0;
                        const dropPct = i > 0 && steps[i - 1].value > 0 ? Math.round((dropOff / steps[i - 1].value) * 100) : 0;
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                  {i + 1}. {step.label}
                                </span>
                                {dropOff > 0 && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500'}`}>
                                    -{dropPct}%
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-semibold tabular-nums ${step.textColor}`}>{step.value.toLocaleString('pt-BR')}</span>
                                <span className={`text-xs w-10 text-right ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{pct}%</span>
                              </div>
                            </div>
                            <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                              <div className={`h-full rounded-full ${step.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {stats.total_users > 0 && (
                    <div className={`mt-5 pt-4 border-t grid grid-cols-3 gap-4 text-center ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <div>
                        <p className={`text-lg font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {stats.total_users > 0 ? Math.round((stats.users_with_analyses / stats.total_users) * 100) : 0}%
                        </p>
                        <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ativação</p>
                      </div>
                      <div>
                        <p className={`text-lg font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {stats.users_with_analyses > 0 ? Math.round((stats.users_with_payments / stats.users_with_analyses) * 100) : 0}%
                        </p>
                        <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Análise → Pago</p>
                      </div>
                      <div>
                        <p className={`text-lg font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {stats.total_users > 0 ? Math.round((stats.users_with_payments / stats.total_users) * 100) : 0}%
                        </p>
                        <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Conversão total</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Plan breakdown + ticket médio */}
              {planBreakdown.length > 0 && (
                <div className={`rounded-2xl border p-6 mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <CreditCard className="inline w-4 h-4 mr-1.5 text-emerald-500" />
                    Receita por Plano
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {(['essencial','profissional','estrategico']).map((plan) => {
                      const row = planBreakdown.find(r => r.plan === plan) || { count: 0, revenue: 0, avg_ticket: 0 };
                      const planLabels = { essencial: 'Essencial', profissional: 'Profissional', estrategico: 'Estratégico' };
                      return (
                        <div key={plan} className={`rounded-xl p-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{planLabels[plan]}</p>
                          <p className={`text-xl font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatBRL(row.revenue)}</p>
                          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{row.count} venda{row.count !== 1 ? 's' : ''}</p>
                          <p className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Ticket médio: {formatBRL(row.avg_ticket)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab bar: Overview | Payouts */}
              <div className="flex gap-2 mb-6">
                {[
                  { key: 'overview', label: 'Visão Geral', icon: BarChart3 },
                  { key: 'payouts', label: 'Payouts Parceiros', icon: Banknote },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setAdminTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                      adminTab === tab.key
                        ? 'bg-emerald-600 text-white'
                        : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {adminTab === 'overview' && (
                <>
                  {/* Partner Management */}
                  {partners.length > 0 && (
                    <div className={`rounded-2xl border p-6 mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          <Briefcase className="inline w-4 h-4 mr-2 text-emerald-500" />
                          Parceiros ({partners.length})
                        </h3>
                        <div className="relative w-48">
                          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input
                            value={partnerSearch}
                            onChange={e => setPartnerSearch(e.target.value)}
                            placeholder="Buscar parceiro..."
                            className={`w-full pl-9 pr-3 py-1.5 border rounded-lg text-sm outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                          />
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className={isDark ? 'border-b border-slate-800' : 'border-b border-slate-200'}>
                              {['Empresa', 'Código', 'Status', 'Comissão', 'Clientes'].map(h => (
                                <th key={h} className={`text-left px-4 py-2 text-xs font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {partners.filter(p => {
                              if (!partnerSearch) return true;
                              const q = partnerSearch.toLowerCase();
                              return (p.company_name || '').toLowerCase().includes(q) || (p.referral_code || '').toLowerCase().includes(q);
                            }).map(p => (
                              <tr key={p.id} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                <td className={`px-4 py-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.company_name || '—'}</td>
                                <td className={`px-4 py-3 tabular-nums text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{p.referral_code}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-400'}`}>
                                    {p.status === 'active' ? 'Ativo' : p.status}
                                  </span>
                                </td>
                                <td className={`px-4 py-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{((p.commission_rate || 0) * 100).toFixed(0)}%</td>
                                <td className={`px-4 py-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.total_clients || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Quick links */}
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <Link
                      to="/admin/usuarios"
                      className={`group rounded-2xl border p-6 transition ${isDark ? 'bg-slate-900 border-slate-800 hover:border-emerald-500/50' : 'bg-white border-slate-200 hover:border-emerald-400 shadow-sm'}`}
                    >
                      <Users className="w-6 h-6 text-emerald-400 mb-3" />
                      <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Gerenciar Usuários</h3>
                      <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ativar, desativar, verificar contas.</p>
                    </Link>
                    <Link
                      to="/admin/analises"
                      className={`group rounded-2xl border p-6 transition ${isDark ? 'bg-slate-900 border-slate-800 hover:border-teal-500/50' : 'bg-white border-slate-200 hover:border-teal-400 shadow-sm'}`}
                    >
                      <FileText className="w-6 h-6 text-teal-400 mb-3" />
                      <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Ver Análises</h3>
                      <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Todas as análises da plataforma.</p>
                    </Link>
                    <Link
                      to="/admin/pagamentos"
                      className={`group rounded-2xl border p-6 transition ${isDark ? 'bg-slate-900 border-slate-800 hover:border-green-500/50' : 'bg-white border-slate-200 hover:border-green-400 shadow-sm'}`}
                    >
                      <CreditCard className="w-6 h-6 text-green-400 mb-3" />
                      <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Pagamentos</h3>
                      <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Acompanhar receita e cobranças.</p>
                    </Link>
                  </div>
                </>
              )}

              {/* ─── Payouts Tab ─── */}
              {adminTab === 'payouts' && (
                <div className="space-y-6">
                  {payoutLoading ? (
                    <div className="space-y-4 animate-pulse">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <div className={`h-4 w-20 rounded mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                            <div className={`h-7 w-28 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                          </div>
                        ))}
                      </div>
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <div className={`h-5 w-48 rounded mb-2 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                          <div className={`h-4 w-64 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                        </div>
                      ))}
                    </div>
                  ) : (
                  <>
                  {/* Payout totals summary */}
                  {payoutSummary.length > 0 && (() => {
                    const totPending = payoutSummary.reduce((s, p) => s + (p.pending || 0), 0);
                    const totApproved = payoutSummary.reduce((s, p) => s + (p.approved_awaiting_payout || 0), 0);
                    const totPaid = payoutSummary.reduce((s, p) => s + (p.total_paid || 0), 0);
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                              <AlertCircle className="w-4 h-4 text-amber-500" />
                            </div>
                            <span className={`text-xs font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pendentes</span>
                          </div>
                          <p className="text-xl font-semibold tabular-nums text-amber-500">{formatBRL(totPending)}</p>
                        </div>
                        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-blue-500" />
                            </div>
                            <span className={`text-xs font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Aprovadas (aguardando payout)</span>
                          </div>
                          <p className="text-xl font-semibold tabular-nums text-blue-500">{formatBRL(totApproved)}</p>
                        </div>
                        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                              <Banknote className="w-4 h-4 text-emerald-500" />
                            </div>
                            <span className={`text-xs font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total Pago</span>
                          </div>
                          <p className="text-xl font-semibold tabular-nums text-emerald-500">{formatBRL(totPaid)}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Per-partner payout cards */}
                  {payoutSummary.length === 0 ? (
                    <div className={`rounded-2xl border p-8 text-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <Briefcase className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                      <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>Nenhum parceiro cadastrado.</p>
                    </div>
                  ) : payoutSummary.map(p => (
                    <div key={p.partner_id} className={`rounded-2xl border transition ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                      {/* Header row - always visible */}
                      <button
                        onClick={() => setExpandedPartner(expandedPartner === p.partner_id ? null : p.partner_id)}
                        className="w-full flex items-center justify-between p-5 text-left"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Briefcase className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div className="min-w-0">
                            <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {p.company_name || p.partner_name}
                            </p>
                            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {p.partner_email} · <span className="tabular-nums">{p.referral_code}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          {p.approved_awaiting_payout > 0 && (
                            <span className="bg-blue-500/10 text-blue-500 text-xs font-semibold px-2.5 py-1 rounded-full">
                              {formatBRL(p.approved_awaiting_payout)} pronto
                            </span>
                          )}
                          {p.pending > 0 && (
                            <span className="bg-amber-500/10 text-amber-500 text-xs font-semibold px-2.5 py-1 rounded-full">
                              {formatBRL(p.pending)} pendente
                            </span>
                          )}
                          {expandedPartner === p.partner_id
                            ? <ChevronUp className={`w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            : <ChevronDown className={`w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          }
                        </div>
                      </button>

                      {/* Expanded details */}
                      {expandedPartner === p.partner_id && (
                        <div className={`border-t px-5 pb-5 pt-4 space-y-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                          {/* Info grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Chave PIX</p>
                              {p.pix_key ? (
                                <div className="flex items-center gap-2">
                                  <Key className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {PIX_LABELS[p.pix_key_type] || p.pix_key_type}: <span className="tabular-nums">{p.pix_key}</span>
                                  </span>
                                </div>
                              ) : (
                                <span className="flex items-center gap-1 text-amber-500 text-sm">
                                  <Ban className="w-3.5 h-3.5" /> Não cadastrada
                                </span>
                              )}
                            </div>
                            <div>
                              <p className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Dia Payout</p>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                <span className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Todo dia {p.payout_day}</span>
                              </div>
                            </div>
                            <div>
                              <p className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total Vendas</p>
                              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.total_sales}</p>
                            </div>
                            <div>
                              <p className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total Pago</p>
                              <p className="text-sm font-semibold text-emerald-500">{formatBRL(p.total_paid)}</p>
                            </div>
                          </div>

                          {/* Financial breakdown */}
                          <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <p className="text-amber-500 font-semibold tabular-nums text-lg">{formatBRL(p.pending)}</p>
                                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pendentes</p>
                              </div>
                              <div>
                                <p className="text-blue-500 font-semibold tabular-nums text-lg">{formatBRL(p.approved_awaiting_payout)}</p>
                                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Aprovadas</p>
                              </div>
                              <div>
                                <p className="text-emerald-500 font-semibold tabular-nums text-lg">{formatBRL(p.total_paid)}</p>
                                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pagas</p>
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-3">
                            {p.pending > 0 && (
                              <button
                                onClick={() => handleApproveAll(p.partner_id)}
                                disabled={actionLoading === `approve-${p.partner_id}`}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition disabled:opacity-50"
                              >
                                <CheckCircle className="w-4 h-4" />
                                {actionLoading === `approve-${p.partner_id}`
                                  ? 'Aprovando...'
                                  : `Aprovar Pendentes (${formatBRL(p.pending)})`}
                              </button>
                            )}
                            {p.approved_awaiting_payout > 0 && (
                              <button
                                onClick={() => handleBulkPayout(p.partner_id, p.company_name || p.partner_name)}
                                disabled={actionLoading === p.partner_id}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition disabled:opacity-50"
                              >
                                <Banknote className="w-4 h-4" />
                                {actionLoading === p.partner_id ? 'Processando...' : `Pagar Aprovadas (${formatBRL(p.approved_awaiting_payout)})`}
                              </button>
                            )}
                            {!p.pix_key && (
                              <span className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-red-500/10 text-red-400">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Parceiro ainda não cadastrou chave PIX
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Payout Confirmation Dialog */}
      <ConfirmDialog
        open={payoutConfirm.open}
        title="Confirmar pagamento"
        message={`Confirmar pagamento de TODAS as comissões aprovadas de ${payoutConfirm.partnerName}?`}
        confirmLabel="Confirmar Payout"
        variant="default"
        loading={actionLoading === payoutConfirm.partnerId}
        onConfirm={confirmBulkPayout}
        onCancel={() => setPayoutConfirm({ open: false, partnerId: null, partnerName: '' })}
      />
    </>
  );
}
