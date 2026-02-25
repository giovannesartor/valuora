import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, Shield, LogOut, Settings,
  ChevronLeft, ChevronRight, User, X, Briefcase, Trash2, GitCompareArrows,
  Bell, Users, DollarSign, CreditCard,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', showCount: true, partnerVisible: false },
  { path: '/nova-analise', icon: PlusCircle, label: 'Nova Análise', showCount: false, partnerVisible: false },
  { path: '/lixeira', icon: Trash2, label: 'Lixeira', showCount: true, partnerVisible: false },
  { path: '/comparar', icon: GitCompareArrows, label: 'Comparar', showCount: false, partnerVisible: false },
  { path: '/perfil', icon: Settings, label: 'Meu Perfil', showCount: false, partnerVisible: true },
];

const PARTNER_ITEMS = [
  { path: '/parceiro/dashboard',  icon: Briefcase,     label: 'Visão Geral'  },
  { path: '/parceiro/clientes',   icon: Users,         label: 'Clientes'     },
  { path: '/parceiro/comissoes',  icon: DollarSign,    label: 'Comissões'    },
  { path: '/parceiro/financeiro', icon: CreditCard,    label: 'Financeiro'   },
];

const ADMIN_ITEMS = [
  { path: '/admin', icon: Shield, label: 'Admin' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, isSuperAdmin, isPartner } = useAuthStore();
  const { isDark } = useTheme();
  const [itemCounts, setItemCounts] = useState({ dashboard: 0, lixeira: 0 });
  const [processingCount, setProcessingCount] = useState(0);

  // Fetch counts for navigation items
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [dashboardRes, trashRes, processingRes] = await Promise.all([
          api.get('/analyses/', { params: { page_size: 1, status: 'completed' } }),
          api.get('/analyses/trash', { params: { page_size: 1 } }),
          api.get('/analyses/', { params: { page_size: 1, status: 'processing' } }),
        ]);
        
        setItemCounts({
          dashboard: dashboardRes.data.total || 0,
          lixeira: trashRes.data.total || 0,
        });
        setProcessingCount(processingRes.data.total || 0);
      } catch {
        // Silently fail - counts will remain at 0
      }
    };

    fetchCounts();
    // Refresh counts every 30 seconds
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

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
        <img src="/favicon.svg?v=2" alt="QV" className="w-8 h-8 flex-shrink-0" loading="lazy" />
        {!collapsed && (
          <span className={`ml-3 font-bold text-base tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Quanto Vale
          </span>
        )}
        {/* Processing indicator */}
        {processingCount > 0 && (
          <div className={`ml-auto flex items-center gap-1.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            {!collapsed && (
              <span className="text-xs font-medium">
                {processingCount} processando
              </span>
            )}
            <span className={`relative flex h-2 w-2 ${collapsed ? 'ml-auto' : ''}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          </div>
        )}
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className={`ml-auto md:hidden p-1 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav data-tour="sidebar" className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {/* Only show full nav for non-partner-only users; partners always see items marked partnerVisible */}
        {NAV_ITEMS.filter(item =>
          !(isPartner && !isAdmin && !isSuperAdmin) || item.partnerVisible
        ).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive(item.path)
                ? isDark
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-emerald-50 text-emerald-600'
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive(item.path) ? '' : ''}`} />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && item.showCount && (
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                isActive(item.path)
                  ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                  : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
              }`}>
                {item.path === '/dashboard' ? itemCounts.dashboard : item.path === '/lixeira' ? itemCounts.lixeira : 0}
              </span>
            )}
          </Link>
        ))}

        {isPartner && (
          <>
            <div className={`my-3 mx-3 h-px ${isDark ? 'bg-slate-800/60' : 'bg-slate-200'}`} />
            {!collapsed && (
              <p className={`px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Parceiro</p>
            )}
            {PARTNER_ITEMS.map(item => (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === item.path
                    ? isDark
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-emerald-50 text-emerald-600'
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
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-emerald-50 text-emerald-600'
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
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${isDark ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white' : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white'}`}>
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
    </>
  );
}
