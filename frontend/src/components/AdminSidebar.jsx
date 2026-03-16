import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Users, FileText, CreditCard, Shield, Tag,
  ArrowUpRight, LogOut, X, ClipboardList, AlertTriangle,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from '../lib/i18n';
import api from '../lib/api';

const NAV_ITEMS = [
  { to: '/admin',           icon: BarChart3,    key: 'admin_dashboard'     },
  { to: '/admin/users',  icon: Users,        key: 'admin_users'      },
  { to: '/admin/analyses',  icon: FileText,     key: 'admin_analyses'      },
  { to: '/admin/payments',icon: CreditCard,   key: 'admin_payments'    },
  { to: '/admin/coupons',    icon: Tag,          key: 'admin_coupons'        },
  { to: '/admin/audit-log', icon: ClipboardList,key: 'admin_audit_log',    badgeKey: 'pending_payout' },
  { to: '/admin/error-logs',icon: AlertTriangle,key: 'admin_error_logs', badgeKey: 'error_logs'     },
];

export default function AdminSidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [sidebarCounts, setSidebarCounts] = useState({});

  useEffect(() => {
    const fetchCounts = () => {
      if (document.visibilityState === 'hidden') return;
      api.get('/admin/sidebar-counts').then(r => setSidebarCounts(r.data)).catch(() => {});
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 60_000);
    const onVisChange = () => { if (document.visibilityState === 'visible') fetchCounts(); };
    document.addEventListener('visibilitychange', onVisChange);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisChange); };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (to) => {
    if (to === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(to);
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'A';

  return (
    <>
      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside className={`fixed top-0 left-0 h-screen z-50 flex flex-col transition-all duration-300 border-r ${
        isDark ? 'bg-slate-950 border-slate-800/60' : 'bg-white border-slate-200'
      } ${collapsed ? 'w-[72px]' : 'w-[240px]'} ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>

        {/* Logo */}
        <div className={`h-16 flex items-center px-5 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="ml-3 min-w-0">
              <span className={`font-semibold text-sm tracking-tight block truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('admin_panel')}
              </span>
              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Valuora</span>
            </div>
          )}
          <button
            onClick={onMobileClose}
            className={`ml-auto md:hidden p-1 rounded-lg transition-colors duration-200 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {!collapsed && (
            <p className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('administration')}</p>
          )}
          {NAV_ITEMS.map((item) => {
            const badgeCount = item.badgeKey ? (sidebarCounts[item.badgeKey] || 0) : 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onMobileClose}
                title={collapsed ? t(item.key) : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
                  isActive(item.to)
                    ? isDark
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-emerald-50 text-emerald-600'
                    : isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="relative flex-shrink-0">
                  <item.icon className="w-5 h-5" />
                  {collapsed && badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                  )}
                </span>
                {!collapsed && <span className="truncate flex-1">{t(item.key)}</span>}
                {!collapsed && badgeCount > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className={`p-3 border-t space-y-2 ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between px-3'}`}>
            <ThemeToggle />
            {!collapsed && <LanguageSwitcher />}
          </div>

          <Link
            to="/dashboard"
            title={collapsed ? t('admin_go_platform') : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            <ArrowUpRight className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{t('admin_go_platform')}</span>}
          </Link>

          <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-900/80' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-semibold bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
                {initials}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {user?.full_name || 'Admin'}
                  </p>
                  <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {user?.email || ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            title={collapsed ? t('admin_logout') : undefined}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
              isDark
                ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
            }`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{t('admin_logout')}</span>}
          </button>

          <button
            onClick={onToggle}
            className={`flex items-center justify-center w-full py-2 rounded-xl transition-colors duration-200 ${
              isDark
                ? 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/60'
                : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'
            }`}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
