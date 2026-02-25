import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Search, Filter, Download, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

export default function AdminAnalysesPage() {
  const { isDark } = useTheme();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const limit = 20;

  const fetchAnalyses = async () => {
    setLoading(true);
    try {
      const params = { skip: (page - 1) * limit, limit };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      const { data } = await api.get('/admin/analyses', { params });
      setAnalyses(data.analyses || data);
      setTotal(data.total ?? (data.analyses || data).length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalyses(); }, [page, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAnalyses();
  };

  const formatBRL = (v) => {
    if (!v) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  const [resendLoading, setResendLoading] = useState(null);

  const statusColor = {
    draft: isDark ? 'bg-slate-500/10 text-slate-400' : 'bg-slate-100 text-slate-500',
    processing: 'bg-yellow-500/10 text-yellow-500',
    completed: 'bg-green-500/10 text-green-500',
    failed: 'bg-red-500/10 text-red-500',
  };

  const statusColor = {

  const handleResend = async (analysisId) => {
    setResendLoading(analysisId);
    try {
      const { data } = await api.post(`/admin/analyses/${analysisId}/resend-report`);
      toast.success(data.message || 'Relatório reenviado!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao reenviar relatório.');
    } finally {
      setResendLoading(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const cls = {
    card: isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
    title: isDark ? 'text-white' : 'text-slate-900',
    sub: isDark ? 'text-slate-500' : 'text-slate-400',
    th: isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-200',
    input: isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400',
    pagination: isDark ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-300 text-slate-500 hover:text-slate-900',
  };

  return (
    <>
      <main className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className={`text-xl md:text-2xl font-bold ${cls.title}`}>Análises</h1>
              <p className={`mt-1 text-sm ${cls.sub}`}>{total} análises na plataforma</p>
            </div>
            <a
              href={`${import.meta.env.VITE_API_URL || '/api/v1'}/admin/export/analyses`}
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
                  placeholder="Buscar por empresa ou usuário..."
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
                <option value="all">Todos status</option>
                <option value="draft">Rascunho</option>
                <option value="processing">Processando</option>
                <option value="completed">Concluída</option>
                <option value="failed">Falha</option>
              </select>
            </div>
          </div>

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
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Empresa</th>
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell ${cls.th}`}>Usuário</th>
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell ${cls.th}`}>Setor</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Status</th>
                      <th className={`text-right px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden md:table-cell ${cls.th}`}>Valuation</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden md:table-cell ${cls.th}`}>Plano</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Ação</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                    {analyses.map((a) => (
                      <tr key={a.id} className={`transition ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 md:px-6 py-4">
                          <p className={`text-sm font-medium ${cls.title}`}>{a.company_name}</p>
                          <p className={`text-xs sm:hidden ${cls.sub}`}>{a.user_name || a.user_email || ''}</p>
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-sm hidden sm:table-cell ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {a.user_name || a.user_email || '—'}
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-sm hidden lg:table-cell ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{a.sector}</td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[a.status] || 'bg-slate-500/10 text-slate-400'}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-right text-sm font-medium hidden md:table-cell ${cls.title}`}>
                          {a.results?.equity_value ? formatBRL(a.results.equity_value) : '—'}
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-center hidden md:table-cell`}>
                          <span className={`text-xs uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{a.plan || '—'}</span>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <Link
                              to={`/analise/${a.id}`}
                              className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver
                            </Link>
                            {a.status === 'completed' && (
                              <button
                                onClick={() => handleResend(a.id)}
                                disabled={resendLoading === a.id}
                                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 transition disabled:opacity-50"
                                title="Reenviar relatório por e-mail"
                              >
                                <Send className="w-3.5 h-3.5" />
                                {resendLoading === a.id ? '…' : 'Reenviar'}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className={`text-sm ${cls.sub}`}>Página {page} de {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className={`p-2 border rounded-lg disabled:opacity-50 transition ${cls.pagination}`}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className={`p-2 border rounded-lg disabled:opacity-50 transition ${cls.pagination}`}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
