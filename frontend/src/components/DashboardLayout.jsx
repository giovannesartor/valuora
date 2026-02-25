import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import PageTransition from './PageTransition';
import { useTheme } from '../context/ThemeContext';

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isDark } = useTheme();
  const location = useLocation();

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className={`transition-all duration-300 ${collapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'}`}>
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
            <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Quanto Vale</span>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            <Outlet context={{ collapsed, setMobileOpen }} />
          </PageTransition>
        </AnimatePresence>
      </div>
    </div>
  );
}
