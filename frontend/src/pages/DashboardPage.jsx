import { useEffect, useState, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import OnboardingTour from '../components/OnboardingTour';
import GlobalSearchModal from '../components/GlobalSearchModal';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Plus, FileText, TrendingUp, Search, Filter, ArrowUpDown,
  LayoutGrid, List, ChevronRight, Clock, DollarSign,
  Shield, BarChart3, Sparkles, ArrowRight, X, Menu,
  Lightbulb, Zap, Crown, Trash2, Star, Download, Bell, CalendarDays, CheckCircle2,
  CheckSquare, Square, Target,
} from 'lucide-react';
const LazyCharts = lazy(() => import('../components/DashboardCharts'));
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import formatBRL from '../lib/formatBRL';

// ─── Helpers ─────────────────────────────────────────────
const fmtBRL = (v) => formatBRL(v, { abbreviate: true });

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

const DAILY_TIPS = [
  { title: 'Ke importa', tip: 'O custo de capital próprio (Ke) é o principal driver do valuation. Pequenas variações podem mudar o resultado em milhões.' },
  { title: 'DLOM reduz o valor', tip: 'Empresas fechadas sofrem desconto de 10-35% pela falta de liquidez. Quanto menor e mais jovem, maior o desconto.' },
  { title: 'Terminal Value', tip: 'Em média 60-80% do valor vem do Terminal Value. Se esse percentual for alto, o valuation depende muito de premissas futuras.' },
  { title: 'Múltiplos setoriais', tip: 'Use EV/EBITDA e EV/Receita do seu setor como referência informativa. No v4 não compõem o valor final.' },
  { title: 'Sobrevivência', tip: 'No modelo v4, a sobrevivência (SEBRAE/IBGE) é embutida diretamente no Valor Terminal — não é desconto separado.' },
  { title: 'Key-Person Risk', tip: 'No v4, o risco do fundador-chave é embutido no Ke como prêmio de 0-4%. Construa equipe para reduzir esse custo.' },
  { title: 'Score Qualitativo', tip: 'Fatores como equipe, mercado, produto, tração e operação ajustam ±15% do valor. Preencha o questionário para maior precisão.' },
];

