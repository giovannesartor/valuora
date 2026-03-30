import { useEffect, useState, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import OnboardingTour from '../components/OnboardingTour';
import OnboardingWizard from '../components/OnboardingWizard';
import GlobalSearchModal from '../components/GlobalSearchModal';
import KpiCards from '../components/KpiCards';
import { SkeletonAnalysisCard } from '../components/Skeletons';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Plus, FileText, TrendingUp, Search, Filter, ArrowUpDown,
  LayoutGrid, List, ChevronRight, Clock, DollarSign,
  Shield, BarChart3, Sparkles, ArrowRight, X, Menu,
  Lightbulb, Zap, Crown, Trash2, Star, Download, Bell, CalendarDays, CheckCircle2,
  CheckSquare, Square, Target, Edit3,
} from 'lucide-react';
const LazyCharts = lazy(() => import('../components/DashboardCharts'));
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import { useI18n } from '../lib/i18n';
import formatCurrency from '../lib/formatCurrency';
import { relativeTime, STATUS_MAP, SECTOR_COLORS } from '../lib/dashboardUtils';

// ─── Helpers ─────────────────────────────────────────────
const fmtBRL = (v) => formatCurrency(v, { abbreviate: true });

const SORT_OPTIONS = [
  { value: 'date_desc', labelKey: 'dash_sort_most_recent' },
  { value: 'date_asc', labelKey: 'dash_sort_oldest' },
  { value: 'value_desc', labelKey: 'dash_sort_highest_value' },
  { value: 'value_asc', labelKey: 'dash_sort_lowest_value' },
  { value: 'name_asc', labelKey: 'dash_sort_a_z' },
  { value: 'name_desc', labelKey: 'dash_sort_z_a' },
];

