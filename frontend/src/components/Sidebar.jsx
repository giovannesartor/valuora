import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, Shield, LogOut, Settings,
  ChevronLeft, ChevronRight, User,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/nova-analise', icon: PlusCircle, label: 'Nova Análise' },
];

const ADMIN_ITEMS = [
  { path: '/admin', icon: Shield, label: 'Admin' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, isSuperAdmin } = useAuthStore();
  const { isDark } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <aside className={`fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-300 border-r ${
      isDark ? 'bg-slate-950 border-slate-800/60' : 'bg-white border-slate-200'
    } ${collapsed ? 'w-[72px]' : 'w-[240px]'}`}>

      {/* Logo */}
      <div className={`h-16 flex items-center px-5 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
        <img src="/favicon.svg" alt="QV" className="w-8 h-8 flex-shrink-0" />
        {!collapsed && (
          <span className={`ml-3 font-bold text-base tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Quanto Vale
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive(item.path)
                ? isDark
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-blue-50 text-blue-600'
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive(item.path) ? '' : ''}`} />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        ))}

        {(isAdmin || isSuperAdmin) && (
          <>
            <div className={`my-3 mx-3 h-px ${isDark ? 'bg-slate-800/60' : 'bg-slate-200'}`} />
            {ADMIN_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname.startsWith('/admin')
                    ? isDark
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-blue-50 text-blue-600'
                    : isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className={`p-3 border-t space-y-2 ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
        {/* Theme toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'px-3'}`}>
          <ThemeToggle />
          {!collapsed && (
            <span className={`ml-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Tema</span>
          )}
        </div>

        {/* Profile card */}
        <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-900/80' : 'bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${isDark ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white' : 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white'}`}>
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {user?.full_name || 'Usuário'}
                </p>
                <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {user?.email || ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sair' : undefined}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isDark
              ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
              : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
          }`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className={`flex items-center justify-center w-full py-2 rounded-xl transition ${
            isDark
              ? 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/60'
              : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'
          }`}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
