import { useEffect, useState } from 'react';
import {
  Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, Filter, Download,
  Trash2, UserCheck, UserX, Pencil, X,
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import ConfirmDialog from '../components/ConfirmDialog';

// ─ Helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-blue-500','bg-violet-500','bg-emerald-500','bg-rose-500',
  'bg-amber-500','bg-teal-500','bg-fuchsia-500','bg-indigo-500',
];
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] || 'bg-slate-500';
const getInitials = (name = '') => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
const relDays = (isoStr) => {
  if (!isoStr) return null;
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 86_400_000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return '1d';
  return `${diff}d`;
};

export default function AdminUsersPage() {
  const { isDark } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await api.get('/admin/export/users', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usuarios-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error exporting CSV.');
    } finally {
      setExporting(false);
    }
  };
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: '' });
  const [editModal, setEditModal] = useState({ open: false, id: null, full_name: '', company_name: '' });
  const [editSaving, setEditSaving] = useState(false);
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
      toast.error('Error loading users');
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
      toast.success('Status updated');
      fetchUsers();
    } catch {
      toast.error('Error updating');
    }
  };

  const verifyUser = async (userId) => {
    try {
      await api.patch(`/admin/users/${userId}/verify`);
      toast.success('User verified');
      fetchUsers();
    } catch {
      toast.error('Error verifying');
    }
  };

  const confirmDeleteUser = async () => {
    try {
      await api.delete(`/admin/users/${deleteConfirm.id}`);
      toast.success('User deleted');
      setDeleteConfirm({ open: false, id: null, name: '' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error deleting');
    }
  };

  const openEdit = (u) => setEditModal({ open: true, id: u.id, full_name: u.full_name, company_name: u.company_name || '' });

  const saveEdit = async () => {
    if (!editModal.full_name.trim()) { toast.error('Nome não pode ser vazio.'); return; }
    setEditSaving(true);
    try {
      await api.patch(`/admin/users/${editModal.id}/edit`, {
        full_name: editModal.full_name.trim(),
        company_name: editModal.company_name.trim() || null,
      });
      toast.success('Perfil atualizado');
      setEditModal({ open: false, id: null, full_name: '', company_name: '' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving');
    } finally {
      setEditSaving(false);
    }
  };

  const promotePartner = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/promote-partner`);
      toast.success('User promoted to partner');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error promoting');
    }
  };

  const demotePartner = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/demote-partner`);
      toast.success('Partner removed');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error removing partner');
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
              <h1 className={`text-xl md:text-2xl font-bold ${cls.title}`}>Users</h1>
              <p className={`mt-1 text-sm ${cls.sub}`}>{total} registered users</p>
            </div>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition disabled:opacity-50 ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
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
                  placeholder="Search by name or email..."
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
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>User</th>
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Status</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden md:table-cell ${cls.th}`}>Analyses</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Ações</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                    {users.map((u) => {
                      // composite status
                      let statusLabel, statusCls;
                      if (!u.is_active) {
                        statusLabel = 'Inativo'; statusCls = isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600';
                      } else if (u.has_active_plan) {
                        statusLabel = 'Paid'; statusCls = isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700';
                      } else if (u.is_verified) {
                        statusLabel = 'Verificado'; statusCls = isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700';
                      } else {
                        statusLabel = 'No plan'; statusCls = isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700';
                      }
                      const lastAct = relDays(u.last_analysis_at);
                      return (
                        <tr key={u.id} className={`transition ${cls.row}`}>
                          {/* User cell with avatar */}
                          <td className="px-4 md:px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white ${avatarColor(u.full_name)}`}>
                                {getInitials(u.full_name)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className={`text-sm font-medium truncate ${cls.title}`}>{u.full_name}</p>
                                  {u.is_partner && <span className="inline-flex px-1 py-0.5 rounded text-[9px] font-semibold bg-purple-500/10 text-purple-400">P</span>}
                                  {u.is_admin && <span className="inline-flex px-1 py-0.5 rounded text-[9px] font-semibold bg-slate-500/10 text-slate-400">A</span>}
                                </div>
                                <p className={`text-xs truncate ${cls.sub}`}>{u.email}</p>
                              </div>
                            </div>
                          </td>
                          {/* Composite status */}
                          <td className="px-4 md:px-6 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusCls}`}>{statusLabel}</span>
                              {u.is_verified && (
                                <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>✓ verificado</span>
                              )}
                            </div>
                          </td>
                          {/* Analyses + last activity */}
                          <td className={`px-4 md:px-6 py-3 text-center hidden md:table-cell`}>
                            <p className={`text-sm font-semibold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{u.analyses_count ?? 0}</p>
                            {lastAct && <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{lastAct}</p>}
                          </td>
                          {/* Actions */}
                          <td className="px-4 md:px-6 py-3">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => toggleActive(u.id)}
                                title={u.is_active ? 'Desativar' : 'Ativar'}
                                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                                  u.is_active ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                }`}
                              >
                                {u.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              </button>
                              {!u.is_verified && (
                                <button
                                  onClick={() => verifyUser(u.id)}
                                  title="Verificar e-mail"
                                  className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {u.is_partner ? (
                                <button onClick={() => demotePartner(u.id)} title="Remove partner" className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition">
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button onClick={() => promotePartner(u.id)} title="Make partner" className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition">
                                  <UserCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => openEdit(u)} title="Edit" className={`p-1.5 rounded-lg transition ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {!u.is_superadmin && (
                                <button onClick={() => setDeleteConfirm({ open: true, id: u.id, name: u.full_name })} title="Delete" className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className={`text-sm ${cls.sub}`}>
                Page {page} of {totalPages}
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

      {/* ── Edit user modal ── */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`font-semibold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Edit user profile</h2>
              <button
                onClick={() => setEditModal({ open: false, id: null, full_name: '', company_name: '' })}
                className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Full name</label>
                <input
                  type="text"
                  value={editModal.full_name}
                  onChange={(e) => setEditModal(m => ({ ...m, full_name: e.target.value }))}
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${cls.input}`}
                  autoFocus
                />
              </div>
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Consultoria / Escritório <span className={`normal-case font-normal ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>(opcional)</span></label>
                <input
                  type="text"
                  value={editModal.company_name}
                  onChange={(e) => setEditModal(m => ({ ...m, company_name: e.target.value }))}
                  placeholder="Deixe em branco para limpar"
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${cls.input}`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditModal({ open: false, id: null, full_name: '', company_name: '' })}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete user"
        message={`Are you sure you want to delete "${deleteConfirm.name}"? This action is irreversible and will delete all user analyses and payments.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDeleteUser}
        onCancel={() => setDeleteConfirm({ open: false, id: null, name: '' })}
      />
    </>
  );
}
