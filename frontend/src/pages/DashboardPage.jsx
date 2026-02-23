import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, FileText, TrendingUp, Search, Filter, ArrowUpDown,
  LayoutGrid, List, Bell, ChevronRight, Clock, DollarSign,
  Shield, BarChart3, Sparkles, ArrowRight, X, Menu,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';

// ─── Helpers ─────────────────────────────────────────────
const formatBRL = (v) => {
  if (!v) return '—';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

const relativeTime = (dateStr) => {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('pt-BR');
};

const STATUS_MAP = {
  completed: { label: 'Concluída', color: 'green' },
  processing: { label: 'Processando', color: 'yellow' },
  draft: { label: 'Rascunho', color: 'slate' },
};

const SECTOR_COLORS = [
  '#059669', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316',
  '#84cc16', '#a855f7', '#0ea5e9', '#e11d48', '#22d3ee',
  '#facc15', '#4ade80',
];

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Mais recente' },
  { value: 'date_asc', label: 'Mais antiga' },
  { value: 'value_desc', label: 'Maior valor' },
  { value: 'value_asc', label: 'Menor valor' },
  { value: 'name_asc', label: 'A → Z' },
  { value: 'name_desc', label: 'Z → A' },
];

export default function DashboardPage() {
  const { user, fetchUser } = useAuthStore();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [sort, setSort] = useState('date_desc');
  const [viewMode, setViewMode] = useState('grid'); // grid | list

  // Notifications
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetchUser();
    api.get('/analyses/')
      .then((res) => setAnalyses(res.data))
      .finally(() => setLoading(false));
  }, []);

  // ─── Derived data ────────────────────────────────────
  const completedAnalyses = useMemo(() => analyses.filter(a => a.status === 'completed'), [analyses]);

  const kpis = useMemo(() => {
    const vals = completedAnalyses.map(a => a.equity_value).filter(Boolean);
    return {
      total: analyses.length,
      avgValue: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0,
      maxValue: vals.length ? Math.max(...vals) : 0,
      avgRisk: completedAnalyses.length
        ? completedAnalyses.reduce((s, a) => s + (a.risk_score || 0), 0) / completedAnalyses.length
        : 0,
    };
  }, [analyses, completedAnalyses]);

  const sectorData = useMemo(() => {
    const map = {};
    analyses.forEach(a => {
      const s = a.sector || 'Outros';
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value], i) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: SECTOR_COLORS[i % SECTOR_COLORS.length],
    }));
  }, [analyses]);

  const valueTimeline = useMemo(() => {
    return completedAnalyses
      .filter(a => a.equity_value)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(a => ({
        date: new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        valor: a.equity_value,
        name: a.company_name,
      }));
  }, [completedAnalyses]);

  const recentActivity = useMemo(() => {
    return [...analyses]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6)
      .map(a => ({
        id: a.id,
        company: a.company_name,
        status: a.status,
        time: relativeTime(a.created_at),
        value: a.equity_value,
      }));
  }, [analyses]);

  const sectors = useMemo(() => {
    const set = new Set(analyses.map(a => a.sector).filter(Boolean));
    return Array.from(set).sort();
  }, [analyses]);

  // ─── Filtered + sorted ──────────────────────────────
  const filtered = useMemo(() => {
    let result = [...analyses];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a => a.company_name?.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    if (sectorFilter !== 'all') result = result.filter(a => a.sector === sectorFilter);

    switch (sort) {
      case 'date_asc': result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
      case 'value_desc': result.sort((a, b) => (b.equity_value || 0) - (a.equity_value || 0)); break;
      case 'value_asc': result.sort((a, b) => (a.equity_value || 0) - (b.equity_value || 0)); break;
      case 'name_asc': result.sort((a, b) => (a.company_name || '').localeCompare(b.company_name || '')); break;
      case 'name_desc': result.sort((a, b) => (b.company_name || '').localeCompare(a.company_name || '')); break;
      default: result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return result;
  }, [analyses, search, statusFilter, sectorFilter, sort]);

  const statusBadge = (status) => {
    const s = STATUS_MAP[status] || STATUS_MAP.draft;
    const colors = {
      green: isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600',
      yellow: isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600',
      slate: isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500',
    };
    return <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${colors[s.color]}`}>{s.label}</span>;
  };

  // ─── Sidebar offset ──────────────────────────────────
  const ml = sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[240px]';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className={`transition-all duration-300 ${ml}`}>
        {/* ─── Top bar ───────────────────────────────────── */}
        <header className={`sticky top-0 z-30 h-16 flex items-center justify-between px-4 md:px-8 border-b backdrop-blur-xl ${isDark ? 'bg-slate-950/80 border-slate-800/60' : 'bg-slate-50/80 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            {/* Hamburger for mobile */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={`md:hidden p-2 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className={`text-base md:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Olá, {user?.full_name?.split(' ')[0] || 'Usuário'} 👋
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <Bell className="w-4.5 h-4.5" />
                {recentActivity.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className={`absolute right-0 top-12 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                      <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Notificações</span>
                      <button onClick={() => setShowNotifications(false)} className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {recentActivity.length === 0 ? (
                        <p className={`text-sm text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma notificação</p>
                      ) : recentActivity.map((a, i) => (
                        <Link
                          key={i}
                          to={`/analise/${a.id}`}
                          onClick={() => setShowNotifications(false)}
                          className={`flex items-start gap-3 px-4 py-3 transition ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            a.status === 'completed' ? 'bg-green-500/10' : a.status === 'processing' ? 'bg-yellow-500/10' : isDark ? 'bg-slate-800' : 'bg-slate-100'
                          }`}>
                            {a.status === 'completed' ? <BarChart3 className="w-3.5 h-3.5 text-green-400" /> :
                             a.status === 'processing' ? <Clock className="w-3.5 h-3.5 text-yellow-400" /> :
                             <FileText className="w-3.5 h-3.5 text-slate-400" />}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{a.company}</p>
                            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {a.status === 'completed' ? 'Análise concluída' : a.status === 'processing' ? 'Processando...' : 'Rascunho criado'} · {a.time}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <Link
              to="/nova-analise"
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova análise</span>
            </Link>
          </div>
        </header>

        <main className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px]">
          {loading ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Carregando dados...</span>
              </div>
            </div>
          ) : analyses.length === 0 ? (
            /* ─── Onboarding ───────────────────────────── */
            <div className="max-w-2xl mx-auto py-8 md:py-16">
              <div className={`rounded-2xl border-2 border-dashed p-6 md:p-12 text-center ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/20">
                  <Sparkles className="w-9 h-9 text-white" />
                </div>
                <h2 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Bem-vindo ao Quanto Vale!
                </h2>
                <p className={`text-base mb-2 max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Descubra o valor real da sua empresa com análise profissional baseada em DCF e dados oficiais do IBGE.
                </p>
                <p className={`text-sm mb-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Comece criando sua primeira análise de valuation.
                </p>

                <Link
                  to="/nova-analise"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-2xl shadow-emerald-600/25"
                >
                  <Plus className="w-5 h-5" />
                  Criar minha primeira análise
                </Link>

                <div className={`mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 border-t pt-8 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  {[
                    { icon: FileText, title: 'Insira os dados', desc: 'Receita, margem e crescimento' },
                    { icon: BarChart3, title: 'Motor DCF calcula', desc: 'Valuation automático' },
                    { icon: TrendingUp, title: 'Receba o relatório', desc: 'PDF executivo completo' },
                  ].map((s, i) => (
                    <div key={i} className="text-center">
                      <s.icon className={`w-5 h-5 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.title}</p>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ─── KPI Cards ─────────────────────────── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total de Análises', value: kpis.total, icon: FileText, color: 'blue', format: (v) => v },
                  { label: 'Valor Médio', value: kpis.avgValue, icon: DollarSign, color: 'emerald', format: formatBRL },
                  { label: 'Maior Valuation', value: kpis.maxValue, icon: TrendingUp, color: 'purple', format: formatBRL },
                  { label: 'Risco Médio', value: kpis.avgRisk, icon: Shield, color: 'orange', format: (v) => `${v.toFixed(1)}/100` },
                ].map((kpi, i) => {
                  const gradients = {
                    blue: 'from-emerald-500 to-emerald-600',
                    emerald: 'from-emerald-500 to-cyan-500',
                    purple: 'from-purple-500 to-violet-500',
                    orange: 'from-orange-500 to-amber-500',
                  };
                  return (
                    <div key={i} className={`rounded-2xl border p-4 md:p-5 transition ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[10px] md:text-xs font-medium uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {kpi.label}
                        </span>
                        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br ${gradients[kpi.color]} flex items-center justify-center`}>
                          <kpi.icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                        </div>
                      </div>
                      <p className={`text-lg md:text-2xl font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{kpi.format(kpi.value)}</p>
                    </div>
                  );
                })}
              </div>

              {/* ─── Charts row ────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
                {/* Pie chart */}
                <div className={`lg:col-span-2 rounded-2xl border p-4 md:p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Distribuição por Setor</h3>
                  {sectorData.length > 0 ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie
                            data={sectorData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={72}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                          >
                            {sectorData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDark ? '#0f172a' : '#fff',
                              border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                              borderRadius: '10px',
                              fontSize: '12px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-1.5 max-h-[160px] overflow-y-auto">
                        {sectorData.map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                            <span className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.name}</span>
                            <span className={`text-xs font-semibold ml-auto ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className={`text-sm text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados</p>
                  )}
                </div>

                {/* Timeline chart */}
                <div className={`lg:col-span-3 rounded-2xl border p-4 md:p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Evolução de Valuations</h3>
                  {valueTimeline.length > 1 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={valueTimeline}>
                        <defs>
                          <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#059669" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                        <Tooltip
                          formatter={(v) => formatBRL(v)}
                          labelFormatter={(l) => l}
                          contentStyle={{
                            backgroundColor: isDark ? '#0f172a' : '#fff',
                            border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                            borderRadius: '10px',
                            fontSize: '12px',
                          }}
                        />
                        <Area type="monotone" dataKey="valor" stroke="#059669" fill="url(#valGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className={`flex items-center justify-center h-[160px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                      <p className="text-sm">Crie mais análises para visualizar a evolução</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Activity Timeline ─────────────────── */}
              <div className={`rounded-2xl border p-4 md:p-6 mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Atividade Recente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentActivity.map((a, i) => (
                    <Link
                      key={i}
                      to={`/analise/${a.id}`}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        a.status === 'completed' ? 'bg-green-500/10' : a.status === 'processing' ? 'bg-yellow-500/10' : isDark ? 'bg-slate-800' : 'bg-slate-100'
                      }`}>
                        {a.status === 'completed' ? <BarChart3 className="w-4 h-4 text-green-400" /> :
                         a.status === 'processing' ? <Clock className="w-4 h-4 text-yellow-400" /> :
                         <FileText className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{a.company}</p>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {a.value ? formatBRL(a.value) : STATUS_MAP[a.status]?.label || 'Rascunho'} · {a.time}
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                    </Link>
                  ))}
                </div>
              </div>

              {/* ─── Filters bar ───────────────────────── */}
              <div className={`sticky top-16 z-20 rounded-2xl border px-3 md:px-5 py-3 mb-6 flex flex-wrap items-center gap-2 md:gap-3 backdrop-blur-xl ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200 shadow-sm'}`}>
                {/* Search */}
                <div className="relative flex-1 min-w-[140px] md:min-w-[180px]">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition ${isDark ? 'bg-slate-800 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-emerald-500/50' : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-200'}`}
                  />
                </div>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`px-2 md:px-3 py-2 rounded-lg text-sm outline-none cursor-pointer transition ${isDark ? 'bg-slate-800 text-slate-300 focus:ring-1 focus:ring-emerald-500/50' : 'bg-slate-50 text-slate-600 focus:ring-1 focus:ring-emerald-200'}`}
                >
                  <option value="all">Status</option>
                  <option value="completed">Concluída</option>
                  <option value="processing">Processando</option>
                  <option value="draft">Rascunho</option>
                </select>

                {/* Sector filter */}
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className={`hidden sm:block px-2 md:px-3 py-2 rounded-lg text-sm outline-none cursor-pointer transition ${isDark ? 'bg-slate-800 text-slate-300 focus:ring-1 focus:ring-emerald-500/50' : 'bg-slate-50 text-slate-600 focus:ring-1 focus:ring-emerald-200'}`}
                >
                  <option value="all">Todos os setores</option>
                  {sectors.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>

                {/* Sort */}
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className={`hidden sm:block px-2 md:px-3 py-2 rounded-lg text-sm outline-none cursor-pointer transition ${isDark ? 'bg-slate-800 text-slate-300 focus:ring-1 focus:ring-emerald-500/50' : 'bg-slate-50 text-slate-600 focus:ring-1 focus:ring-emerald-200'}`}
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {/* View toggle */}
                <div className={`flex rounded-lg overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 transition ${viewMode === 'grid' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 transition ${viewMode === 'list' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ─── Results count ─────────────────────── */}
              <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {filtered.length} {filtered.length === 1 ? 'análise encontrada' : 'análises encontradas'}
                {(search || statusFilter !== 'all' || sectorFilter !== 'all') && (
                  <button onClick={() => { setSearch(''); setStatusFilter('all'); setSectorFilter('all'); }} className="ml-2 text-emerald-500 hover:text-emerald-400 transition">
                    Limpar filtros
                  </button>
                )}
              </p>

              {filtered.length === 0 ? (
                <div className={`text-center py-16 rounded-2xl border border-dashed ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <Search className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                  <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma análise encontrada com esses filtros.</p>
                </div>
              ) : viewMode === 'grid' ? (
                /* ─── Grid View ──────────────────────── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((a) => (
                    <Link
                      key={a.id}
                      to={`/analise/${a.id}`}
                      className={`group relative rounded-2xl border p-6 transition-all ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-200 hover:shadow-lg'}`}
                    >
                      <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-gradient-to-br from-emerald-500/3 to-transparent' : 'bg-gradient-to-br from-emerald-50/50 to-transparent'}`} />
                      <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-xs font-medium text-emerald-500 uppercase tracking-wide">{a.sector}</span>
                          </div>
                          {statusBadge(a.status)}
                        </div>

                        <h3 className={`font-semibold mb-1 group-hover:text-emerald-500 transition truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {a.company_name}
                        </h3>

                        {a.equity_value ? (
                          <p className={`text-2xl font-bold mt-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatBRL(a.equity_value)}</p>
                        ) : (
                          <p className={`text-sm mt-3 italic ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>Aguardando resultado</p>
                        )}

                        <div className={`flex items-center justify-between mt-4 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {new Date(a.created_at).toLocaleDateString('pt-BR')}
                          </span>
                          <ArrowRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                /* ─── List/Table View ────────────────── */
                <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className={isDark ? 'border-b border-slate-800' : 'border-b border-slate-200'}>
                        {['Empresa', 'Setor', 'Valor', 'Status', 'Risco', 'Data'].map((h) => (
                          <th key={h} className={`text-left text-xs font-semibold uppercase tracking-wide px-5 py-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((a) => (
                        <tr
                          key={a.id}
                          onClick={() => navigate(`/analise/${a.id}`)}
                          className={`cursor-pointer transition ${isDark ? 'hover:bg-slate-800/60 border-b border-slate-800/50' : 'hover:bg-slate-50 border-b border-slate-100'}`}
                        >
                          <td className="px-5 py-4">
                            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{a.company_name}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-xs font-medium text-emerald-500 uppercase">{a.sector}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {a.equity_value ? formatBRL(a.equity_value) : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4">{statusBadge(a.status)}</td>
                          <td className="px-5 py-4">
                            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {a.risk_score ? `${a.risk_score.toFixed(1)}` : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {new Date(a.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
