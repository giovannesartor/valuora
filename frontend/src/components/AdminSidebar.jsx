import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Users, FileText, CreditCard, Shield, Tag,
  ArrowUpRight, LogOut, Menu, X, Briefcase, ClipboardList,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { to: '/admin', icon: BarChart3, label: 'Dashboard' },
  { to: '/admin/usuarios', icon: Users, label: 'Usuários' },
  { to: '/admin/analises', icon: FileText, label: 'Análises' },
  { to: '/admin/pagamentos', icon: CreditCard, label: 'Pagamentos' },
  { to: '/admin/cupons', icon: Tag, label: 'Cupons' },
  { to: '/admin/audit-log', icon: ClipboardList, label: 'Audit Log' },
];

export default function AdminSidebar({ mobileOpen, onMobileClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { isDark } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (to) => {
    if (to === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(to);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Admin Panel</p>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Quanto Vale</p>
          </div>
          <button onClick={onMobileClose} className="md:hidden ml-auto text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onMobileClose}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive(item.to)
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className={`mt-auto p-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <Link to="/dashboard" className={`flex items-center gap-2 text-sm mb-3 transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
          <ArrowUpRight className="w-4 h-4" />
          Ir para plataforma
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`fixed left-0 top-0 w-64 h-full border-r z-40 hidden md:block ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onMobileClose} />
          <aside className={`fixed left-0 top-0 w-64 h-full border-r z-50 md:hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
