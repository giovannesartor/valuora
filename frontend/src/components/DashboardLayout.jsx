import { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import PageTransition from './PageTransition';
import WhatsAppButton from './WhatsAppButton';
import { useTheme } from '../context/ThemeContext';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { MailCheck, X, LayoutDashboard, PlusCircle, GitCompareArrows, Bell, User } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import useNotificationSSE from '../lib/useNotificationSSE.jsx';

// ─── Mobile bottom tab navigation ─────────────────────────
const BOTTOM_TAB_DEFS = [
  { path: '/dashboard',  icon: LayoutDashboard, key: 'dl_tab_home' },
  { path: '/new-analysis', icon: PlusCircle, key: 'dl_tab_new' },
  { path: '/compare',   icon: GitCompareArrows, key: 'dl_tab_compare' },
  { path: '/notifications', icon: Bell, key: 'dl_tab_alerts' },
  { path: '/profile',     icon: User, key: 'dl_tab_profile' },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isDark } = useTheme();
  const location = useLocation();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [dismissedBanner, setDismissedBanner] = useState(() => !!sessionStorage.getItem('qv_email_banner_dismissed'));
  const [resending, setResending] = useState(false);

  // SSE real-time toast notifications
  useNotificationSSE();

  const showVerifyBanner = user && !user.is_verified && !user.is_admin && !dismissedBanner;

  const handleResendEmail = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: user.email });
      toast.success(t('dl_verify_success'));
    } catch {
      toast.error(t('dl_verify_error'));
    } finally {
      setResending(false);
    }
  };

  const handleDismissBanner = () => {
    sessionStorage.setItem('qv_email_banner_dismissed', '1');
    setDismissedBanner(true);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className={`transition-all duration-300 ${collapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'} pb-16 md:pb-0`}>
        {/* Email verification banner (item 9) */}
        {showVerifyBanner && (
          <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${isDark ? 'bg-amber-500/10 border-b border-amber-500/20 text-amber-300' : 'bg-amber-50 border-b border-amber-200 text-amber-800'}`}>
            <MailCheck className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{t('dl_verify_email')}</span>
            <button
              onClick={handleResendEmail}
              disabled={resending}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition disabled:opacity-50 ${isDark ? 'bg-amber-500/20 hover:bg-amber-500/30' : 'bg-amber-200 hover:bg-amber-300'}`}
            >
              {resending ? t('dl_sending') : t('dl_resend_email')}
            </button>
            <button onClick={handleDismissBanner} className="opacity-60 hover:opacity-100 transition" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* Mobile top bar for hamburger */}
        <div className="md:hidden flex items-center h-14 px-4 border-b sticky top-0 z-30 backdrop-blur-xl"
          style={{ borderColor: isDark ? 'rgba(30,41,59,0.6)' : 'rgba(226,232,240,1)', backgroundColor: isDark ? 'rgba(2,6,23,0.8)' : 'rgba(255,255,255,0.8)' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className={`p-2 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2 ml-3">
            <img src="/favicon.svg?v=2" alt="QV" className="w-6 h-6" />
            <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Valuora</span>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            <Outlet context={{ collapsed, setMobileOpen }} />
          </PageTransition>
        </AnimatePresence>
      </div>

      {/* Mobile bottom tab navigation */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 md:hidden border-t backdrop-blur-xl ${
          isDark ? 'bg-slate-950/90 border-slate-800/60' : 'bg-white/90 border-slate-200'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-14 px-2">
          {BOTTOM_TAB_DEFS.map(({ path, icon: Icon, key }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center gap-0.5 flex-1 py-2 rounded-lg transition-colors duration-200 ${
                  active
                    ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                    : isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
                <span className="text-[10px] font-medium">{t(key)}</span>
                {active && (
                  <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-600'}`} />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <WhatsAppButton />
    </div>
  );
}
