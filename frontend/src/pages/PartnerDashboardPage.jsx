import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, DollarSign, TrendingUp, Copy, Check,
  UserPlus, BarChart3, Clock, CheckCircle, ExternalLink,
  Briefcase, Percent, Download, Search, Trash2, Edit3, X, Filter,
  Key, Calendar, CreditCard, AlertCircle,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

const STATUS_MAP = {
  pre_filled: { label: 'Pré-preenchido', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  completed: { label: 'Concluído', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  report_sent: { label: 'Relatório enviado', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
};

const COMMISSION_STATUS = {
  pending: { label: 'Pendente', color: 'text-yellow-500' },
  approved: { label: 'Aprovada', color: 'text-blue-500' },
  paid: { label: 'Paga', color: 'text-emerald-500' },
};

export default function PartnerDashboardPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientForm, setClientForm] = useState({ client_name: '', client_email: '', client_company: '', client_phone: '' });
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState('clients');
  const [clientSearch, setClientSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingClient, setEditingClient] = useState(null);
  const [pixForm, setPixForm] = useState({ pix_key_type: '', pix_key: '', payout_day: 15 });
  const [savingPix, setSavingPix] = useState(false);
  const [commissionFilter, setCommissionFilter] = useState('all');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = () => {
    api.get('/partners/dashboard')
      .then(({ data }) => {
        setDashboard(data);
        // Load PIX info from partner data
        if (data.partner) {
          setPixForm({
            pix_key_type: data.partner.pix_key_type || '',
            pix_key: data.partner.pix_key || '',
            payout_day: data.partner.payout_day || 15,
          });
        }
      })
      .catch(() => {
        toast.error('Você não é um parceiro registrado.');
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  };

  const handleCopyLink = () => {
    if (dashboard?.partner?.referral_link) {
      navigator.clipboard.writeText(dashboard.partner.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSavePix = async (e) => {
    e.preventDefault();
    if (!pixForm.pix_key_type || !pixForm.pix_key) {
      toast.error('Preencha o tipo e a chave PIX.');
      return;
    }
    setSavingPix(true);
    try {
      await api.put('/partners/pix-key', pixForm);
      toast.success('Chave PIX salva com sucesso!');
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar chave PIX.');
    } finally {
      setSavingPix(false);
    }
  };

  const PIX_KEY_TYPES = [
    { value: 'cpf', label: 'CPF' },
    { value: 'cnpj', label: 'CNPJ' },
    { value: 'email', label: 'E-mail' },
    { value: 'phone', label: 'Celular' },
    { value: 'random', label: 'Chave aleatória' },
  ];

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
      setClientForm({ client_name: '', client_email: '', client_company: '', client_phone: '' });
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao adicionar cliente.');
    } finally {
      setAdding(false);
    }
  };

  const formatBRL = (v) => {
    if (!v) return 'R$ 0,00';
    return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  // ─── Filtered clients ─────────────────────────────
  const filteredClients = useMemo(() => {
    if (!dashboard) return [];
    let result = [...dashboard.clients];
    if (clientSearch) {
      const q = clientSearch.toLowerCase();
      result = result.filter(c =>
        c.client_name?.toLowerCase().includes(q) ||
        c.client_email?.toLowerCase().includes(q) ||
        c.client_company?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') result = result.filter(c => c.data_status === statusFilter);
    return result;
  }, [dashboard, clientSearch, statusFilter]);

  // ─── Chart data ─────────────────────────────────────
  const earningsTimeline = useMemo(() => {
    if (!dashboard?.commissions?.length) return [];
    const byMonth = {};
    dashboard.commissions.forEach(c => {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { month: key, total: 0, count: 0 };
      byMonth[key].total += c.partner_amount || 0;
      byMonth[key].count += 1;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m,
      label: new Date(m.month + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    }));
  }, [dashboard]);

  const statusDistribution = useMemo(() => {
    if (!dashboard?.clients?.length) return [];
    const counts = {};
    dashboard.clients.forEach(c => {
      const s = c.data_status || 'pre_filled';
      counts[s] = (counts[s] || 0) + 1;
    });
    const COLORS = { pre_filled: '#eab308', completed: '#3b82f6', report_sent: '#10b981' };
    const LABELS = { pre_filled: 'Pré-preenchido', completed: 'Concluído', report_sent: 'Relatório enviado' };
    return Object.entries(counts).map(([key, value]) => ({
      name: LABELS[key] || key, value, color: COLORS[key] || '#94a3b8',
    }));
  }, [dashboard]);

  // ─── CSV Export ──────────────────────────────────────
  const handleExportCSV = () => {
    if (!dashboard) return;
    const headers = ['Nome', 'Email', 'Empresa', 'Status', 'Plano', 'Data'];
    const rows = (filteredClients || []).map(c => [
      c.client_name,
      c.client_email,
      c.client_company || '',
      STATUS_MAP[c.data_status]?.label || c.data_status,
      c.plan || '',
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

  // ─── Delete Client ──────────────────────────────────
  const handleDeleteClient = async (clientId) => {
    if (!confirm('Tem certeza que deseja remover este cliente?')) return;
    try {
      await api.delete(`/partners/clients/${clientId}`);
      toast.success('Cliente removido.');
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao remover cliente.');
    }
  };

  // ─── Edit Client ────────────────────────────────────
  const handleEditClient = async (e) => {
    e.preventDefault();
    if (!editingClient) return;
    try {
      await api.put(`/partners/clients/${editingClient.id}`, {
        client_name: editingClient.client_name,
        client_email: editingClient.client_email,
        client_company: editingClient.client_company,
        client_phone: editingClient.client_phone,
      });
      toast.success('Cliente atualizado!');
      setEditingClient(null);
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao atualizar.');
    }
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Carregando...</div>;
  if (!dashboard) return null;

  const { partner, clients, commissions, summary } = dashboard;

  return (
    <>
      {/* Header */}
      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className={`transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-navy-900'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-500" />
              <h1 className={`font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>Painel do Parceiro</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Referral Link Banner */}
        <div className={`rounded-2xl p-6 mb-8 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-navy-900'}`}>Seu link de indicação</h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Compartilhe com seus clientes. Cada venda gera <span className="text-emerald-500 font-semibold">{(partner.commission_rate * 100).toFixed(0)}% de comissão</span>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className={`px-4 py-2.5 rounded-xl text-sm font-mono ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-emerald-600'}`}>
                {partner.referral_link}
              </code>
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  copied ? 'bg-emerald-500/20 text-emerald-500' : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, label: 'Clientes', value: summary.total_clients, color: 'text-blue-500' },
            { icon: BarChart3, label: 'Vendas', value: summary.total_sales, color: 'text-emerald-500' },
            { icon: DollarSign, label: 'Ganhos totais', value: formatBRL(summary.total_earnings), color: 'text-green-500' },
            { icon: Percent, label: 'Conversão', value: `${summary.conversion_rate}%`, color: 'text-teal-500' },
          ].map((kpi, i) => (
            <div key={i} className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <kpi.icon className={`w-5 h-5 mb-3 ${kpi.color}`} />
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>{kpi.value}</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Pending Commissions Alert */}
        {summary.pending_commissions > 0 && (
          <div className={`rounded-2xl p-5 mb-8 border-2 ${isDark ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-yellow-300 bg-yellow-50'}`}>
            <div className="flex items-center gap-3">
              <Clock className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
              <p className={`text-sm font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Você tem <strong>{formatBRL(summary.pending_commissions)}</strong> em comissões pendentes de pagamento.
              </p>
            </div>
          </div>
        )}

        {/* Performance Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Earnings Timeline */}
          <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Ganhos por mês</h3>
            {earningsTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={earningsTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => formatBRL(v)} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 12 }} />
                  <Area type="monotone" dataKey="total" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className={`flex items-center justify-center h-[200px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                <p className="text-sm">Dados insuficientes para gráfico</p>
              </div>
            )}
          </div>
          {/* Status Distribution */}
          <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Distribuição de status</h3>
            {statusDistribution.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                      {statusDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusDistribution.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{s.name}: {s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`flex items-center justify-center h-[200px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                <p className="text-sm">Nenhum cliente ainda</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs + Actions */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[
            { key: 'clients', label: 'Clientes', icon: Users },
            { key: 'commissions', label: 'Comissões', icon: DollarSign },
            { key: 'financeiro', label: 'Financeiro', icon: CreditCard },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                  : isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}

          <div className="flex items-center gap-2 ml-auto">
            {activeTab === 'clients' && (
              <button
                onClick={handleExportCSV}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
            )}
            <button
              onClick={() => setShowAddClient(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 transition"
            >
              <UserPlus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </div>

        {/* Search & Filters (clients tab only) */}
        {activeTab === 'clients' && (
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
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div className={`border rounded-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            {filteredClients.length === 0 ? (
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
                      <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Plano</th>
                      <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Data</th>
                      <th className={`text-right px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => {
                      const status = STATUS_MAP[client.data_status] || { label: client.data_status, color: 'text-slate-400', bg: 'bg-slate-500/10' };
                      return (
                        <tr key={client.id} className={`border-t ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                          <td className={`px-6 py-4 font-medium ${isDark ? 'text-white' : 'text-navy-900'}`}>{client.client_name}</td>
                          <td className={`px-6 py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{client.client_company || '—'}</td>
                          <td className={`px-6 py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{client.client_email}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color} ${status.bg}`}>
                              {client.data_status === 'report_sent' && <CheckCircle className="w-3 h-3" />}
                              {status.label}
                            </span>
                          </td>
                          <td className={`px-6 py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{client.plan ? client.plan.charAt(0).toUpperCase() + client.plan.slice(1) : '—'}</td>
                          <td className={`px-6 py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {new Date(client.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
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
                                onClick={() => handleDeleteClient(client.id)}
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

        {/* Commissions Tab */}
        {activeTab === 'commissions' && (
          <>
            {/* Commission Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Pendentes', value: formatBRL(commissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.partner_amount || 0), 0)), color: 'text-yellow-500', bg: isDark ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200', count: commissions.filter(c => c.status === 'pending').length },
                { label: 'Aprovadas', value: formatBRL(commissions.filter(c => c.status === 'approved').reduce((s, c) => s + (c.partner_amount || 0), 0)), color: 'text-blue-500', bg: isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200', count: commissions.filter(c => c.status === 'approved').length },
                { label: 'Pagas', value: formatBRL(commissions.filter(c => c.status === 'paid').reduce((s, c) => s + (c.partner_amount || 0), 0)), color: 'text-emerald-500', bg: isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200', count: commissions.filter(c => c.status === 'paid').length },
              ].map((item, i) => (
                <div key={i} className={`border rounded-xl p-4 ${item.bg}`}>
                  <p className={`text-xs font-medium uppercase mb-1 ${item.color}`}>{item.label} ({item.count})</p>
                  <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Commission filter */}
            <div className="flex items-center gap-2 mb-4">
              {['all', 'pending', 'approved', 'paid'].map(f => (
                <button
                  key={f}
                  onClick={() => setCommissionFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    commissionFilter === f
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {{ all: 'Todas', pending: 'Pendentes', approved: 'Aprovadas', paid: 'Pagas' }[f]}
                </button>
              ))}
            </div>

            <div className={`border rounded-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              {commissions.length === 0 ? (
                <div className="p-12 text-center">
                  <DollarSign className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                  <p className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma comissão ainda.</p>
                  <p className={`text-sm mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Quando seus clientes pagarem, suas comissões aparecerão aqui.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={isDark ? 'bg-slate-800/50' : 'bg-slate-50'}>
                        <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Valor total</th>
                        <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sua comissão (60%)</th>
                        <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</th>
                        <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Data</th>
                        <th className={`text-left px-6 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pago em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissions
                        .filter(c => commissionFilter === 'all' || c.status === commissionFilter)
                        .map((c) => {
                        const status = COMMISSION_STATUS[c.status] || { label: c.status, color: 'text-slate-400' };
                        return (
                          <tr key={c.id} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                            <td className={`px-6 py-4 font-medium ${isDark ? 'text-white' : 'text-navy-900'}`}>{formatBRL(c.total_amount)}</td>
                            <td className="px-6 py-4 text-emerald-500 font-semibold">{formatBRL(c.partner_amount)}</td>
                            <td className={`px-6 py-4 font-medium ${status.color}`}>{status.label}</td>
                            <td className={`px-6 py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {new Date(c.created_at).toLocaleDateString('pt-BR')}
                            </td>
                            <td className={`px-6 py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {c.paid_at ? new Date(c.paid_at).toLocaleDateString('pt-BR') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Financeiro Tab — PIX Key + Payout Day */}
        {activeTab === 'financeiro' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* PIX Key Form */}
            <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-5">
                <Key className="w-5 h-5 text-emerald-500" />
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>Chave PIX para recebimento</h3>
              </div>
              <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Cadastre sua chave PIX para receber as comissões. O pagamento é feito todo dia <strong className="text-emerald-500">{pixForm.payout_day || 15}</strong> do mês.
              </p>
              <form onSubmit={handleSavePix} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Tipo da chave *</label>
                  <select
                    value={pixForm.pix_key_type}
                    onChange={e => setPixForm({ ...pixForm, pix_key_type: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  >
                    <option value="">Selecione...</option>
                    {PIX_KEY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Chave PIX *</label>
                  <input
                    value={pixForm.pix_key}
                    onChange={e => setPixForm({ ...pixForm, pix_key: e.target.value })}
                    placeholder={pixForm.pix_key_type === 'cpf' ? '000.000.000-00' : pixForm.pix_key_type === 'cnpj' ? '00.000.000/0001-00' : pixForm.pix_key_type === 'email' ? 'seu@email.com' : pixForm.pix_key_type === 'phone' ? '+5511999999999' : 'Chave aleatória'}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Dia do pagamento (1-28)</label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={pixForm.payout_day}
                    onChange={e => setPixForm({ ...pixForm, payout_day: parseInt(e.target.value) || 15 })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingPix}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50"
                >
                  {savingPix ? 'Salvando...' : 'Salvar chave PIX'}
                </button>
              </form>
            </div>

            {/* Payout Info */}
            <div className="space-y-6">
              <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>Resumo de pagamentos</h3>
                </div>
                <div className="space-y-3">
                  <div className={`flex items-center justify-between py-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Comissões pendentes</span>
                    <span className="text-sm font-semibold text-yellow-500">
                      {formatBRL(commissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.partner_amount || 0), 0))}
                    </span>
                  </div>
                  <div className={`flex items-center justify-between py-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aprovadas (aguardando payout)</span>
                    <span className="text-sm font-semibold text-blue-500">
                      {formatBRL(commissions.filter(c => c.status === 'approved').reduce((s, c) => s + (c.partner_amount || 0), 0))}
                    </span>
                  </div>
                  <div className={`flex items-center justify-between py-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total já recebido</span>
                    <span className="text-sm font-semibold text-emerald-500">
                      {formatBRL(commissions.filter(c => c.status === 'paid').reduce((s, c) => s + (c.partner_amount || 0), 0))}
                    </span>
                  </div>
                  <div className={`flex items-center justify-between py-3`}>
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-navy-900'}`}>Total geral</span>
                    <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>
                      {formatBRL(summary.total_earnings)}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>Como funciona</h4>
                </div>
                <ul className={`text-xs space-y-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <li className="flex items-start gap-2"><span className="text-yellow-500 font-bold mt-0.5">1.</span> Quando seu cliente paga, a comissão fica <strong className="text-yellow-500">pendente</strong>.</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">2.</span> O admin revisa e <strong className="text-blue-500">aprova</strong> a comissão.</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 font-bold mt-0.5">3.</span> No dia <strong className="text-emerald-500">{pixForm.payout_day || 15}</strong> do mês, o valor é transferido via PIX e marcado como <strong className="text-emerald-500">pago</strong>.</li>
                </ul>
              </div>

              {!pixForm.pix_key && (
                <div className={`border-2 border-dashed rounded-2xl p-5 text-center ${isDark ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-yellow-300 bg-yellow-50'}`}>
                  <Key className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                  <p className={`text-sm font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                    Cadastre sua chave PIX ao lado para receber comissões.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

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
                    onChange={(e) => setClientForm({ ...clientForm, client_name: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>E-mail *</label>
                  <input
                    type="email"
                    value={clientForm.client_email}
                    onChange={(e) => setClientForm({ ...clientForm, client_email: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Empresa (opcional)</label>
                  <input
                    value={clientForm.client_company}
                    onChange={(e) => setClientForm({ ...clientForm, client_company: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Telefone (opcional)</label>
                  <input
                    value={clientForm.client_phone}
                    onChange={(e) => setClientForm({ ...clientForm, client_phone: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="(11) 99999-9999"
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
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingClient(null)} className={`flex-1 py-3 rounded-xl text-sm font-medium border transition ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Cancelar</button>
                  <button type="submit" className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