const DAILY_TIPS = [
  { titleKey: 'dash_tip_ke_title', tipKey: 'dash_tip_ke_text' },
  { titleKey: 'dash_tip_dlom_title', tipKey: 'dash_tip_dlom_text' },
  { titleKey: 'dash_tip_tv_title', tipKey: 'dash_tip_tv_text' },
  { titleKey: 'dash_tip_multiples_title', tipKey: 'dash_tip_multiples_text' },
  { titleKey: 'dash_tip_survival_title', tipKey: 'dash_tip_survival_text' },
  { titleKey: 'dash_tip_keyperson_title', tipKey: 'dash_tip_keyperson_text' },
  { titleKey: 'dash_tip_qualitative_title', tipKey: 'dash_tip_qualitative_text' },
];

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const { t } = useI18n();
  const { user, fetchUser } = useAuthStore();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  useOutletContext(); // keep outlet context connected

  // Filters — persisted in localStorage (D3)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => { try { return localStorage.getItem('qv:f:status') || 'all'; } catch { return 'all'; } });
  const [sectorFilter, setSectorFilter] = useState(() => { try { return localStorage.getItem('qv:f:sector') || 'all'; } catch { return 'all'; } });
  const [valueFilter, setValueFilter] = useState(() => { try { return localStorage.getItem('qv:f:value') || 'all'; } catch { return 'all'; } });
  const [sort, setSort] = useState(() => { try { return localStorage.getItem('qv:f:sort') || 'date_desc'; } catch { return 'date_desc'; } });
  const [viewMode, setViewMode] = useState(() => { try { return localStorage.getItem('qv:f:view') || 'grid'; } catch { return 'grid'; } }); // grid | list
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

  // D1: Date filter — persisted in localStorage
  const [dateFilter, setDateFilter] = useState(() => { try { return localStorage.getItem('qv:f:date') || 'all'; } catch { return 'all'; } });

  // D2: Favorites — server-side
  const [favorites, setFavorites] = useState([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // F5: Quick edit
  const [quickEditId, setQuickEditId] = useState(null);
  const [quickEditForm, setQuickEditForm] = useState({});
  const [quickEditSaving, setQuickEditSaving] = useState(false);

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
  const notificationsRef = useRef(null);
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

  useEffect(() => { loadAnalyses(); }, [loadAnalyses]);

  // D3: persist filter prefs to localStorage
  useEffect(() => { try { localStorage.setItem('qv:f:status', statusFilter); } catch {} }, [statusFilter]);
  useEffect(() => { try { localStorage.setItem('qv:f:sector', sectorFilter); } catch {} }, [sectorFilter]);
  useEffect(() => { try { localStorage.setItem('qv:f:value', valueFilter); } catch {} }, [valueFilter]);
  useEffect(() => { try { localStorage.setItem('qv:f:sort', sort); } catch {} }, [sort]);
  useEffect(() => { try { localStorage.setItem('qv:f:view', viewMode); } catch {} }, [viewMode]);
  useEffect(() => { try { localStorage.setItem('qv:f:date', dateFilter); } catch {} }, [dateFilter]);

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
        sparklines: backendKpis.sparklines || null,
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
      sparklines: null,
    };
  }, [analyses, completedAnalyses, backendKpis]);

  // V6: portfolio total value (current page)
  const portfolioTotal = useMemo(() =>
    completedAnalyses.reduce((sum, a) => sum + (a.equity_value || 0), 0)
  , [completedAnalyses]);

  const sectorData = useMemo(() => {
    const map = {};
    analyses.forEach(a => {
      const s = a.sector || 'Other';
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
        date: new Date(a.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
        value: a.equity_value,
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
    // Value range filter (client-side)
    if (valueFilter !== 'all') {
      result = result.filter(a => {
        const v = a.equity_value || 0;
        if (valueFilter === 'lt500k') return v < 500_000;
        if (valueFilter === '500k-1m') return v >= 500_000 && v < 1_000_000;
        if (valueFilter === '1m-5m') return v >= 1_000_000 && v < 5_000_000;
        if (valueFilter === 'gt5m') return v >= 5_000_000;
        return true;
      });
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
  }, [analyses, dateFilter, favorites, showFavoritesOnly, valueFilter]);

  // ─── Delete Analysis ─────────────────────────────
  const handleDeleteAnalysis = (id, name) => {
    setDeleteConfirm({ open: true, id, name: name || 'this analysis' });
  };

  const confirmDeleteAnalysis = async () => {
    setDeleting(true);
    try {
      await api.delete(`/analyses/${deleteConfirm.id}`);
      toast.success(t('dash_analysis_moved_trash'));
      setDeleteConfirm({ open: false, id: null, name: '' });
      loadAnalyses();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('dash_error_remove_analysis'));
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
      let failed = 0;
      for (const id of selectedIds) {
        try { await api.delete(`/analyses/${id}`); }
        catch { failed++; }
      }
      if (failed) toast.error(`${failed} ${t('dash_bulk_failed')}`);
      else toast.success(`${selectedIds.size} ${t('dash_bulk_removed')}`);
      clearSelection();
      loadAnalyses();
    } catch { toast.error(t('dash_error_bulk_remove')); }
    finally { setBulkDeleting(false); }
  };
  const handleBulkExportCSV = () => {
    const toExport = filtered.filter(a => selectedIds.has(a.id));
    const headers = ['Company', 'Sector', 'Value ($)', 'Status', 'Risk', 'Date'];
    const rows = toExport.map(a => [a.company_name, a.sector || '', a.equity_value || '', STATUS_MAP[a.status]?.label || a.status, a.risk_score || '', new Date(a.created_at).toLocaleDateString('en-US')]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'analises-selecteds.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('dash_csv_exported'));
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
    const headers = ['Company', 'Sector', 'Value ($)', 'Status', 'Risk', 'Date'];
    const rows = filtered.map(a => [
      a.company_name, a.sector || '', a.equity_value || '',
      STATUS_MAP[a.status]?.label || a.status, a.risk_score || '',
      new Date(a.created_at).toLocaleDateString('en-US'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-analises-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('dash_csv_exported'));
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
        navigate('/new-analysis');
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

  // D5: Click-outside to close notifications dropdown
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showNotifications]);

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
      green:  isDark ? 'bg-green-500/10 text-green-400'   : 'bg-green-50 text-green-600',
      yellow: isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600',
      slate:  isDark ? 'bg-slate-800 text-slate-400'      : 'bg-slate-100 text-slate-500',
    };
    const dotColors = {
      green:  'bg-green-500',
      yellow: 'bg-yellow-400',
      slate:  isDark ? 'bg-slate-500' : 'bg-slate-400',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${colors[s.color]}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[s.color]} ${s.color === 'yellow' ? 'animate-pulse' : ''}`} />
        {s.label}
      </span>
    );
  };

  return (
    <>
      <GlobalSearchModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
      {/* ─── Top bar ───────────────────────────────────── */}
      <header className={`sticky top-0 md:top-0 top-14 z-30 h-16 flex items-center justify-between px-4 md:px-8 border-b backdrop-blur-xl ${isDark ? 'bg-slate-950/80 border-slate-800/60' : 'bg-slate-50/80 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div>
            <h1 className={`text-base md:text-lg font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {(() => { const h = new Date().getHours(); return h < 12 ? t('dash_good_morning') : h < 18 ? t('dash_good_afternoon') : t('dash_good_evening'); })()}, {user?.full_name?.split(' ')[0] || 'User'} <Sparkles className="inline w-4 h-4 text-amber-400 ml-1" />
            </h1>
            {analyses.length > 0 && (
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {completedAnalyses.filter(a => new Date(a.created_at) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).length} {t('dash_completed_this_month')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
            {/* D5: Notifications bell */}
            <div className="relative" ref={notificationsRef}>
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
                    <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('notifications')}</p>
                    {notifications.some(n => n.unread) && (
                      <button
                        onClick={markAllNotifsAsRead}
                        className={`text-[10px] font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'}`}
                      >
                        {t('mark_all_read')}
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('no_notifications')}</p>
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
                              {t('mark_as_read')}
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
              title="Select multiple"
              className={`p-2 rounded-lg transition border ${selectionMode ? (isDark ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-emerald-400 bg-emerald-50 text-emerald-600') : (isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            <Link
              to="/new-analysis"
              data-tour="nova-analise"
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:brightness-110 transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dash_new_analysis')}</span>
            </Link>
            <Link
              to="/pitch-deck/novo"
              className="flex items-center gap-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-200"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dash_pitch_deck')}</span>
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
                  <div key={i} className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
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
                <div className={`lg:col-span-2 rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <div className={`h-5 w-40 rounded mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className={`h-48 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                </div>
                <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
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
                  <SkeletonAnalysisCard key={i} isDark={isDark} />
                ))}
              </div>
            </div>
          ) : analyses.length === 0 ? (
            /* ─── Onboarding ───────────────────────────── */
            <div className="max-w-2xl mx-auto py-8 md:py-16">
              <div className={`rounded-2xl border-2 border-dashed p-6 md:p-12 text-center ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                  <Sparkles className="w-9 h-9 text-emerald-500" />
                </div>
                <h2 className={`text-2xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('dash_welcome')}
                </h2>
                <p className={`text-base mb-2 max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('dash_welcome_desc')}
                </p>
                <p className={`text-sm mb-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('dash_welcome_start')}
                </p>

                <Link
                  to="/new-analysis"
                  className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:brightness-110 transition-colors duration-200"
                >
                  <Plus className="w-5 h-5" />
                  {t('dash_create_first_analysis')}
                </Link>

                <div className={`mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-8 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  {[
                    { num: '01', icon: FileText, titleKey: 'dash_step_fill_data', descKey: 'dash_step_fill_desc' },
                    { num: '02', icon: BarChart3, titleKey: 'dash_step_engine', descKey: 'dash_step_engine_desc' },
                    { num: '03', icon: TrendingUp, titleKey: 'dash_step_report', descKey: 'dash_step_report_desc' },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className={`rounded-xl p-5 text-center transition-colors duration-200 ${isDark ? 'bg-slate-800/60 border border-slate-700' : 'bg-slate-50 border border-slate-100'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-3 text-xs font-semibold ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                        {s.num}
                      </div>
                      <s.icon className={`w-5 h-5 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t(s.titleKey)}</p>
                      <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t(s.descKey)}</p>
                    </div>
                  ))}
                </div>

                {/* Social proof strip */}
                <div className={`mt-6 pt-6 border-t flex flex-wrap justify-center gap-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  {[
                    { icon: CheckCircle2, color: 'text-emerald-500', textKey: 'dash_social_2min' },
                    { icon: Shield, color: 'text-blue-500', textKey: 'dash_social_dcf' },
                    { icon: Star, color: 'text-amber-500', textKey: 'dash_social_pdf' },
                  ].map(({ icon: Icon, color, textKey }) => (
                    <span key={textKey} className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
                      {t(textKey)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start">
              {/* ─── LEFT SIDEBAR ───────────────────────────────── */}
              <aside className={`hidden lg:flex flex-col w-56 xl:w-64 shrink-0 sticky top-16 self-start h-[calc(100vh-64px)] overflow-y-auto py-6 pr-6 gap-3 border-r ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('dash_filters_title')}</p>

                <div className="relative">
                  <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('dash_search_placeholder')} ref={searchInputRef} className={`w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none transition ${isDark ? 'bg-slate-800/80 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-emerald-500/50' : 'bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-200'}`} />
                </div>

                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={`w-full px-3 py-2 rounded-lg text-xs outline-none cursor-pointer ${isDark ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                  <option value="all">{t('dash_all_statuses')}</option>
                  <option value="completed">{t('dash_status_completed')}</option>
                  <option value="processing">{t('dash_status_processing')}</option>
                  <option value="draft">{t('dash_status_draft')}</option>
                </select>

                <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} className={`w-full px-3 py-2 rounded-lg text-xs outline-none cursor-pointer ${isDark ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                  <option value="all">{t('dash_any_date')}</option>
                  <option value="7d">{t('dash_last_7_days')}</option>
                  <option value="30d">{t('dash_last_30_days')}</option>
                  <option value="90d">{t('dash_last_90_days')}</option>
                </select>

                <select value={sectorFilter} onChange={(e) => { setSectorFilter(e.target.value); setPage(1); }} className={`w-full px-3 py-2 rounded-lg text-xs outline-none cursor-pointer ${isDark ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                  <option value="all">{t('dash_all_sectors')}</option>
                  {sectors.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>

                <select value={valueFilter} onChange={(e) => { setValueFilter(e.target.value); setPage(1); }} className={`w-full px-3 py-2 rounded-lg text-xs outline-none cursor-pointer ${isDark ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                  <option value="all">{t('dash_any_value')}</option>
                  <option value="lt500k">{t('dash_below_500k')}</option>
                  <option value="500k-1m">{t('dash_500k_1m')}</option>
                  <option value="1m-5m">{t('dash_1m_5m')}</option>
                  <option value="gt5m">{t('dash_above_5m')}</option>
                </select>

                <button onClick={() => { setShowFavoritesOnly(prev => !prev); setPage(1); }} className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition ${showFavoritesOnly ? 'bg-yellow-400/15 text-yellow-500' : isDark ? 'bg-slate-800/80 text-slate-400 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
                  <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  {t('dash_favorites_only')}
                </button>

                <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={`w-full px-3 py-2 rounded-lg text-xs outline-none cursor-pointer ${isDark ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                <div className={`flex rounded-lg overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <button onClick={() => setViewMode('grid')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${viewMode === 'grid' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}>
                    <LayoutGrid className="w-3.5 h-3.5" /> {t('dash_view_grid')}
                  </button>
                  <button onClick={() => setViewMode('list')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${viewMode === 'list' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}>
                    <List className="w-3.5 h-3.5" /> {t('dash_view_list')}
                  </button>
                </div>

                {(search || statusFilter !== 'all' || sectorFilter !== 'all' || valueFilter !== 'all' || dateFilter !== 'all' || showFavoritesOnly) && (
                  <button onClick={() => { setSearch(''); setStatusFilter('all'); setSectorFilter('all'); setValueFilter('all'); setDateFilter('all'); setShowFavoritesOnly(false); }} className={`flex items-center gap-1 text-xs font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'}`}>
                    <X className="w-3 h-3" /> {t('dash_clear_filters')}
                  </button>
                )}

                <div className={`h-px my-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />

                {/* Monthly goal */}
                {(() => {
                  const _now = new Date();
                  const _ms = new Date(_now.getFullYear(), _now.getMonth(), 1);
                  const _cnt = analyses.filter(a => new Date(a.created_at) >= _ms).length;
                  const _pct = monthlyGoal > 0 ? Math.min(100, Math.round((_cnt / monthlyGoal) * 100)) : 0;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-teal-500" />
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{t('dash_monthly_goal')}</span>
                        </div>
                        {!editingGoal ? (
                          <button onClick={() => { setGoalInput(String(monthlyGoal || '')); setEditingGoal(true); }} className={`text-[10px] transition ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                            {monthlyGoal > 0 ? t('common_edit') : t('common_set')}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input type="number" min="1" value={goalInput} onChange={e => setGoalInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveMonthlyGoal(); if (e.key === 'Escape') setEditingGoal(false); }} className={`w-12 px-1.5 py-0.5 rounded text-xs outline-none border ${isDark ? 'bg-slate-800 text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'}`} autoFocus />
                            <button onClick={saveMonthlyGoal} className="text-[10px] text-emerald-500">OK</button>
                            <button onClick={() => setEditingGoal(false)} className="text-[10px] text-slate-400">✕</button>
                          </div>
                        )}
                      </div>
                      {monthlyGoal > 0 ? (
                        <>
                          <div className="flex items-end gap-1.5 mb-1.5">
                            <span className={`text-lg font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{_cnt}</span>
                            <span className={`text-xs pb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>/ {monthlyGoal}</span>
                            <span className={`text-xs font-bold pb-0.5 ml-auto ${_pct >= 100 ? 'text-emerald-500' : isDark ? 'text-teal-400' : 'text-teal-600'}`}>{_pct}%</span>
                          </div>
                          <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                            <div className={`h-full rounded-full transition-all duration-700 ${_pct >= 100 ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${_pct}%` }} />
                          </div>
                          {_pct >= 100 && <p className="text-[10px] text-emerald-500 mt-1">❤️ {t('dash_goal_reached')}</p>}
                        </>
                      ) : (
                        <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('dash_set_goal_prompt')}</p>
                      )}
                    </div>
                  );
                })()}
              </aside>

              {/* ─── MAIN CANVAS ─────────────────────────────── */}
              <div className="flex-1 min-w-0 lg:pl-8">
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
                const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
                return (
                  <div className={`rounded-2xl border px-5 py-3.5 mb-6 flex items-center gap-4 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {total} {total === 1 ? t('dash_analysis_created_singular') : t('dash_analysis_created_plural')}
                        </span>
                        <span className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          {total >= 100 ? `🏆 ${t('dash_max_level')}` : `${t('dash_milestone_prefix')} ${nextMilestone} ${t('dash_analysis_created_plural')}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {total} {total === 1 ? t('dash_analysis_created_singular') : t('dash_analysis_created_plural')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ─── V6: Portfolio Value Banner ──────── */}
              {portfolioTotal > 0 && (
                <div className={`rounded-2xl border px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r ${isDark ? 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20' : 'from-emerald-50 to-teal-50 border-emerald-200 shadow-sm'}`}>
                  <div>
                    <p className={`text-[11px] font-semibold uppercase tracking-widest mb-0.5 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>{t('dash_total_portfolio_value')}</p>
                    <p className={`text-3xl font-bold tabular-nums tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {fmtBRL(portfolioTotal)}
                    </p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {completedAnalyses.length} {completedAnalyses.length === 1 ? t('dash_completed_analysis_singular') : t('dash_completed_analysis_plural')} · {t('dash_accumulated_page')}
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white text-emerald-700 border border-emerald-200 shadow-sm'}`}>
                    <TrendingUp className="w-4 h-4" />
                    {t('dash_active_portfolio')}
                  </div>
                </div>
              )}

              {/* ─── KPI Cards (animated) ──────────── */}
              <div data-tour="kpis">
                <KpiCards kpis={kpis} isDark={isDark} />
              </div>

              {/* ─── Daily Tip + Last Analysis ─────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                {/* Daily Tip */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{t('dash_tip_of_the_day')}</span>
                  </div>
                  <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {t(DAILY_TIPS[Math.floor((Date.now() / 86400000)) % DAILY_TIPS.length].titleKey)}
                  </p>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t(DAILY_TIPS[Math.floor((Date.now() / 86400000)) % DAILY_TIPS.length].tipKey)}
                  </p>
                </div>

                {/* Last Analysis Quick View */}
                {completedAnalyses.length > 0 && (() => {
                  const last = [...completedAnalyses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                  return (
                    <Link
                      to={`/analise/${last.id}`}
                      className={`rounded-2xl border p-5 transition group ${isDark ? 'bg-slate-900 border-slate-700 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-lg'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('dash_latest_analysis')}</span>
                        <ArrowRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                      </div>
                      <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{last.company_name}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <p className={`text-lg font-semibold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmtBRL(last.equity_value)}</p>
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{relativeTime(last.created_at)}</span>
                      </div>
                    </Link>
                  );
                })()}
              </div>

              {/* ─── D4: Portfolio Evolution Chart ──── */}
              {valueTimeline.length > 1 && (
                <div className={`rounded-2xl border p-5 mb-8 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <TrendingUp className="inline w-4 h-4 mr-1.5 text-emerald-500" />
                    {t('dash_portfolio_evolution')}
                  </h3>
                  <div className="flex items-end gap-1 h-16">
                    {valueTimeline.map((v, i) => {
                      const maxV = Math.max(...valueTimeline.map(t => t.value));
                      const h = maxV > 0 ? (v.value / maxV) * 100 : 10;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${v.name}: ${fmtBRL(v.value)}`}>
                          <div
                            className="w-full rounded-sm bg-emerald-500 transition-colors duration-200 hover:bg-emerald-400"
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

              {/* ─── DU4: Analysis Comparator ──────── */}
              {completedAnalyses.length >= 2 && (() => {
                const sorted = [...completedAnalyses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                const a1 = compareA ? sorted.find(a => a.id === compareA) : sorted[0];
                const a2 = compareB ? sorted.find(a => a.id === compareB) : sorted[1];
                const diff = a1?.equity_value && a2?.equity_value ? ((a1.equity_value - a2.equity_value) / a2.equity_value * 100) : null;
                return (
                  <div className={`rounded-2xl border p-5 mb-8 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <BarChart3 className="inline w-4 h-4 mr-1.5 text-teal-500" />
                      {t('dash_analysis_comparator')}
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
                        <p className={`text-lg font-semibold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmtBRL(a1?.equity_value)}</p>
                        {a1?.risk_score != null && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Risk: {a1.risk_score.toFixed(1)}</p>}
                      </div>
                      <div>
                        <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{a2?.company_name}</p>
                        <p className={`text-lg font-semibold tabular-nums ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{fmtBRL(a2?.equity_value)}</p>
                        {a2?.risk_score != null && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Risk: {a2.risk_score.toFixed(1)}</p>}
                      </div>
                    </div>
                      {diff !== null && (
                      <p className={`text-xs mt-2 ${diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% {t('dash_variation')}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* ─── Charts row ────────────────────────── */}
              <Suspense fallback={<div className={`grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8`}><div className={`lg:col-span-2 rounded-2xl border p-6 animate-pulse h-[220px] ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} /><div className={`lg:col-span-3 rounded-2xl border p-6 animate-pulse h-[220px] ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} /></div>}>
                <LazyCharts isDark={isDark} sectorData={sectorData} valueTimeline={valueTimeline} formatCurrency={fmtBRL} analyses={analyses} />
              </Suspense>

              {/* ─── Activity Timeline ─────────────────── */}
              <div className={`rounded-2xl border p-4 md:p-6 mb-8 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dash_recent_activity')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentActivity.map((a, i) => (
                    <Link
                      key={i}
                      to={`/analysis/${a.id}`}
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
                          {a.value ? fmtBRL(a.value) : STATUS_MAP[a.status]?.label || 'Draft'} · {a.time}
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                    </Link>
                  ))}
                </div>
              </div>

              {/* ─── DU1: My Payments ──────────────── */}
              {myPayments.length > 0 && (
                <div className={`rounded-2xl border p-4 md:p-6 mb-8 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <DollarSign className="inline w-4 h-4 mr-1.5 text-emerald-500" />
                      {t('dash_my_payments')}
                    </h3>
                    <button
                      onClick={() => setShowPayments(!showPayments)}
                      className={`text-xs font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'}`}
                    >
                      {showPayments ? t('dash_hide') : `${t('dash_view_all')} (${myPayments.length})`}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className={isDark ? 'border-b border-slate-800' : 'border-b border-slate-200'}>
                          {[t('dash_table_company'), t('dash_table_plan'), t('dash_table_amount'), t('dash_table_status'), t('dash_table_date')].map(h => (
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
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.amount || 0)}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                p.status === 'paid' ? 'bg-green-500/10 text-green-500' :
                                p.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                p.status === 'refunded' ? 'bg-purple-500/10 text-purple-500' :
                                'bg-red-500/10 text-red-500'
                              }`}>
                                {p.status === 'paid' ? 'Paid' : p.status === 'pending' ? 'Pending' : p.status === 'refunded' ? 'Refunded' : 'Failed'}
                              </span>
                            </td>
                            <td className={`px-3 py-2.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-US') : p.created_at ? new Date(p.created_at).toLocaleDateString('en-US') : '—'}
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
                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dash_unlock_report')}</p>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dash_unlock_report_desc')}</p>
                      </div>
                    </div>
                    <Link to="/new-analysis" className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition">
                      {t('dash_view_plans')} <ArrowRight className="w-3.5 h-3.5" />
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
                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dash_time_to_update')}</p>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dash_time_to_update_desc')}</p>
                      </div>
                    </div>
                    <Link to="/new-analysis" className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500 text-white hover:bg-blue-400 transition">
                      {t('dash_new_analysis')} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                );
                return null;
              })()}

              {/* ─── Mobile filters — sidebar hidden on desktop ─── */}
              <div data-tour="filtros" className={`lg:hidden flex flex-wrap items-center gap-2 mb-6`}>
                <div className="relative flex-1 min-w-[140px]">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('dash_search_placeholder')} className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition ${isDark ? 'bg-slate-800 text-white placeholder:text-slate-500' : 'bg-slate-100 text-slate-900 placeholder:text-slate-400'}`} />
                </div>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={`px-3 py-2 rounded-lg text-sm outline-none ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  <option value="all">{t('dash_filters_title')}</option>
                  <option value="completed">{t('dash_status_completed')}</option>
                  <option value="processing">{t('dash_status_processing')}</option>
                  <option value="draft">{t('dash_status_draft')}</option>
                </select>
                <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={`px-3 py-2 rounded-lg text-sm outline-none ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                </select>
                <div className={`flex rounded-lg overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <button onClick={() => setViewMode('grid')} className={`p-2 transition ${viewMode === 'grid' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}><LayoutGrid className="w-4 h-4" /></button>
                  <button onClick={() => setViewMode('list')} className={`p-2 transition ${viewMode === 'list' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}><List className="w-4 h-4" /></button>
                </div>
              </div>

              {/* ─── Results count ─────────────────────── */}
              <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {filtered.length} {filtered.length === 1 ? t('dash_analysis_found_singular') : t('dash_analysis_found_plural')}
                {(search || statusFilter !== 'all' || sectorFilter !== 'all' || valueFilter !== 'all' || dateFilter !== 'all' || showFavoritesOnly) && (
                  <button onClick={() => { setSearch(''); setStatusFilter('all'); setSectorFilter('all'); setValueFilter('all'); setDateFilter('all'); setShowFavoritesOnly(false); }} className="ml-2 text-emerald-500 hover:text-emerald-400 transition">
                    {t('dash_clear_filters')}
                  </button>
                )}
              </p>

              {/* ─── Compare nudge card ──────────────── */}
              {completedAnalyses.length >= 2 && (
                <Link
                  to="/compare"
                  className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-3.5 mb-4 transition hover:border-emerald-400 group ${
                    isDark ? 'bg-slate-900/60 border-slate-700 hover:bg-emerald-500/5' : 'bg-white border-slate-200 hover:bg-emerald-50 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-100'}`}>
                      <BarChart3 className="w-4.5 h-4.5 text-emerald-500" />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dash_compare_valuations')}</p>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dash_compare_desc_prefix')} {completedAnalyses.length} {t('dash_compare_desc_suffix')}</p>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 flex-shrink-0 transition group-hover:translate-x-0.5 ${isDark ? 'text-slate-500 group-hover:text-emerald-400' : 'text-slate-400 group-hover:text-emerald-600'}`} />
                </Link>
              )}

              {apiError ? (
                <div className={`text-center py-16 rounded-2xl border border-dashed ${isDark ? 'border-red-900 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
                  <Shield className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-red-400' : 'text-red-400'}`} />
                  <p className={`text-sm font-medium mb-2 ${isDark ? 'text-red-300' : 'text-red-600'}`}>{t('dash_error_loading')}</p>
                  <button onClick={loadAnalyses} className="text-sm text-emerald-500 hover:text-emerald-400 font-medium transition">{t('dash_try_again')}</button>
                </div>
              ) : filtered.length === 0 && !apiError ? (
                <>
                  {(!search && statusFilter === 'all' && sectorFilter === 'all' && valueFilter === 'all' && dateFilter === 'all' && !showFavoritesOnly) ? (
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
                        <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {t('dash_create_first_5min')}
                        </h3>
                        <p className={`text-sm mb-6 max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {t('dash_create_first_desc')}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 justify-center text-xs mb-8">
                          {['DCF + Sector multiples', 'Risk score 0–100', 'Valuora Intelligence Analysis'].map((f) => (
                            <span key={f} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                              {f}
                            </span>
                          ))}
                        </div>
                        <Link
                          to="/new-analysis"
                          className="inline-flex items-center gap-2 px-7 py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:brightness-110 transition-colors duration-200"
                        >
                          <Plus className="w-4 h-4" />
                          {t('dash_create_first_free')}
                        </Link>
                      </div>
                    </div>
                  ) : (
                    /* ─── Filter empty state ── */
                    <div className={`text-center py-16 rounded-2xl border border-dashed ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                        <Search className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                      </div>
                      <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dash_no_analysis_found')}</h3>
                      <p className={`text-sm mb-6 max-w-sm mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dash_filter_adjust')}</p>
                      <button
                        onClick={() => { setSearch(''); setStatusFilter('all'); setSectorFilter('all'); setValueFilter('all'); setDateFilter('all'); setShowFavoritesOnly(false); }}
                        className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                      >
                        <X className="w-4 h-4" />
                        {t('dash_clear_filters')}
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
                        className={`group relative rounded-2xl border transition-colors duration-200 overflow-hidden ${
                          isSelected
                            ? isDark ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-500/5' : 'border-emerald-400 ring-1 ring-emerald-300 bg-emerald-50/50'
                            : isDark ? 'bg-slate-900 border-slate-700 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        {/* D2: Status left border */}
                        <div className={`absolute left-0 inset-y-0 w-[3px] z-10 ${
                          a.status === 'completed' ? 'bg-emerald-500' :
                          a.status === 'processing' ? 'bg-yellow-400' :
                          isDark ? 'bg-slate-700' : 'bg-slate-200'
                        }`} />
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
                          to={`/analysis/${a.id}`}
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
                              <p className={`text-2xl font-semibold tabular-nums mt-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtBRL(a.equity_value)}</p>
                            ) : (
                        <p className={`text-sm italic ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{t('dash_awaiting_result')}</p>
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
                                <span className={`text-[10px] tabular-nums whitespace-nowrap ${a.risk_score >= 70 ? (isDark ? 'text-red-400' : 'text-red-500') : a.risk_score >= 40 ? (isDark ? 'text-yellow-400' : 'text-yellow-600') : (isDark ? 'text-emerald-400' : 'text-emerald-600')}`}>
                                  risk {a.risk_score.toFixed(0)}
                                </span>
                              </div>
                            )}

                            <div className={`flex items-center justify-between mt-4 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                {new Date(a.created_at).toLocaleDateString('en-US')}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation();
                                    setQuickEditForm({ company_name: a.company_name, revenue: a.revenue || '', net_margin: a.net_margin != null ? parseFloat((a.net_margin * 100).toFixed(2)) : '', ebitda: a.ebitda || '' });
                                    setQuickEditId(a.id);
                                  }}
                                  className={`p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                                  title="Quick edit"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteAnalysis(a.id, a.company_name); }}
                                  className={`p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 ${isDark ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-500'}`}
                                  title="Delete"
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
                                          link.download = `report-${a.company_name}.pdf`;
                                          link.click();
                                          window.URL.revokeObjectURL(url);
                                          toast.success(t('dash_pdf_downloaded'));
                                        })
                                        .catch(() => toast.error(t('dash_error_pdf')));
                                    }}
                                    className={`p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 ${isDark ? 'hover:bg-emerald-500/10 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-500'}`}
                                    title="Download PDF"
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
                <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className={isDark ? 'border-b border-slate-800' : 'border-b border-slate-200'}>
                        {[t('dash_col_company'), t('dash_col_sector'), t('dash_col_value'), t('dash_col_status'), t('dash_col_risk'), t('dash_col_date')].map((h) => (
                          <th key={h} className={`text-left text-xs font-semibold uppercase tracking-wide px-5 py-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((a) => (
                        <tr
                          key={a.id}
                          onClick={() => navigate(`/analysis/${a.id}`)}
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
                              {new Date(a.created_at).toLocaleDateString('en-US')}
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
                    Page {page} of {totalPages} ({totalCount} {t('dash_analysis_created_plural')})
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {t('dash_previous')}
                    </button>
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                      const p = start + i;
                      if (p > totalPages) return null;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-9 h-9 text-sm rounded-lg transition-colors duration-200 font-medium ${
                            p === page
                              ? 'bg-emerald-600 text-white'
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
                      {t('dash_next')}
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
        </main>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title={t('dash_delete_title')}
        message={t('dash_delete_message').replace('{name}', deleteConfirm.name)}
        confirmLabel={t('dash_delete_title')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDeleteAnalysis}
        onCancel={() => setDeleteConfirm({ open: false, id: null, name: '' })}
      />

      {/* Onboarding tour — shown once for new users with 0 analyses */}
      <OnboardingTour totalAnalyses={kpis.total} />

      {/* Onboarding wizard — methodology intro for first-time users */}
      <OnboardingWizard analysisCount={kpis.total} />

      {/* Quick Edit Modal */}
      {quickEditId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setQuickEditId(null)} />
          <div className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold text-lg mb-5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dash_quick_edit_heading')}</h3>
            <div className="space-y-4">
              {[
                { key: 'company_name', labelKey: 'dash_field_company_name' },
                { key: 'revenue', labelKey: 'dash_field_annual_revenue' },
                { key: 'net_margin', labelKey: 'dash_field_net_margin' },
                { key: 'ebitda', labelKey: 'dash_field_ebitda' },
              ].map(({ key, labelKey }) => (
                <div key={key}>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t(labelKey)}</label>
                  <input
                    value={quickEditForm[key] || ''}
                    onChange={(e) => setQuickEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setQuickEditId(null)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {t('common_cancel')}
              </button>
              <button
                disabled={quickEditSaving}
                onClick={async () => {
                  setQuickEditSaving(true);
                  try {
                    await api.patch(`/analyses/${quickEditId}`, quickEditForm);
                    toast.success(t('dash_quick_edit_saved'));
                    loadAnalyses();
                    setQuickEditId(null);
                  } catch {
                    toast.error(t('dash_quick_edit_error'));
                  } finally {
                    setQuickEditSaving(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:brightness-110 transition-colors duration-200 disabled:opacity-50"
              >
                {quickEditSaving ? t('common_saving') : t('common_save')}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
  );
}
