import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BarChart3, CreditCard, TrendingUp,
  FileText, DollarSign, Activity, Briefcase,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

export default function AdminDashboardPage() {
  const { user, fetchUser } = useAuthStore();
  const { isDark } = useTheme();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    fetchUser();
    api.get('/admin/stats')
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Fetch partners for management section
    api.get('/partners/admin/all').then(r => setPartners(r.data)).catch(() => {});
  }, []);

  const formatBRL = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const statCards = stats
    ? [
        { label: 'Total Usuários', value: stats.total_users, icon: Users, color: 'from-blue-500 to-indigo-500' },
        { label: 'Análises', value: stats.total_analyses, icon: BarChart3, color: 'from-teal-500 to-cyan-500' },
        { label: 'Pagamentos', value: stats.total_payments, icon: CreditCard, color: 'from-green-500 to-emerald-500' },
        { label: 'Receita Total', value: formatBRL(stats.total_revenue), icon: DollarSign, color: 'from-emerald-500 to-teal-500' },
        { label: 'Usuarios recentes', value: stats.recent_users, icon: TrendingUp, color: 'from-purple-500 to-violet-500' },
        { label: 'Concluídas', value: stats.completed_analyses, icon: Activity, color: 'from-orange-500 to-amber-500' },
      ]
    : [];

  const chartData = stats ? [
    { name: 'Usuários', total: stats.total_users, verified: stats.verified_users },
    { name: 'Análises', total: stats.total_analyses, verified: stats.completed_analyses },
    { name: 'Pagamentos', total: stats.total_payments, verified: stats.paid_payments },
  ] : [];

  const pieData = stats ? [
    { name: 'Verificados', value: stats.verified_users, color: '#10b981' },
    { name: 'Não verif.', value: Math.max(0, stats.total_users - stats.verified_users), color: '#64748b' },
  ] : [];

  return (
    <>
      <main className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel Administrativo</h1>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Bem-vindo, {user?.full_name?.split(' ')[0] || 'Admin'}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              SUPERADMIN
            </div>
          </div>

          {loading ? (
            <div className="animate-pulse grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className={`h-10 w-10 rounded-xl mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className={`h-7 w-20 rounded mb-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className={`h-4 w-28 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {statCards.map((card, i) => (
                  <div key={i} className={`rounded-2xl border p-5 md:p-6 transition ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                        <card.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                      </div>
                    </div>
                    <p className={`text-xl md:text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{card.value}</p>
                    <p className={`text-xs md:text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid lg:grid-cols-2 gap-6 mb-8">
                <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Visão geral</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 12 }} />
                      <Bar dataKey="total" fill="#64748b" radius={[6, 6, 0, 0]} name="Total" />
                      <Bar dataKey="verified" fill="#10b981" radius={[6, 6, 0, 0]} name="Ativos" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Usuários verificados</h3>
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={45}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderRadius: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {pieData.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{s.name}: {s.value}</span>
                        </div>
                      ))}
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {stats.verified_users && stats.total_users ? `${((stats.verified_users / stats.total_users) * 100).toFixed(0)}% verificados` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Partner Management */}
              {partners.length > 0 && (
                <div className={`rounded-2xl border p-6 mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <Briefcase className="inline w-4 h-4 mr-2 text-emerald-500" />
                      Parceiros ({partners.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={isDark ? 'border-b border-slate-800' : 'border-b border-slate-200'}>
                          {['Empresa', 'Código', 'Status', 'Comissão', 'Clientes'].map(h => (
                            <th key={h} className={`text-left px-4 py-2 text-xs font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {partners.slice(0, 10).map(p => (
                          <tr key={p.id} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                            <td className={`px-4 py-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.company_name || '—'}</td>
                            <td className={`px-4 py-3 font-mono text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{p.referral_code}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-400'}`}>
                                {p.status === 'active' ? 'Ativo' : p.status}
                              </span>
                            </td>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{(p.commission_rate * 100).toFixed(0)}%</td>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.total_clients || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                <Link
                  to="/admin/usuarios"
                  className={`group rounded-2xl border p-6 transition ${isDark ? 'bg-slate-900 border-slate-800 hover:border-emerald-500/50' : 'bg-white border-slate-200 hover:border-emerald-400 shadow-sm'}`}
                >
                  <Users className="w-6 h-6 text-emerald-400 mb-3" />
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Gerenciar Usuários</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ativar, desativar, verificar contas.</p>
                </Link>
                <Link
                  to="/admin/analises"
                  className={`group rounded-2xl border p-6 transition ${isDark ? 'bg-slate-900 border-slate-800 hover:border-teal-500/50' : 'bg-white border-slate-200 hover:border-teal-400 shadow-sm'}`}
                >
                  <FileText className="w-6 h-6 text-teal-400 mb-3" />
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Ver Análises</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Todas as análises da plataforma.</p>
                </Link>
                <Link
                  to="/admin/pagamentos"
                  className={`group rounded-2xl border p-6 transition ${isDark ? 'bg-slate-900 border-slate-800 hover:border-green-500/50' : 'bg-white border-slate-200 hover:border-green-400 shadow-sm'}`}
                >
                  <CreditCard className="w-6 h-6 text-green-400 mb-3" />
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Pagamentos</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Acompanhar receita e cobranças.</p>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
