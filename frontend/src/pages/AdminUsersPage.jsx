import { useEffect, useState } from 'react';
import {
  Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, Filter, Download,
  Trash2, UserCheck, UserX,
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import ConfirmDialog from '../components/ConfirmDialog';

export default function AdminUsersPage() {
  const { isDark } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: '' });
  const limit = 20;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { skip: (page - 1) * limit, limit };
      if (search) params.search = search;
      if (statusFilter === 'active') params.is_active = true;
      if (statusFilter === 'inactive') params.is_active = false;
      if (statusFilter === 'verified') params.is_verified = true;
      if (statusFilter === 'unverified') params.is_verified = false;
      const { data } = await api.get('/admin/users', { params });
      setUsers(data.users || data);
      setTotal(data.total ?? (data.users || data).length);
    } catch {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page, statusFilter]);

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

  const confirmDeleteUser = async () => {
    try {
      await api.delete(`/admin/users/${deleteConfirm.id}`);
      toast.success('Usuário excluído');
      setDeleteConfirm({ open: false, id: null, name: '' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao excluir');
    }
  };

  const promotePartner = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/promote-partner`);
      toast.success('Usuário promovido a parceiro');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao promover');
    }
  };

  const demotePartner = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/demote-partner`);
      toast.success('Parceiro removido');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao remover parceiro');
    }
  };

  const totalPages = Math.ceil(total / limit);

  const cls = {
    card: isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
    title: isDark ? 'text-white' : 'text-slate-900',
    sub: isDark ? 'text-slate-500' : 'text-slate-400',
    th: isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-200',
    row: isDark ? 'hover:bg-slate-800/50 divide-slate-800' : 'hover:bg-slate-50 divide-slate-100',
    input: isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400',
    pagination: isDark ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-300 text-slate-500 hover:text-slate-900',
  };

  return (
    <>
      <main className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className={`text-xl md:text-2xl font-bold ${cls.title}`}>Usuários</h1>
              <p className={`mt-1 text-sm ${cls.sub}`}>{total} usuários cadastrados</p>
            </div>
            <a
              href={`${import.meta.env.VITE_API_URL || '/api/v1'}/admin/export/users`}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </a>
          </div>

          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou email..."
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${cls.input}`}
                />
              </div>
            </form>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className={`pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-emerald-500 appearance-none ${cls.input}`}
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="verified">Verificados</option>
                <option value="unverified">Não verificados</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className={`border rounded-2xl overflow-hidden ${cls.card}`}>
            {loading ? (
              <div className="animate-pulse p-6 space-y-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={`h-12 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${cls.th}`}>
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Nome</th>
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell ${cls.th}`}>Email</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Verificado</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Ativo</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden md:table-cell ${cls.th}`}>Análises</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Ações</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                    {users.map((u) => (
                      <tr key={u.id} className={`transition ${cls.row}`}>
                        <td className="px-4 md:px-6 py-4">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-medium ${cls.title}`}>{u.full_name}</p>
                              {u.is_partner && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400">
                                  Parceiro
                                </span>
                              )}
                            </div>
                            {u.company_name && (
                              <p className={`text-xs ${cls.sub}`}>{u.company_name}</p>
                            )}
                            <p className={`text-xs sm:hidden ${cls.sub}`}>{u.email}</p>
                          </div>
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-sm hidden sm:table-cell ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{u.email}</td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          {u.is_verified ? (
                            <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {u.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-center text-sm hidden md:table-cell ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {u.analyses_count ?? '—'}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
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
                                className="text-xs px-3 py-1 rounded-lg font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                              >
                                Verificar
                              </button>
                            )}
                            {u.is_partner ? (
                              <button
                                onClick={() => demotePartner(u.id)}
                                title="Remover parceiro"
                                className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => promotePartner(u.id)}
                                title="Tornar parceiro"
                                className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!u.is_superadmin && (
                              <button
                                onClick={() => setDeleteConfirm({ open: true, id: u.id, name: u.full_name })}
                                title="Excluir usuário"
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
              <p className={`text-sm ${cls.sub}`}>
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className={`p-2 border rounded-lg disabled:opacity-50 transition ${cls.pagination}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className={`p-2 border rounded-lg disabled:opacity-50 transition ${cls.pagination}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Excluir usuário"
        message={`Tem certeza que deseja excluir "${deleteConfirm.name}"? Esta ação é irreversível e apagará todas as análises e pagamentos do usuário.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={confirmDeleteUser}
        onCancel={() => setDeleteConfirm({ open: false, id: null, name: '' })}
      />
    </>
  );
}
