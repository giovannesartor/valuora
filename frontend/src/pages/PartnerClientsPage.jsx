import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserPlus, Download, Search, Trash2, Edit3,
  CheckCircle, ExternalLink, ChevronLeft, ChevronRight, FileText,
  LayoutGrid, List,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import ConfirmDialog from '../components/ConfirmDialog';
import { useTheme } from '../context/ThemeContext';

const STATUS_MAP = {
  pre_filled:  { label: 'Pré-preenchido',    color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  completed:   { label: 'Concluído',          color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  report_sent: { label: 'Relatório enviado',  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
};

const CLIENT_PAGE_SIZE = 15;

export default function PartnerClientsPage() {
  const { isDark } = useTheme();
  const [clients, setClients]               = useState([]);
  const [total, setTotal]                   = useState(0);
  const [clientTotalPages, setClientTotalPages] = useState(1);
  const [loading, setLoading]               = useState(true);
  const [showAddClient, setShowAddClient]   = useState(false);
  const [clientForm, setClientForm]         = useState({ client_name: '', client_email: '', client_company: '', client_phone: '', notes: '' });
  const [adding, setAdding]                 = useState(false);
  const [clientSearch, setClientSearch]     = useState('');
  const [statusFilter, setStatusFilter]     = useState('all');
  const [editingClient, setEditingClient]   = useState(null);
  const [clientPage, setClientPage]         = useState(1);
  const [deleteConfirm, setDeleteConfirm]   = useState({ open: false, clientId: null, clientName: '' });
  const [deleting, setDeleting]             = useState(false);
  const [viewMode, setViewMode]             = useState('table'); // 'table' | 'kanban'

  // P11: Server-side load with pagination + search
  const loadClients = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: clientPage, page_size: viewMode === 'kanban' ? 200 : CLIENT_PAGE_SIZE });
    if (clientSearch) params.set('search', clientSearch);
    api.get(`/partners/clients?${params}`)
      .then(({ data }) => {
        setClients(data.items || []);
        setTotal(data.total || 0);
        setClientTotalPages(data.total_pages || 1);
      })
      .catch(() => toast.error('Erro ao carregar clientes.'))
      .finally(() => setLoading(false));
  }, [clientPage, clientSearch, viewMode]);

  useEffect(() => { loadClients(); }, [loadClients]);

  // Debounce search reset page
  useEffect(() => { setClientPage(1); }, [clientSearch, statusFilter]);

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!clientForm.client_name || !clientForm.client_email) {
      toast.error('Nome e e-mail são obrigatórios.');
      return;
    }
    setAdding(true);
    try {
      await api.post('/partners/clients', clientForm);
      toast.success('Cliente adicionado!');
      setShowAddClient(false);
      setClientForm({ client_name: '', client_email: '', client_company: '', client_phone: '', notes: '' });
      loadClients();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao adicionar cliente.');
    } finally { setAdding(false); }
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    if (!editingClient) return;
    try {
      await api.put(`/partners/clients/${editingClient.id}`, {
        client_name:    editingClient.client_name,
        client_email:   editingClient.client_email,
        client_company: editingClient.client_company,
        client_phone:   editingClient.client_phone,
        notes:          editingClient.notes,
      });
      toast.success('Cliente atualizado!');
      setEditingClient(null);
      loadClients();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao atualizar.');
    }
  };

  const handleDeleteClient = (clientId, clientName) => {
    setDeleteConfirm({ open: true, clientId, clientName: clientName || 'este cliente' });
  };

  const confirmDeleteClient = async () => {
    setDeleting(true);
    try {
      await api.delete(`/partners/clients/${deleteConfirm.clientId}`);
      toast.success('Cliente removido.');
      setDeleteConfirm({ open: false, clientId: null, clientName: '' });
      loadClients();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao remover cliente.');
    } finally { setDeleting(false); }
  };

  const handleExportCSV = () => {
    const headers = ['Nome', 'Email', 'Empresa', 'Status', 'Plano', 'Notas', 'Data'];
    const rows = clients.map(c => [
      c.client_name,
      c.client_email,
      c.client_company || '',
      STATUS_MAP[c.data_status]?.label || c.data_status,
      c.plan || '',
      c.notes || '',
      new Date(c.created_at).toLocaleDateString('pt-BR'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes-parceiro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  if (loading) return (
    <div className="space-y-4 p-6">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`h-14 rounded-xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <Users className="w-5 h-5 text-emerald-500" />
            Clientes
          </h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Gerencie os clientes que você indicou
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className={`flex rounded-lg overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <button
              onClick={() => setViewMode('table')}
              title="Tabela"
              className={`p-2 transition ${viewMode === 'table' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              title="Pipeline Kanban"
              className={`p-2 transition ${viewMode === 'kanban' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleExportCSV}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => setShowAddClient(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 transition"
          >
            <UserPlus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            value={clientSearch}
            onChange={e => setClientSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className={`w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className={`px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
        >
          <option value="all">Todos os status</option>
          <option value="pre_filled">Pré-preenchido</option>
          <option value="completed">Concluído</option>
          <option value="report_sent">Relatório enviado</option>
        </select>
        <span className={`text-xs ml-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{total} cliente(s)</span>
      </div>

      {/* Kanban Pipeline View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { key: 'pre_filled',  label: 'Cadastrado',      emoji: '1️⃣', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: isDark ? 'border-yellow-500/20' : 'border-yellow-200' },
            { key: 'completed',   label: 'Análise Criada',  emoji: '2️⃣', color: 'text-blue-500',   bg: 'bg-blue-500/10',   border: isDark ? 'border-blue-500/20'   : 'border-blue-200'   },
            { key: 'report_sent', label: 'Pagou',            emoji: '3️⃣', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: isDark ? 'border-emerald-500/20' : 'border-emerald-200' },
          ].map(col => {
            const colClients = clients.filter(c => c.data_status === col.key);
            return (
              <div key={col.key} className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center justify-between mb-3 pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{col.emoji}</span>
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{col.label}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.color} ${col.bg}`}>{colClients.length}</span>
                </div>
                <div className="space-y-2">
                  {colClients.length === 0 ? (
                    <p className={`text-xs text-center py-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Nenhum cliente</p>
                  ) : colClients.map(c => (
                    <div key={c.id} className={`rounded-xl p-3 border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.client_name}</p>
                      {c.client_company && <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{c.client_company}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                        {c.analysis_id ? (
                          <Link to={`/analise/${c.analysis_id}`} className={`text-[10px] font-medium ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'}`}>Ver análise →</Link>
                        ) : (
                          <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>sem análise</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      {viewMode === 'table' && (
        <div className={`border rounded-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
            <p className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {clientSearch || statusFilter !== 'all' ? 'Nenhum resultado encontrado.' : 'Nenhum cliente adicionado ainda.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isDark ? 'bg-slate-800/50' : 'bg-slate-50'}>
                  <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cliente</th>
                  <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Empresa</th>
                  <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>E-mail</th>
                  <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</th>
                  <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Análises</th>
                  <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Plano</th>
                  <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Data</th>
                  <th className={`text-right px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const status = STATUS_MAP[client.data_status] || { label: client.data_status, color: 'text-slate-400', bg: 'bg-slate-500/10' };
                  return (
                    <tr key={client.id} className={`border-t ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                      <td className={`px-6 py-4`}>
                        <p className={`font-medium ${isDark ? 'text-white' : 'text-navy-900'}`}>{client.client_name}</p>
                        {client.notes && <p className={`text-[10px] truncate max-w-[120px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{client.notes}</p>}
                      </td>
                      <td className={`px-6 py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{client.client_company || '—'}</td>
                      <td className={`px-6 py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{client.client_email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color} ${status.bg}`}>
                          {client.data_status === 'report_sent' && <CheckCircle className="w-3 h-3" />}
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                          client.analysis_id
                            ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                            : (isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')
                        }`}>
                          {client.analysis_id ? '1' : '0'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {client.plan ? client.plan.charAt(0).toUpperCase() + client.plan.slice(1) : '—'}
                      </td>
                      <td className={`px-6 py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {new Date(client.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* P2: Client detail link */}
                          <Link
                            to={`/parceiro/clientes/${client.id}`}
                            className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                            title="Ver detalhes"
                          >
                            <FileText className="w-4 h-4" />
                          </Link>
                          {client.analysis_id && (
                            <Link
                              to={`/analise/${client.analysis_id}`}
                              className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-600'}`}
                              title="Ver análise"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          )}
                          <button
                            onClick={() => setEditingClient({ ...client })}
                            className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id, client.client_name)}
                            className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-500'}`}
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
      )}

      {/* Pagination */}
      {clientTotalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Mostrando {((clientPage - 1) * CLIENT_PAGE_SIZE) + 1}–{Math.min(clientPage * CLIENT_PAGE_SIZE, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setClientPage(p => Math.max(1, p - 1))}
              disabled={clientPage === 1}
              className={`p-2 rounded-lg transition disabled:opacity-30 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`text-sm font-medium px-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{clientPage}/{clientTotalPages}</span>
            <button
              onClick={() => setClientPage(p => Math.min(clientTotalPages, p + 1))}
              disabled={clientPage === clientTotalPages}
              className={`p-2 rounded-lg transition disabled:opacity-30 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddClient(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="p-6">
              <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Adicionar cliente</h3>
              <form onSubmit={handleAddClient} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nome do cliente *</label>
                  <input
                    value={clientForm.client_name}
                    onChange={e => setClientForm({ ...clientForm, client_name: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>E-mail *</label>
                  <input
                    type="email"
                    value={clientForm.client_email}
                    onChange={e => setClientForm({ ...clientForm, client_email: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Empresa (opcional)</label>
                  <input
                    value={clientForm.client_company}
                    onChange={e => setClientForm({ ...clientForm, client_company: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Telefone (opcional)</label>
                  <input
                    value={clientForm.client_phone}
                    onChange={e => setClientForm({ ...clientForm, client_phone: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Notas internas (opcional)</label>
                  <textarea
                    value={clientForm.notes}
                    onChange={e => setClientForm({ ...clientForm, notes: e.target.value })}
                    rows={3}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition resize-none ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    placeholder="Observações sobre este cliente..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddClient(false)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium border transition ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={adding}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50"
                  >
                    {adding ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingClient(null)} />
          <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="p-6">
              <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Editar cliente</h3>
              <form onSubmit={handleEditClient} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nome *</label>
                  <input
                    value={editingClient.client_name}
                    onChange={e => setEditingClient({ ...editingClient, client_name: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>E-mail *</label>
                  <input
                    type="email"
                    value={editingClient.client_email}
                    onChange={e => setEditingClient({ ...editingClient, client_email: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Empresa</label>
                  <input
                    value={editingClient.client_company || ''}
                    onChange={e => setEditingClient({ ...editingClient, client_company: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Telefone</label>
                  <input
                    value={editingClient.client_phone || ''}
                    onChange={e => setEditingClient({ ...editingClient, client_phone: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Notas internas</label>
                  <textarea
                    value={editingClient.notes || ''}
                    onChange={e => setEditingClient({ ...editingClient, notes: e.target.value })}
                    rows={3}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition resize-none ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    placeholder="Observações sobre este cliente..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingClient(null)} className={`flex-1 py-3 rounded-xl text-sm font-medium border transition ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Cancelar</button>
                  <button type="submit" className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Remover cliente"
        message={`Tem certeza que deseja remover "${deleteConfirm.clientName}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDeleteClient}
        onCancel={() => setDeleteConfirm({ open: false, clientId: null, clientName: '' })}
      />
    </div>
  );
}
