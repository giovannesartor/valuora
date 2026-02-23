import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, DollarSign, TrendingUp, Copy, Check,
  UserPlus, BarChart3, Clock, CheckCircle, ExternalLink,
  Briefcase, Percent, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
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

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = () => {
    api.get('/partners/dashboard')
      .then(({ data }) => setDashboard(data))
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

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Carregando...</div>;
  if (!dashboard) return null;

  const { partner, clients, commissions, summary } = dashboard;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
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
          <ThemeToggle />
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

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'clients', label: 'Clientes', icon: Users },
            { key: 'commissions', label: 'Comissões', icon: DollarSign },
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

          <button
            onClick={() => setShowAddClient(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 transition"
          >
            <UserPlus className="w-4 h-4" />
            Adicionar cliente
          </button>
        </div>

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div className={`border rounded-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            {clients.length === 0 ? (
              <div className="p-12 text-center">
                <Users className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                <p className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum cliente adicionado ainda.</p>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Adicione clientes ou compartilhe seu link de indicação.</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => {
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
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => {
                      const status = COMMISSION_STATUS[c.status] || { label: c.status, color: 'text-slate-400' };
                      return (
                        <tr key={c.id} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                          <td className={`px-6 py-4 font-medium ${isDark ? 'text-white' : 'text-navy-900'}`}>{formatBRL(c.total_amount)}</td>
                          <td className="px-6 py-4 text-emerald-500 font-semibold">{formatBRL(c.partner_amount)}</td>
                          <td className={`px-6 py-4 font-medium ${status.color}`}>{status.label}</td>
                          <td className={`px-6 py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {new Date(c.created_at).toLocaleDateString('pt-BR')}
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
    </div>
  );
}
