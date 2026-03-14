import { useEffect, useState } from 'react';
import { AlertTriangle, Search, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import ConfirmDialog from '../components/ConfirmDialog';
import useAuthStore from '../store/authStore';

const STATUS_COLORS = {
  4: 'text-yellow-500 bg-yellow-500/10',
  5: 'text-red-500 bg-red-500/10',
};

const METHOD_COLORS = {
  GET:    'text-blue-400 bg-blue-400/10',
  POST:   'text-emerald-400 bg-emerald-400/10',
  PUT:    'text-yellow-400 bg-yellow-400/10',
  PATCH:  'text-yellow-400 bg-yellow-400/10',
  DELETE: 'text-red-400 bg-red-400/10',
};

export default function AdminErrorLogsPage() {
  const { isDark } = useTheme();
  const { isSuperAdmin } = useAuthStore();

  const [logs, setLogs]                 = useState([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 50;

  const [period, setPeriod]             = useState('7d');
  const [statusFilter, setStatusFilter] = useState('');
  const [routeFilter, setRouteFilter]   = useState('');
  const [expanded, setExpanded]         = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing]         = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const params = { period, page: p, page_size: PAGE_SIZE };
      if (statusFilter) params.status_code = statusFilter;
      if (routeFilter)  params.route       = routeFilter;
      const { data } = await api.get('/admin/error-logs', { params });
      setLogs(data.items);
      setTotal(data.total);
    } catch {
      toast.error('Error loading logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); load(1); }, [period, statusFilter]);
  useEffect(() => { load(page); }, [page]);

  const handleRouteSearch = (e) => {
    if (e.key === 'Enter') { setPage(1); load(1); }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await api.delete('/admin/error-logs');
      toast.success('Logs cleared!');
      load(1);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error clearing logs.');
    } finally {
      setClearing(false);
      setClearConfirm(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const statusClass = (code) => {
    const key = Math.floor(code / 100);
    return STATUS_COLORS[key] || 'text-slate-400 bg-slate-400/10';
  };

  const methodClass = (method) => METHOD_COLORS[method?.toUpperCase()] || 'text-slate-400 bg-slate-400/10';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Error Logs
          </h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            HTTP 4xx/5xx errors captured automatically — {total} record(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(page)}
            className={`p-2 rounded-lg transition border ${isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-500'}`}
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setClearConfirm(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition border ${isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
            >
              <Trash2 className="w-4 h-4" />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Period */}
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className={`px-3 py-2 border rounded-xl text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
        >
          <option value="1d">Last day</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All</option>
        </select>

        {/* Status Code */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className={`px-3 py-2 border rounded-xl text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
        >
          <option value="">All statuses</option>
          <option value="400">400 Bad Request</option>
          <option value="401">401 Unauthorized</option>
          <option value="403">403 Forbidden</option>
          <option value="404">404 Not Found</option>
          <option value="422">422 Unprocessable</option>
          <option value="429">429 Rate Limit</option>
          <option value="500">500 Server Error</option>
        </select>

        {/* Route search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            value={routeFilter}
            onChange={e => setRouteFilter(e.target.value)}
            onKeyDown={handleRouteSearch}
            placeholder="Filter by route (Enter to search)"
            className={`w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
          />
        </div>
      </div>

      {/* Table */}
      <div className={`border rounded-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
            <p className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No logs found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isDark ? 'bg-slate-800/50' : 'bg-slate-50'}>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Date</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Method</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Route</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>User</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>IP</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      className={`border-t cursor-pointer transition ${
                        isDark ? 'border-slate-800 hover:bg-slate-800/60' : 'border-slate-100 hover:bg-slate-50'
                      } ${expanded === log.id ? isDark ? 'bg-slate-800/40' : 'bg-slate-50' : ''}`}
                    >
                      <td className={`px-4 py-3 text-xs whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {new Date(log.created_at).toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusClass(log.status_code)}`}>
                          {log.status_code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${methodClass(log.method)}`}>
                          {log.method}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-mono text-xs max-w-[220px] truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {log.route}
                      </td>
                      <td className={`px-4 py-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {log.user_email || <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>anônimo</span>}
                      </td>
                      <td className={`px-4 py-3 text-xs font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {log.ip}
                      </td>
                      <td className={`px-4 py-3 text-xs max-w-[260px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {log.error_message || '—'}
                      </td>
                    </tr>
                    {expanded === log.id && (
                      <tr key={`${log.id}-expanded`} className={`border-t ${isDark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-100 bg-slate-50'}`}>
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-2">
                            <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Detalhes</p>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ID: </span>
                                <span className={`font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{log.id}</span>
                              </div>
                              <div>
                                <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>User ID: </span>
                                <span className={`font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{log.user_id || '—'}</span>
                              </div>
                            </div>
                            {log.error_message && (
                              <div>
                                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Mensagem completa:</p>
                                <pre className={`text-xs p-3 rounded-xl overflow-auto max-h-40 whitespace-pre-wrap break-all ${isDark ? 'bg-slate-900 text-red-400' : 'bg-white text-red-600 border border-slate-200'}`}>
                                  {log.error_message}
                                </pre>
                              </div>
                            )}
                            {log.user_agent && (
                              <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                <span className="font-medium">User-Agent: </span>{log.user_agent}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Página {page} de {totalPages} — {total} registros
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`p-2 rounded-lg transition disabled:opacity-30 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`text-sm font-medium px-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{page}/{totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`p-2 rounded-lg transition disabled:opacity-30 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={clearConfirm}
        title="Clear all error logs?"
        message="This action is irreversible. All error records will be permanently removed."
        confirmLabel="Clear all"
        variant="danger"
        loading={clearing}
        onConfirm={handleClear}
        onCancel={() => setClearConfirm(false)}
      />
    </div>
  );
}
