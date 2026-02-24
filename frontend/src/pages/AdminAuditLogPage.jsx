import { useEffect, useState, useCallback } from 'react';
import { ClipboardList, RefreshCw, Search, CheckCircle, XCircle } from 'lucide-react';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

const ACTION_LABELS = {
  'user.login': 'Login',
  'analysis.delete': 'Análise excluída',
  'payment.confirmed': 'Pagamento confirmado',
};

const ACTION_COLORS = {
  'user.login': { dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
  'analysis.delete': { dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
  'payment.confirmed': { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
};

function fmt(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ts; }
}

export default function AdminAuditLogPage() {
  const { isDark } = useTheme();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/audit-log?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      .then(r => setEntries(r.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (e.action || '').toLowerCase().includes(q) ||
      (e.user_email || '').toLowerCase().includes(q) ||
      (e.resource_id || '').toLowerCase().includes(q) ||
      (e.detail || '').toLowerCase().includes(q) ||
      (e.ip || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <ClipboardList className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Audit Log</h1>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Registro de ações críticas do sistema</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrar por ação, e-mail, IP..."
          className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-400'}`}
        />
      </div>

      {/* Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
            <p className={`mt-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Carregando...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum evento encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50'}`}>
                  {['Data/Hora', 'Ação', 'Usuário', 'IP', 'Recurso', 'Detalhe', 'Ok'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((e, i) => {
                  const colors = ACTION_COLORS[e.action] || { dot: 'bg-slate-400', badge: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
                  return (
                    <tr key={i} className={`transition hover:${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                      <td className={`px-4 py-3 text-xs whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmt(e.ts)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${colors.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          {ACTION_LABELS[e.action] || e.action}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-xs max-w-[160px] truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{e.user_email || '—'}</td>
                      <td className={`px-4 py-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{e.ip || '—'}</td>
                      <td className={`px-4 py-3 text-xs font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title={e.resource_id}>{e.resource_id ? e.resource_id.slice(0, 8) + '…' : '—'}</td>
                      <td className={`px-4 py-3 text-xs max-w-[200px] truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`} title={e.detail}>{e.detail || '—'}</td>
                      <td className="px-4 py-3">
                        {e.ok ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
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
      <div className="flex items-center justify-between mt-4">
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Exibindo {filtered.length} evento{filtered.length !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Anterior
          </button>
          <span className={`text-xs px-3 py-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Página {page + 1}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={entries.length < PAGE_SIZE}
            className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
