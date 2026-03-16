import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bell, TrendingUp, CreditCard, FileText,
  CheckCircle2, Clock, AlertTriangle, CheckCheck, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import { useI18n } from '../lib/i18n';

const TYPE_CONFIG = {
  analysis: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  payment:  { icon: CreditCard,  color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
  pitchdeck:{ icon: FileText,    color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
};

const FILTER_TABS = [
  { key: 'all',       label: 'All'     },
  { key: 'analysis',  label: 'Analyses'  },
  { key: 'payment',   label: 'Payments'},
  { key: 'pitchdeck', label: 'Pitch Deck'},
];

export default function NotificationsPage() {
  usePageTitle('Notifications');
  const { t } = useI18n();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data || []);
    } catch {
      toast.error('Error loading notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = async (key) => {
    try {
      await api.patch(`/notifications/${key}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === key ? { ...n, unread: false } : n)
      );
    } catch {
      // silently ignore
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
      toast.success('All marked as read!');
    } catch {
      toast.error('Error marking all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const filtered = notifications.filter(n => {
    if (activeTab === 'all') return true;
    return n.type === activeTab;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('notifications')} {unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-500">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Track your recent events
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} disabled:opacity-50`}
          >
            {markingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className={`flex gap-1 p-1 rounded-xl mb-5 ${isDark ? 'bg-slate-800/60' : 'bg-slate-100'}`}>
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === tab.key
                ? isDark ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-900 shadow'
                : isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : paginated.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <Bell className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          </div>
          <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>No notifications</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nothing here yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((notif) => {
            const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.analysis;
            const IconComp = cfg.icon;
            return (
              <div
                key={notif.key}
                className={`flex items-start gap-4 p-4 rounded-xl border transition ${
                  notif.unread
                    ? isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
                    : isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                  <IconComp className={`w-4.5 h-4.5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{notif.title}</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{notif.text}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Clock className={`w-3 h-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{notif.time}</span>
                  </div>
                </div>
                {notif.unread ? (
                  <button
                    onClick={() => markRead(notif.id)}
                    title="Mark as read"
                    className={`p-1.5 rounded-lg flex-shrink-0 transition ${isDark ? 'hover:bg-slate-800 text-emerald-400' : 'hover:bg-slate-100 text-emerald-500'}`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 self-center ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-40 ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Anterior
          </button>
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-40 ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Próximo
          </button>
        </div>
      )}
    </div>
  );
}
