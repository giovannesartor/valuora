import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BarChart3, CreditCard, FileText, Shield,
  ChevronLeft, ChevronRight, ArrowUpRight, LogOut, Eye,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../lib/api';

export default function AdminAnalysesPage() {
  const { logout } = useAuthStore();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchAnalyses = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/analyses', {
        params: { skip: (page - 1) * limit, limit },
      });
      setAnalyses(data.analyses || data);
      setTotal(data.total || data.length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalyses(); }, [page]);

  const formatBRL = (v) => {
    if (!v) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  const statusColor = {
    draft: 'bg-slate-500/10 text-slate-400',
    processing: 'bg-yellow-500/10 text-yellow-400',
    completed: 'bg-green-500/10 text-green-400',
    failed: 'bg-red-500/10 text-red-400',
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
              { to: '/admin/usuarios', icon: Users, label: 'Usuários' },
              { to: '/admin/analises', icon: FileText, label: 'Análises', active: true },
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
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Análises</h1>
            <p className="text-slate-500 mt-1">{total} análises na plataforma</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="text-center py-20 text-slate-500">Carregando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresa</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuário</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Setor</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valuation</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Plano</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {analyses.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/50 transition">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-white">{a.company_name}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {a.user_name || a.user_email || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">{a.sector}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[a.status] || 'bg-slate-500/10 text-slate-400'}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-white font-medium">
                          {a.results?.equity_value ? formatBRL(a.results.equity_value) : '—'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-xs text-slate-400 uppercase">{a.plan || '—'}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Link
                            to={`/analise/${a.id}`}
                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver
                          </Link>
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
              <p className="text-sm text-slate-500">Página {page} de {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 transition">
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
