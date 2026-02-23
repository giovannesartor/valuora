import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, BarChart3, CreditCard, TrendingUp, LogOut,
  FileText, DollarSign, Activity, Shield, ArrowUpRight,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../lib/api';

export default function AdminDashboardPage() {
  const { user, fetchUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
    api.get('/admin/stats')
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const statCards = stats
    ? [
        { label: 'Total Usuários', value: stats.total_users, icon: Users, color: 'blue' },
        { label: 'Análises Realizadas', value: stats.total_analyses, icon: BarChart3, color: 'cyan' },
        { label: 'Pagamentos', value: stats.total_payments, icon: CreditCard, color: 'green' },
        { label: 'Receita Total', value: formatBRL(stats.total_revenue), icon: DollarSign, color: 'emerald' },
        { label: 'Novos (7d)', value: stats.users_last_7_days, icon: TrendingUp, color: 'purple' },
        { label: 'Análises (7d)', value: stats.analyses_last_7_days, icon: Activity, color: 'orange' },
      ]
    : [];

  const colorMap = {
    blue: 'bg-emerald-500/10 text-emerald-500',
    cyan: 'bg-teal-500/10 text-teal-500',
    green: 'bg-green-500/10 text-green-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    purple: 'bg-purple-500/10 text-purple-500',
    orange: 'bg-orange-500/10 text-orange-500',
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 w-64 h-full bg-slate-900 border-r border-slate-800 z-40">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Admin Panel</p>
              <p className="text-slate-500 text-xs">Quanto Vale</p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { to: '/admin', icon: BarChart3, label: 'Dashboard', active: true },
              { to: '/admin/usuarios', icon: Users, label: 'Usuários' },
              { to: '/admin/analises', icon: FileText, label: 'Análises' },
              { to: '/admin/pagamentos', icon: CreditCard, label: 'Pagamentos' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  item.active
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-800">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-3 transition">
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
      </aside>

      {/* Main content */}
      <main className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
              <p className="text-slate-500 mt-1">
                Bem-vindo, {user?.full_name?.split(' ')[0] || 'Admin'}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              SUPERADMIN
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-slate-500">Carregando dados...</div>
          ) : (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {statCards.map((card, i) => (
                  <div
                    key={i}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[card.color]}`}>
                        <card.icon className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">{card.value}</p>
                    <p className="text-sm text-slate-500">{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Quick links */}
              <div className="grid md:grid-cols-3 gap-4">
                <Link
                  to="/admin/usuarios"
                  className="group bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 transition"
                >
                  <Users className="w-6 h-6 text-emerald-400 mb-3" />
                  <h3 className="text-white font-semibold mb-1">Gerenciar Usuários</h3>
                  <p className="text-sm text-slate-500">Ativar, desativar, verificar contas.</p>
                </Link>
                <Link
                  to="/admin/analises"
                  className="group bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-teal-500/50 transition"
                >
                  <FileText className="w-6 h-6 text-teal-400 mb-3" />
                  <h3 className="text-white font-semibold mb-1">Ver Análises</h3>
                  <p className="text-sm text-slate-500">Todas as análises da plataforma.</p>
                </Link>
                <Link
                  to="/admin/pagamentos"
                  className="group bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-green-500/50 transition"
                >
                  <CreditCard className="w-6 h-6 text-green-400 mb-3" />
                  <h3 className="text-white font-semibold mb-1">Pagamentos</h3>
                  <p className="text-sm text-slate-500">Acompanhar receita e cobranças.</p>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
