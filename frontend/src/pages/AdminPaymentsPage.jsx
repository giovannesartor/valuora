import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Search, Filter } from 'lucide-react';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

export default function AdminPaymentsPage() {
  const { isDark } = useTheme();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const limit = 20;

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/payments', {
        params: { skip: (page - 1) * limit, limit },
      });
      setPayments(data.payments || data);
      setTotal(data.total || data.length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchPayments();
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const statusStyle = {
    pending: 'bg-yellow-500/10 text-yellow-500',
    paid: 'bg-green-500/10 text-green-500',
    failed: 'bg-red-500/10 text-red-500',
    refunded: 'bg-purple-500/10 text-purple-500',
  };

  const statusLabel = {
    pending: 'Pendente',
    paid: 'Pago',
    failed: 'Falhou',
    refunded: 'Reembolsado',
  };

  const filteredPayments = payments.filter(p => {
    const matchSearch = !search || (p.user_name || p.user_email || '').toLowerCase().includes(search.toLowerCase()) || (p.company_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
          <div className="mb-8">
            <h1 className={`text-xl md:text-2xl font-bold ${cls.title}`}>Pagamentos</h1>
            <p className={`mt-1 text-sm ${cls.sub}`}>{total} pagamentos registrados</p>
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
                  placeholder="Buscar por usuário ou análise..."
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
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="failed">Falhou</option>
                <option value="refunded">Reembolsado</option>
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
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Usuário</th>
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell ${cls.th}`}>Análise</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell ${cls.th}`}>Plano</th>
                      <th className={`text-right px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Valor</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Status</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden md:table-cell ${cls.th}`}>Método</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden md:table-cell ${cls.th}`}>Data</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell ${cls.th}`}>Link</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                    {filteredPayments.map((p) => (
                      <tr key={p.id} className={`transition ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                        <td className={`px-4 md:px-6 py-4 text-sm ${cls.title}`}>
                          {p.user_name || p.user_email || '—'}
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-sm hidden sm:table-cell ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {p.company_name || p.analysis_id?.slice(0, 8) || '—'}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center hidden lg:table-cell">
                          <span className={`text-xs font-medium uppercase ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            {p.plan}
                          </span>
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-right text-sm font-medium ${cls.title}`}>
                          {formatBRL(p.amount)}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[p.status] || 'bg-slate-500/10 text-slate-400'}`}>
                            {statusLabel[p.status] || p.status}
                          </span>
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-center text-xs hidden md:table-cell ${cls.sub}`}>
                          {p.payment_method === 'admin_bypass' ? (
                            <span className="text-teal-500">Admin</span>
                          ) : p.payment_method || '—'}
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-center text-xs hidden md:table-cell ${cls.sub}`}>
                          {formatDate(p.created_at)}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center hidden sm:table-cell">
                          {p.asaas_invoice_url ? (
                            <a
                              href={p.asaas_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-500 hover:text-emerald-400"
                            >
                              <ExternalLink className="w-4 h-4 mx-auto" />
                            </a>
                          ) : (
                            <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>
                          )}
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