function useCountAnimation(target, duration = 1500) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (!target) { setCount(0); return; }
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(target * eased);
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => ref.current && cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return count;
}

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const { user, fetchUser } = useAuthStore();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  useOutletContext(); // keep outlet context connected

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [sort, setSort] = useState('date_desc');
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 12;
  const [apiError, setApiError] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: '' });
  const [deleting, setDeleting] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // D1: Date filter
  const [dateFilter, setDateFilter] = useState('all');

  // D2: Favorites — server-side
  const [favorites, setFavorites] = useState([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // U1: Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // U7: Monthly goal
  const [monthlyGoal, setMonthlyGoal] = useState(() => Number(localStorage.getItem('qv_monthly_goal') || 0));
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  // U6: Global search modal
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // D5: Notifications
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const fetchNotifications = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    api.get('/notifications')
      .then(res => setNotifications(res.data))
      .catch(() => {});
  }, []);
  const markNotifAsRead = useCallback((key) => {
    api.patch(`/notifications/${key}/read`).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === key ? { ...n, unread: false } : n));
  }, []);
  const markAllNotifsAsRead = useCallback(() => {
    api.post('/notifications/read-all').catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  }, []);

  // Backend KPIs
  const [backendKpis, setBackendKpis] = useState(null);

  // DU1: User payment history
  const [myPayments, setMyPayments] = useState([]);
  const [showPayments, setShowPayments] = useState(false);

  const loadAnalyses = useCallback(() => {
    setLoading(true);
    setApiError(false);
    const params = new URLSearchParams({ page, page_size: PAGE_SIZE, sort });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (sectorFilter !== 'all') params.set('sector', sectorFilter);
    api.get(`/analyses/?${params}`)
      .then((res) => {
        setAnalyses(res.data.items);
        setTotalPages(res.data.total_pages);
        setTotalCount(res.data.total);
      })
      .catch(() => {
        setApiError(true);
        setAnalyses([]);
      })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, statusFilter, sectorFilter, sort]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [search]);

  // Load server favorites on mount
  useEffect(() => {
    api.get('/analyses/favorites/list')
      .then(res => setFavorites(res.data.favorite_ids || []))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchUser(); }, []);
  useEffect(() => { loadAnalyses(); }, [loadAnalyses]);

  // Fetch KPIs from backend — independent of analyses list, fetch once on mount
  useEffect(() => {
    api.get('/analyses/kpis/summary')
      .then(res => setBackendKpis(res.data))
      .catch(() => setBackendKpis(null));
  }, []);

  // DU1: Load user payments
  useEffect(() => {
    api.get('/payments/mine')
      .then(res => setMyPayments(res.data))
      .catch(() => setMyPayments([]));
  }, []);

  // ─── Derived data ────────────────────────────────────
  const completedAnalyses = useMemo(() => analyses.filter(a => a.status === 'completed'), [analyses]);

  const kpis = useMemo(() => {
    // Use backend KPIs if available (more accurate, includes all pages)
    if (backendKpis) {
      return {
        total: backendKpis.total,
        avgValue: backendKpis.avg_value,
        maxValue: backendKpis.max_value,
        avgRisk: backendKpis.avg_risk,
      };
    }
    // Fallback to client-side calculation
    const vals = completedAnalyses.map(a => a.equity_value).filter(Boolean);
    return {
      total: totalCount || analyses.length,
      avgValue: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0,
      maxValue: vals.length ? Math.max(...vals) : 0,
      avgRisk: completedAnalyses.length
        ? completedAnalyses.reduce((s, a) => s + (a.risk_score || 0), 0) / completedAnalyses.length
        : 0,
    };
  }, [analyses, completedAnalyses, backendKpis]);

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

  // ─── Filtered (server handles search/status/sector/sort, client handles date + favorites) ──
  const filtered = useMemo(() => {
    let result = [...analyses];
    // D2: Favorites-only filter
    if (showFavoritesOnly) result = result.filter(a => favorites.includes(a.id));
    // D1: Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const days = { '7d': 7, '30d': 30, '90d': 90 }[dateFilter] || 0;
      if (days) {
        const cutoff = new Date(now - days * 86400000);
        result = result.filter(a => new Date(a.created_at) >= cutoff);
      }
    }
    // D2: Favorites on top (when not already filtering by favorites only)
    if (!showFavoritesOnly) {
      result.sort((a, b) => {
        const aFav = favorites.includes(a.id) ? 1 : 0;
        const bFav = favorites.includes(b.id) ? 1 : 0;
        return bFav - aFav;
      });
    }
    return result;
  }, [analyses, dateFilter, favorites, showFavoritesOnly]);

  // ─── Delete Analysis ─────────────────────────────
  const handleDeleteAnalysis = (id, name) => {
    setDeleteConfirm({ open: true, id, name: name || 'esta análise' });
  };

  const confirmDeleteAnalysis = async () => {
    setDeleting(true);
    try {
      await api.delete(`/analyses/${deleteConfirm.id}`);
      toast.success('Análise movida para a lixeira.');
      setDeleteConfirm({ open: false, id: null, name: '' });
      loadAnalyses();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao remover análise.');
    } finally {
      setDeleting(false);
    }
  };

  // D2: Toggle favorite (server-side)
  const toggleFavorite = async (id) => {
    const isFav = favorites.includes(id);
    // Optimistic update
    setFavorites(prev => isFav ? prev.filter(f => f !== id) : [...prev, id]);
    try {
      if (isFav) await api.delete(`/analyses/${id}/favorite`);
      else await api.post(`/analyses/${id}/favorite`);
    } catch {
      // Revert on failure
      setFavorites(prev => isFav ? [...prev, id] : prev.filter(f => f !== id));
    }
  };

  // U1: Bulk selection helpers
  const toggleSelectId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(filtered.map(a => a.id)));
  const clearSelection = () => { setSelectedIds(new Set()); setSelectionMode(false); };
  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => api.delete(`/analyses/${id}`)));
      toast.success(`${selectedIds.size} análise(s) removida(s).`);
      clearSelection();
      loadAnalyses();
    } catch { toast.error('Erro ao remover análises.'); }
    finally { setBulkDeleting(false); }
  };
  const handleBulkExportCSV = () => {
    const toExport = filtered.filter(a => selectedIds.has(a.id));
    const headers = ['Empresa', 'Setor', 'Valor (R$)', 'Status', 'Risco', 'Data'];
    const rows = toExport.map(a => [a.company_name, a.sector || '', a.equity_value || '', STATUS_MAP[a.status]?.label || a.status, a.risk_score || '', new Date(a.created_at).toLocaleDateString('pt-BR')]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'analises-selecionadas.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  // U7: Save monthly goal
  const saveMonthlyGoal = () => {
    const val = parseInt(goalInput, 10);
    if (!isNaN(val) && val > 0) {
      setMonthlyGoal(val);
      localStorage.setItem('qv_monthly_goal', val);
    }
    setEditingGoal(false);
  };

  // DU4: Compare analysis selector
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');

  // D3: CSV Export
  const handleExportCSV = () => {
    const headers = ['Empresa', 'Setor', 'Valor (R$)', 'Status', 'Risco', 'Data'];
    const rows = filtered.map(a => [
      a.company_name, a.sector || '', a.equity_value || '',
      STATUS_MAP[a.status]?.label || a.status, a.risk_score || '',
      new Date(a.created_at).toLocaleDateString('pt-BR'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-analises-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  // D8: Keyboard shortcuts — N = new analysis, Ctrl+K / Cmd+K = global search modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
        return;
      }
      if (!isTyping && e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        navigate('/nova-analise');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // D5: Fetch notifications — poll every 60s
  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 60_000);
    const visChange = () => { if (document.visibilityState === 'visible') fetchNotifications(); };
    document.addEventListener('visibilitychange', visChange);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visChange); };
  }, [fetchNotifications]);

  // D7: Weekly progress
  const weeklyProgress = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 86400000);
    const thisWeek = analyses.filter(a => new Date(a.created_at) >= weekAgo);
    return thisWeek.length;
  }, [analyses]);

  const statusBadge = (status) => {
    const s = STATUS_MAP[status] || STATUS_MAP.draft;
    const colors = {
      green: isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600',
      yellow: isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600',
      slate: isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500',
    };
    return <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${colors[s.color]}`}>{s.label}</span>;
  };

  return (
    <>
      <GlobalSearchModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
      {/* ─── Top bar ───────────────────────────────────── */}
      <header className={`sticky top-0 md:top-0 top-14 z-30 h-16 flex items-center justify-between px-4 md:px-8 border-b backdrop-blur-xl ${isDark ? 'bg-slate-950/80 border-slate-800/60' : 'bg-slate-50/80 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <h1 className={`text-base md:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Olá, {user?.full_name?.split(' ')[0] || 'Usuário'} <Sparkles className="inline w-4 h-4 text-amber-400 ml-1" />
          </h1>
        </div>
        <div className="flex items-center gap-3">
            {/* D5: Notifications bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => n.unread) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
                )}
              </button>
              {showNotifications && (
                <div className={`absolute right-0 top-10 w-72 rounded-xl border shadow-xl z-50 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                    <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Notificações</p>
                    {notifications.some(n => n.unread) && (
                      <button
                        onClick={markAllNotifsAsRead}
                        className={`text-[10px] font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'}`}
                      >
                        Marcar tudo como lida
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className={`px-4 py-6 text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma notificação</p>
                  ) : notifications.map(n => {
                    const isUnread = n.unread;
                    return (
                      <div key={n.id} className={`px-4 py-3 border-b last:border-0 ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-50 hover:bg-slate-50'} ${isUnread ? (isDark ? 'bg-emerald-500/5' : 'bg-emerald-50/60') : ''}`}>
                        {n.title && <p className={`text-xs font-semibold mb-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{n.title}</p>}
                        <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{n.text}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{n.time}</p>
                          {isUnread && (
                            <button
                              onClick={() => markNotifAsRead(n.id)}
                              className={`text-[10px] font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'}`}
                            >
                              Marcar como lida
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* D3: CSV Export */}
            <button
              onClick={handleExportCSV}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>

            {/* U1: Bulk selection toggle */}
            <button
              onClick={() => { setSelectionMode(s => !s); setSelectedIds(new Set()); }}
              title="Selecionar várias"
              className={`p-2 rounded-lg transition border ${selectionMode ? (isDark ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-emerald-400 bg-emerald-50 text-emerald-600') : (isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            <Link
              to="/nova-analise"
              data-tour="nova-analise"
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova análise</span>
            </Link>
            <Link
              to="/pitch-deck/novo"
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 transition shadow-lg shadow-purple-600/20"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Pitch Deck</span>
            </Link>
          </div>
        </header>

        <main className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px]">
          {loading ? (
            /* ─── Skeleton Loading ───────────────────── */
            <div className="animate-pulse">
              {/* KPI Skeletons */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`h-3 w-20 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                      <div className={`w-8 h-8 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                    </div>
                    <div className={`h-7 w-28 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  </div>
                ))}
              </div>
              {/* Chart + Activity Skeletons */}
              <div className="grid lg:grid-cols-3 gap-6 mb-8">
                <div className={`lg:col-span-2 rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className={`h-5 w-40 rounded mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className={`h-48 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                </div>
                <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className={`h-5 w-32 rounded mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex-shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                        <div className="flex-1 space-y-1.5">
                          <div className={`h-3 w-3/4 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                          <div className={`h-2.5 w-1/2 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Card Skeletons */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className={`h-4 w-3/4 rounded mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                    <div className={`h-3 w-1/2 rounded mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                    <div className={`h-6 w-28 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  </div>
                ))}
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
              {/* ─── D1: Milestone Progress ──────────── */}
              {(() => {
                const total = kpis.total || 0;
                const milestones = [1, 5, 10, 25, 50, 100];
                const nextMilestone = milestones.find(m => m > total) || 101;
                const prevMilestone = [...milestones].reverse().find(m => m <= total) || 0;
                const pct = nextMilestone > prevMilestone
                  ? Math.min(100, Math.round(((total - prevMilestone) / (nextMilestone - prevMilestone)) * 100))
                  : 100;
                const hour = new Date().getHours();
                const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
                return (
                  <div className={`rounded-2xl border px-5 py-3.5 mb-6 flex items-center gap-4 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {greeting}, {user?.full_name?.split(' ')[0] || 'Usuário'} 👋
                        </span>
                        <span className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          {total >= 100 ? '🏆 Nível máximo' : `Marco: ${nextMilestone} análises`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {total} {total === 1 ? 'análise criada' : 'análises criadas'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ─── KPI Cards (animated) ──────────── */}
              <div data-tour="kpis">
                <KpiCards kpis={kpis} isDark={isDark} />
              </div>

              {/* ─── U7: Monthly Goal Widget ──────────── */}
              {(() => {
                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const thisMonthCount = analyses.filter(a => new Date(a.created_at) >= monthStart).length;
                const pct = monthlyGoal > 0 ? Math.min(100, Math.round((thisMonthCount / monthlyGoal) * 100)) : 0;
                return (
                  <div className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-gradient-to-br from-teal-500/5 to-emerald-500/5 border-teal-500/20' : 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-teal-500" />
                        <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Meta mensal</span>
                      </div>
                      {!editingGoal ? (
                        <button
                          onClick={() => { setGoalInput(String(monthlyGoal || '')); setEditingGoal(true); }}
                          className={`text-[10px] font-medium transition ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {monthlyGoal > 0 ? 'Editar meta' : 'Definir meta'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="1" value={goalInput}
                            onChange={e => setGoalInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveMonthlyGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                            className={`w-16 px-2 py-0.5 rounded text-xs outline-none border ${isDark ? 'bg-slate-800 text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`}
                            autoFocus
                          />
                          <button onClick={saveMonthlyGoal} className="text-[10px] font-medium text-emerald-500">OK</button>
                          <button onClick={() => setEditingGoal(false)} className="text-[10px] text-slate-400">✕</button>
                        </div>
                      )}
                    </div>
                    {monthlyGoal > 0 ? (
                      <>
                        <div className="flex items-end gap-2 mb-1.5">
                          <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{thisMonthCount}</span>
                          <span className={`text-sm pb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>/ {monthlyGoal} análises</span>
                          <span className={`text-xs font-semibold pb-0.5 ml-auto ${pct >= 100 ? 'text-emerald-500' : isDark ? 'text-teal-400' : 'text-teal-600'}`}>{pct}%</span>
                        </div>
                        <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-teal-500 to-emerald-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {pct >= 100 && (
                          <p className="text-xs text-emerald-500 font-medium mt-1">❤️ Meta atingida! Parabéns!</p>
                        )}
                      </>
                    ) : (
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Defina uma meta de análises para este mês.</p>
                    )}
                  </div>
                );
              })()}

              {/* ─── D7: Weekly Progress ──────────── */}
              {weeklyProgress > 0 && (
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gradient-to-br from-purple-500/5 to-violet-500/5 border-purple-500/20' : 'bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-purple-500" />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Progresso semanal</span>
                  </div>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{weeklyProgress}</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {weeklyProgress === 1 ? 'análise esta semana' : 'análises esta semana'}
                  </p>
                </div>
              )}

              {/* ─── Daily Tip + Last Analysis ─────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                {/* Daily Tip */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Dica do dia</span>
                  </div>
                  <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {DAILY_TIPS[Math.floor((Date.now() / 86400000)) % DAILY_TIPS.length].title}
                  </p>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {DAILY_TIPS[Math.floor((Date.now() / 86400000)) % DAILY_TIPS.length].tip}
                  </p>
                </div>

                {/* Last Analysis Quick View */}
                {completedAnalyses.length > 0 && (() => {
                  const last = [...completedAnalyses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                  return (
                    <Link
                      to={`/analise/${last.id}`}
                      className={`rounded-2xl border p-5 transition group ${isDark ? 'bg-slate-900 border-slate-800 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-lg'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Última análise</span>
                        <ArrowRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                      </div>
                      <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{last.company_name}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <p className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmtBRL(last.equity_value)}</p>
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{relativeTime(last.created_at)}</span>
                      </div>
                    </Link>
                  );
                })()}
              </div>

              {/* ─── D4: Portfolio Evolution Chart ──── */}
              {valueTimeline.length > 1 && (
                <div className={`rounded-2xl border p-5 mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <TrendingUp className="inline w-4 h-4 mr-1.5 text-emerald-500" />
                    Evolução do Portfólio
                  </h3>
                  <div className="flex items-end gap-1 h-16">
                    {valueTimeline.map((v, i) => {
                      const maxV = Math.max(...valueTimeline.map(t => t.valor));
                      const h = maxV > 0 ? (v.valor / maxV) * 100 : 10;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${v.name}: ${fmtBRL(v.valor)}`}>
                          <div
                            className="w-full rounded-sm bg-gradient-to-t from-emerald-600 to-teal-500 transition-all hover:opacity-80"
                            style={{ height: `${Math.max(h, 4)}%`, minHeight: '3px' }}
                          />
                          {i % Math.max(1, Math.floor(valueTimeline.length / 6)) === 0 && (
                            <span className={`text-[8px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{v.date}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── DU4: Comparador de Análises ──────── */}
              {completedAnalyses.length >= 2 && (() => {
                const sorted = [...completedAnalyses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                const a1 = compareA ? sorted.find(a => a.id === compareA) : sorted[0];
                const a2 = compareB ? sorted.find(a => a.id === compareB) : sorted[1];
                const diff = a1?.equity_value && a2?.equity_value ? ((a1.equity_value - a2.equity_value) / a2.equity_value * 100) : null;
                return (
                  <div className={`rounded-2xl border p-5 mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <BarChart3 className="inline w-4 h-4 mr-1.5 text-teal-500" />
                      Comparador de Análises
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <select
                        value={compareA || a1?.id || ''}
                        onChange={e => setCompareA(e.target.value)}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs outline-none ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'} border`}
                      >
                        {sorted.map(a => <option key={a.id} value={a.id}>{a.company_name}</option>)}
                      </select>
                      <select
                        value={compareB || a2?.id || ''}
                        onChange={e => setCompareB(e.target.value)}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs outline-none ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'} border`}
                      >
                        {sorted.map(a => <option key={a.id} value={a.id}>{a.company_name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{a1?.company_name}</p>
                        <p className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmtBRL(a1?.equity_value)}</p>
                        {a1?.risk_score != null && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Risco: {a1.risk_score.toFixed(1)}</p>}
                      </div>
                      <div>
                        <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{a2?.company_name}</p>
                        <p className={`text-lg font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{fmtBRL(a2?.equity_value)}</p>
                        {a2?.risk_score != null && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Risco: {a2.risk_score.toFixed(1)}</p>}
                      </div>
                    </div>
                    {diff !== null && (
                      <p className={`text-xs mt-2 ${diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% de variação
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* ─── Charts row ────────────────────────── */}
              <Suspense fallback={<div className={`grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8`}><div className={`lg:col-span-2 rounded-2xl border p-6 animate-pulse h-[220px] ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`} /><div className={`lg:col-span-3 rounded-2xl border p-6 animate-pulse h-[220px] ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`} /></div>}>
                <LazyCharts isDark={isDark} sectorData={sectorData} valueTimeline={valueTimeline} formatBRL={fmtBRL} />
              </Suspense>

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
                          {a.value ? fmtBRL(a.value) : STATUS_MAP[a.status]?.label || 'Rascunho'} · {a.time}
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                    </Link>
                  ))}
                </div>
              </div>

              {/* ─── DU1: Meus Pagamentos ──────────────── */}
              {myPayments.length > 0 && (
                <div className={`rounded-2xl border p-4 md:p-6 mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <DollarSign className="inline w-4 h-4 mr-1.5 text-emerald-500" />
                      Meus Pagamentos
                    </h3>
                    <button
                      onClick={() => setShowPayments(!showPayments)}
                      className={`text-xs font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'}`}
                    >
                      {showPayments ? 'Ocultar' : `Ver todos (${myPayments.length})`}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className={isDark ? 'border-b border-slate-800' : 'border-b border-slate-200'}>
                          {['Empresa', 'Plano', 'Valor', 'Status', 'Data'].map(h => (
                            <th key={h} className={`text-left text-[10px] font-semibold uppercase tracking-wide px-3 py-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(showPayments ? myPayments : myPayments.slice(0, 5)).map((p) => (
                          <tr key={p.id} className={`transition ${isDark ? 'hover:bg-slate-800/50 border-b border-slate-800/50' : 'hover:bg-slate-50 border-b border-slate-100'}`}>
                            <td className={`px-3 py-2.5 text-sm font-medium truncate max-w-[180px] ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.company_name || '—'}</td>
                            <td className={`px-3 py-2.5 text-xs uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.plan || '—'}</td>
                            <td className={`px-3 py-2.5 text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.amount || 0)}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                p.status === 'paid' ? 'bg-green-500/10 text-green-500' :
                                p.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                p.status === 'refunded' ? 'bg-purple-500/10 text-purple-500' :
                                'bg-red-500/10 text-red-500'
                              }`}>
                                {p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : p.status === 'refunded' ? 'Reembolsado' : 'Falhou'}
                              </span>
                            </td>
                            <td className={`px-3 py-2.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─── D3: Contextual Smart Banner ──────── */}
              {(() => {
                const hasUnpaid = analyses.some(a => a.status === 'completed' && !a.plan);
                const hasOld = analyses.some(a => {
                  if (a.status !== 'completed') return false;
                  return (Date.now() - new Date(a.created_at)) / 86400000 > 30;
                });
                if (hasUnpaid) return (
                  <div className={`rounded-2xl border px-5 py-4 mb-4 flex items-center justify-between gap-4 ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Desbloqueie o relatório completo</p>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Análises concluídas sem PDF. Adquira para apresentar a investidores.</p>
                      </div>
                    </div>
                    <Link to="/nova-analise" className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition">
                      Ver planos <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                );
                if (hasOld) return (
                  <div className={`rounded-2xl border px-5 py-4 mb-4 flex items-center justify-between gap-4 ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Hora de atualizar seu valuation</p>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Você tem análises com mais de 30 dias. Mercado mudou — atualize para decisões precisas.</p>
                      </div>
                    </div>
                    <Link to="/nova-analise" className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500 text-white hover:bg-blue-400 transition">
                      Nova análise <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                );
                return null;
              })()}

              {/* ─── Filters bar ───────────────────────── */}
              <div data-tour="filtros" className={`sticky top-16 z-20 rounded-2xl border px-3 md:px-5 py-3 mb-6 flex flex-wrap items-center gap-2 md:gap-3 backdrop-blur-xl ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200 shadow-sm'}`}>
                {/* Search */}
                <div className="relative flex-1 min-w-[140px] md:min-w-[180px]">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar... (⌘K)"
                    ref={searchInputRef}
                    className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition ${isDark ? 'bg-slate-800 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-emerald-500/50' : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-200'}`}
                  />
                </div>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className={`px-2 md:px-3 py-2 rounded-lg text-sm outline-none cursor-pointer transition ${isDark ? 'bg-slate-800 text-slate-300 focus:ring-1 focus:ring-emerald-500/50' : 'bg-slate-50 text-slate-600 focus:ring-1 focus:ring-emerald-200'}`}
                >
                  <option value="all">Status</option>
                  <option value="completed">Concluída</option>
                  <option value="processing">Processando</option>
                  <option value="draft">Rascunho</option>
                </select>

                {/* D1: Date filter */}
                <select
                  value={dateFilter}
                  onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                  className={`px-2 md:px-3 py-2 rounded-lg text-sm outline-none cursor-pointer transition ${isDark ? 'bg-slate-800 text-slate-300 focus:ring-1 focus:ring-emerald-500/50' : 'bg-slate-50 text-slate-600 focus:ring-1 focus:ring-emerald-200'}`}
                >
                  <option value="all">Qualquer data</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                  <option value="90d">Últimos 90 dias</option>
                </select>

                {/* Sector filter */}
                <select
                  value={sectorFilter}
                  onChange={(e) => { setSectorFilter(e.target.value); setPage(1); }}
                  className={`px-2 md:px-3 py-2 rounded-lg text-sm outline-none cursor-pointer transition ${isDark ? 'bg-slate-800 text-slate-300 focus:ring-1 focus:ring-emerald-500/50' : 'bg-slate-50 text-slate-600 focus:ring-1 focus:ring-emerald-200'}`}
                >
                  <option value="all">Todos os setores</option>
                  {sectors.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>

                {/* Favorites-only toggle */}
                <button
                  onClick={() => { setShowFavoritesOnly(prev => !prev); setPage(1); }}
                  title={showFavoritesOnly ? 'Ver todas' : 'Ver apenas favoritos'}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition ${
                    showFavoritesOnly
                      ? 'bg-yellow-400/15 text-yellow-500 font-medium'
                      : isDark ? 'bg-slate-800 text-slate-400 hover:text-slate-200' : 'bg-slate-50 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  <span className="hidden sm:inline">{showFavoritesOnly ? 'Favoritos' : 'Favoritos'}</span>
                </button>

                {/* Sort */}
                <select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value); setPage(1); }}
                  className={`px-2 md:px-3 py-2 rounded-lg text-sm outline-none cursor-pointer transition ${isDark ? 'bg-slate-800 text-slate-300 focus:ring-1 focus:ring-emerald-500/50' : 'bg-slate-50 text-slate-600 focus:ring-1 focus:ring-emerald-200'}`}
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
                {(search || statusFilter !== 'all' || sectorFilter !== 'all' || dateFilter !== 'all' || showFavoritesOnly) && (
                  <button onClick={() => { setSearch(''); setStatusFilter('all'); setSectorFilter('all'); setDateFilter('all'); setShowFavoritesOnly(false); }} className="ml-2 text-emerald-500 hover:text-emerald-400 transition">
                    Limpar filtros
                  </button>
                )}
              </p>

              {apiError ? (
                <div className={`text-center py-16 rounded-2xl border border-dashed ${isDark ? 'border-red-900 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
                  <Shield className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-red-400' : 'text-red-400'}`} />
                  <p className={`text-sm font-medium mb-2 ${isDark ? 'text-red-300' : 'text-red-600'}`}>Erro ao carregar análises.</p>
                  <button onClick={loadAnalyses} className="text-sm text-emerald-500 hover:text-emerald-400 font-medium transition">Tentar novamente</button>
                </div>
              ) : filtered.length === 0 && !apiError ? (
                <>
                  {(!search && statusFilter === 'all' && sectorFilter === 'all') ? (
                    /* ─── True empty state – no analyses created yet ── */
                    <div className={`relative overflow-hidden rounded-2xl border border-dashed text-center py-16 px-6 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                      {/* Background glow */}
                      <div className="absolute inset-0 pointer-events-none">
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 ${isDark ? 'bg-emerald-500' : 'bg-emerald-400'}`} />
                      </div>
                      <div className="relative">
                        <div className={`w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100'}`}>
                          <TrendingUp className="w-9 h-9 text-emerald-500" />
                        </div>
                        <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          Crie seu primeiro valuation em 5 minutos
                        </h3>
                        <p className={`text-sm mb-6 max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Descubra quanto vale sua empresa com precisão institucional.
                          Basta informar os dados financeiros básicos.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 justify-center text-xs mb-8">
                          {['DCF + Múltiplos setoriais', 'Score de risco 0–100', 'Análise QV Intelligence'].map((f) => (
                            <span key={f} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                              {f}
                            </span>
                          ))}
                        </div>
                        <Link
                          to="/nova-analise"
                          className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-600/20"
                        >
                          <Plus className="w-4 h-4" />
                          Criar primeira análise — grátis
                        </Link>
                      </div>
                    </div>
                  ) : (
                    /* ─── Filter empty state ── */
                    <div className={`text-center py-16 rounded-2xl border border-dashed ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                        <Search className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                      </div>
                      <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Nenhuma análise encontrada</h3>
                      <p className={`text-sm mb-6 max-w-sm mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tente ajustar os filtros ou a busca</p>
                      <button
                        onClick={() => { setSearch(''); setStatusFilter('all'); setSectorFilter('all'); setDateFilter('all'); setShowFavoritesOnly(false); }}
                        className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                      >
                        <X className="w-4 h-4" />
                        Limpar filtros
                      </button>
                    </div>
                  )}
                </>
              ) : viewMode === 'grid' ? (
                /* ─── Grid View ──────────────────────── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((a) => {
                    const isSelected = selectedIds.has(a.id);
                    return (
                      <div
                        key={a.id}
                        className={`group relative rounded-2xl border transition-all ${
                          isSelected
                            ? isDark ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-500/5' : 'border-emerald-400 ring-1 ring-emerald-300 bg-emerald-50/50 shadow-md'
                            : isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-200 hover:shadow-lg'
                        }`}
                      >
                        {/* U1: Checkbox overlay in selection mode */}
                        {selectionMode && (
                          <button
                            onClick={() => toggleSelectId(a.id)}
                            className="absolute top-3 left-3 z-10 p-0.5"
                          >
                            {isSelected
                              ? <CheckSquare className="w-4 h-4 text-emerald-500" />
                              : <Square className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-300'}`} />}
                          </button>
                        )}
                        <Link
                          to={`/analise/${a.id}`}
                          onClick={e => selectionMode && (e.preventDefault(), toggleSelectId(a.id))}
                          className="block p-6 rounded-2xl"
                        >
                          <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isDark ? 'bg-gradient-to-br from-emerald-500/3 to-transparent' : 'bg-gradient-to-br from-emerald-50/50 to-transparent'}`} />
                          <div className="relative">
                            <div className={`flex items-center justify-between mb-4 ${selectionMode ? 'pl-5' : ''}`}>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-xs font-medium text-emerald-500 uppercase tracking-wide">{a.sector}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {/* D2: Favorite star */}
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(a.id); }}
                                  className={`p-1 rounded transition ${favorites.includes(a.id) ? 'text-amber-400' : isDark ? 'text-slate-600 hover:text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
                                >
                                  <Star className={`w-3.5 h-3.5 ${favorites.includes(a.id) ? 'fill-amber-400' : ''}`} />
                                </button>
                                {statusBadge(a.status)}
                              </div>
                            </div>

                            <h3 className={`font-semibold mb-1 group-hover:text-emerald-500 transition truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {a.company_name}
                            </h3>

                            {a.equity_value ? (
                              <p className={`text-2xl font-bold mt-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtBRL(a.equity_value)}</p>
                            ) : (
                              <p className={`text-sm mt-3 italic ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>Aguardando resultado</p>
                            )}

                            {/* D2: Risk score bar */}
                            {a.risk_score != null && (
                              <div className="flex items-center gap-2 mt-2">
                                <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                  <div
                                    className={`h-full rounded-full transition-all ${a.risk_score >= 70 ? 'bg-red-500' : a.risk_score >= 40 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, a.risk_score)}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-mono whitespace-nowrap ${a.risk_score >= 70 ? (isDark ? 'text-red-400' : 'text-red-500') : a.risk_score >= 40 ? (isDark ? 'text-yellow-400' : 'text-yellow-600') : (isDark ? 'text-emerald-400' : 'text-emerald-600')}`}>
                                  risco {a.risk_score.toFixed(0)}
                                </span>
                              </div>
                            )}

                            <div className={`flex items-center justify-between mt-4 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                {new Date(a.created_at).toLocaleDateString('pt-BR')}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteAnalysis(a.id, a.company_name); }}
                                  className={`p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 ${isDark ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-500'}`}
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                {a.status === 'completed' && a.plan && (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      api.get(`/analyses/${a.id}/pdf`, { responseType: 'blob' })
                                        .then(res => {
                                          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                                          const link = document.createElement('a');
                                          link.href = url;
                                          link.download = `relatorio-${a.company_name}.pdf`;
                                          link.click();
                                          window.URL.revokeObjectURL(url);
                                          toast.success('PDF baixado!');
                                        })
                                        .catch(() => toast.error('Erro ao baixar PDF.'));
                                    }}
                                    className={`p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 ${isDark ? 'hover:bg-emerald-500/10 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-500'}`}
                                    title="Baixar PDF"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <ArrowRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
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
                              {a.equity_value ? fmtBRL(a.equity_value) : '—'}
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Página {page} de {totalPages} ({totalCount} análises)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Anterior
                    </button>
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                      const p = start + i;
                      if (p > totalPages) return null;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-9 h-9 text-sm rounded-lg transition font-medium ${
                            p === page
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                              : isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Mover para lixeira"
        message={`"${deleteConfirm.name}" será movida para a lixeira e excluída permanentemente após 30 dias.`}
        confirmLabel="Mover para lixeira"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDeleteAnalysis}
        onCancel={() => setDeleteConfirm({ open: false, id: null, name: '' })}
      />

      {/* Onboarding tour — shown once for new users with 0 analyses */}
      <OnboardingTour totalAnalyses={kpis.total} />
      </>
  );
}

function KpiCards({ kpis, isDark }) {
  const animTotal = useCountAnimation(kpis.total, 1000);
  const animAvg = useCountAnimation(kpis.avgValue, 1500);
  const animMax = useCountAnimation(kpis.maxValue, 1500);
  const animRisk = useCountAnimation(kpis.avgRisk, 1200);

  const items = [
    { label: 'Total de Análises', value: Math.round(animTotal), icon: FileText, color: 'from-emerald-500 to-emerald-600', format: (v) => v },
    { label: 'Valor Médio', value: animAvg, icon: DollarSign, color: 'from-emerald-500 to-cyan-500', format: fmtBRL },
    { label: 'Maior Valuation', value: animMax, icon: TrendingUp, color: 'from-purple-500 to-violet-500', format: fmtBRL },
    { label: 'Risco Médio', value: animRisk, icon: Shield, color: 'from-orange-500 to-amber-500', format: (v) => `${v.toFixed(1)}/100` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {items.map((kpi, i) => (
        <div key={i} className={`rounded-2xl border p-4 md:p-5 transition ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-[10px] md:text-xs font-medium uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {kpi.label}
            </span>
            <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br ${kpi.color} flex items-center justify-center`}>
              <kpi.icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
            </div>
          </div>
          <p className={`text-lg md:text-2xl font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{kpi.format(kpi.value)}</p>
        </div>
      ))}
    </div>
  );
}
