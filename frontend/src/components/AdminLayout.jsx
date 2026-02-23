import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { useTheme } from '../context/ThemeContext';
import { Menu } from 'lucide-react';

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <AdminSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="md:ml-64 transition-all duration-300">
        {/* Mobile top bar */}
        <div className={`md:hidden flex items-center h-14 px-4 border-b sticky top-0 z-30 backdrop-blur-xl ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
          <button
            onClick={() => setMobileOpen(true)}
            className={`p-2 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className={`ml-3 font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Admin Panel</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
