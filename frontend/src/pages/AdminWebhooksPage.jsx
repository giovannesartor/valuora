import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Activity, ChevronDown, ChevronRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';

const STATUS_BADGE = {
  ok:      { cls: 'bg-emerald-500/10 text-emerald-400', label: 'OK' },
  ignored: { cls: 'bg-amber-500/10 text-amber-400',    label: 'Ignorado' },
  error:   { cls: 'bg-red-500/10 text-red-400',         label: 'Erro' },
};

function StatusBadge({ status }) {
  const b = STATUS_BADGE[status] || { cls: 'bg-slate-700 text-slate-300', label: status };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${b.cls}`}>{b.label}</span>;
}

function WebhookRow({ log, isDark }) {
  const [expanded, setExpanded] = useState(false);
  const cls = { card: isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200', sub: isDark ? 'text-slate-500' : 'text-slate-400', code: isDark ? 'bg-slate-950 text-emerald-300' : 'bg-slate-50 text-slate-800' };
  return (
    <div className={`rounded-xl border overflow-hidden ${cls.card}`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <button className={`flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-mono font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{log.event || '—'}</span>
            <StatusBadge status={log.status} />
          </div>
          <p className={`text-xs truncate mt-0.5 ${cls.sub}`}>
            {log.asaas_payment_id && <span>ID: {log.asaas_payment_id}</span>}
            {log.external_reference && <span className="ml-2">Ref: {log.external_reference}</span>}
          </p>
        </div>
        <span className={`text-xs flex-shrink-0 ${cls.sub}`}>{new Date(log.received_at).toLocaleString('pt-BR')}</span>
      </div>
      {expanded && (
        <div className={`border-t px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {log.error_detail && (
            <div className={`mb-3 px-3 py-2 rounded-xl text-xs font-mono text-red-400 ${isDark ? 'bg-red-500/5 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
              {log.error_detail}
            </div>
          )}
          {log.payload && (
            <pre className={`text-xs overflow-x-auto rounded-xl p-3 ${cls.code}`}>
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminWebhooksPage() {
  usePageTitle('Admin - Webhooks');
  const { isDark } = useTheme();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [total, setTotal] = useState(0);

  const cls = {
    card: isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200',
    sub: isDark ? 'text-slate-500' : 'text-slate-400',
    title: isDark ? 'text-white' : 'text-slate-900',
    select: isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900',
  };

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filterEvent) params.event = filterEvent;
    if (filterStatus) params.status = filterStatus;
    api.get('/admin/webhooks/logs', { params })
      .then(r => { setLogs(r.data.logs || []); setTotal(r.data.total || 0); })
      .catch(() => toast.error('Erro ao carregar logs.'))
      .finally(() => setLoading(false));
  }, [filterEvent, filterStatus]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(fetchLogs, 30_000);
    return () => clearInterval(t);
  }, [fetchLogs]);

  const ok = logs.filter(l => l.status === 'ok').length;
  const errors = logs.filter(l => l.status === 'error').length;
  const ignored = logs.filter(l => l.status === 'ignored').length;

  const EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED', 'PAYMENT_RECEIVED'];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${cls.title}`}>Webhooks</h1>
          <p className={`text-sm mt-0.5 ${cls.sub}`}>Stripe webhook events received · refreshes every 30s</p>
        </div>
        <button onClick={fetchLogs} disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition disabled:opacity-50 ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: total, icon: Activity, c: 'text-blue-400' },
          { label: 'OK', value: ok, icon: CheckCircle, c: 'text-emerald-400' },
          { label: 'Ignorado', value: ignored, icon: AlertTriangle, c: 'text-amber-400' },
          { label: 'Erro', value: errors, icon: XCircle, c: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${cls.card}`}>
            <div className="flex items-center gap-2 mb-1"><s.icon className={`w-4 h-4 ${s.c}`} /><span className={`text-xs ${cls.sub}`}>{s.label}</span></div>
            <p className={`text-xl font-bold ${cls.title}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)}
          className={`px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${cls.select}`}>
          <option value="">Todos os eventos</option>
          {EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className={`px-3 py-2 border rounded-xl text-sm focus:outline-none focus:border-emerald-500 ${cls.select}`}>
          <option value="">Todos os status</option>
          <option value="ok">OK</option>
          <option value="ignored">Ignorado</option>
          <option value="error">Erro</option>
        </select>
      </div>

      {/* Logs */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${cls.card}`}>
          <Activity className={`w-10 h-10 mx-auto mb-3 ${cls.sub}`} />
          <p className={`font-medium ${cls.title}`}>Nenhum log encontrado</p>
          <p className={`text-sm mt-1 ${cls.sub}`}>Os eventos chegam automaticamente ao receber pagamentos.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => <WebhookRow key={log.id} log={log} isDark={isDark} />)}
        </div>
      )}
    </div>
  );
}
