import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BarChart3, CreditCard, FileText, Shield,
  Search, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  ArrowUpRight, LogOut,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function AdminUsersPage() {
  const { logout } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { skip: (page - 1) * limit, limit };
      if (search) params.search = search;
      const { data } = await api.get('/admin/users', { params });
      setUsers(data.users || data);
      setTotal(data.total || data.length);
    } catch {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const toggleActive = async (userId) => {
    try {
      await api.patch(`/admin/users/${userId}/toggle-active`);
      toast.success('Status atualizado');
      fetchUsers();
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const verifyUser = async (userId) => {
    try {
      await api.patch(`/admin/users/${userId}/verify`);
      toast.success('Usuário verificado');
      fetchUsers();
    } catch {
      toast.error('Erro ao verificar');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 w-64 h-full bg-slate-900 border-r border-slate-800 z-40">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Admin Panel</p>
              <p className="text-slate-500 text-xs">Quanto Vale</p>
            </div>
          </div>
          <nav className="space-y-1">
            {[
              { to: '/admin', icon: BarChart3, label: 'Dashboard' },
              { to: '/admin/usuarios', icon: Users, label: 'Usuários', active: true },
              { to: '/admin/analises', icon: FileText, label: 'Análises' },
              { to: '/admin/pagamentos', icon: CreditCard, label: 'Pagamentos' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  item.active
                    ? 'bg-blue-500/10 text-blue-400'
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
          <button onClick={() => { logout(); window.location.href = '/'; }} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition">
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Usuários</h1>
              <p className="text-slate-500 mt-1">{total} usuários cadastrados</p>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </form>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="text-center py-20 text-slate-500">Carregando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Verificado</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ativo</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Análises</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/50 transition">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-white">{u.full_name}</p>
                            {u.company_name && (
                              <p className="text-xs text-slate-500">{u.company_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">{u.email}</td>
                        <td className="px-6 py-4 text-center">
                          {u.is_verified ? (
                            <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {u.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-slate-400">
                          {u.analyses_count ?? '—'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleActive(u.id)}
                              className={`text-xs px-3 py-1 rounded-lg font-medium transition ${
                                u.is_active
                                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                  : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                              }`}
                            >
                              {u.is_active ? 'Desativar' : 'Ativar'}
                            </button>
                            {!u.is_verified && (
                              <button
                                onClick={() => verifyUser(u.id)}
                                className="text-xs px-3 py-1 rounded-lg font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition"
                              >
                                Verificar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-slate-500">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
