import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const STAGE_LABELS = {
  created:    'Criado',
  email_sent: 'E-mail enviado',
  opened:     'Aberto',
  filling:    'Preenchendo',
  submitted:  'Enviado',
  reviewed:   'Revisado',
  converted:  'Convertido',
};

const STAGE_COLOR = {
  created:    'bg-slate-500',
  email_sent: 'bg-blue-500',
  opened:     'bg-purple-500',
  filling:    'bg-amber-500',
  submitted:  'bg-emerald-500',
  reviewed:   'bg-teal-500',
  converted:  'bg-green-500',
};

function KpiCard({ label, value, icon: Icon, isDark, accent = 'text-purple-400' }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <Icon className={`w-5 h-5 ${accent}`} />
      </div>
      <div>
        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</div>
        <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</div>
      </div>
    </div>
  );
}

export default function PitchDeckTrackingDashboard({ isDark }) {
  const [stats, setStats]   = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all invites and derive stats client-side
      const { data } = await api.get('/pitch-deck/invites');
      const list = data.invites ?? data ?? [];

      const byStatus = {};
      list.forEach(inv => {
        byStatus[inv.status] = (byStatus[inv.status] || 0) + 1;
      });

      const now = Date.now();
      const staleDays = 3;
      const stale = list.filter(inv => {
        if (['converted', 'rejected', 'expired'].includes(inv.status)) return false;
        const updated = new Date(inv.updated_at || inv.created_at).getTime();
        return (now - updated) > staleDays * 86400 * 1000;
      });

      const convertedCount = byStatus.converted || 0;
      const totalNonEmpty  = list.length;
      const convRate = totalNonEmpty ? Math.round((convertedCount / totalNonEmpty) * 100) : 0;

      setStats({ byStatus, stale, total: list.length, convRate, list });

      // Build funnel events from status distribution
      const funnelEvents = Object.entries(STAGE_LABELS).map(([key]) => ({
        stage: key,
        count: byStatus[key] || 0,
      }));
      setEvents(funnelEvents);
    } catch {
      toast.error('Erro ao carregar tracking.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const base = isDark ? 'text-slate-200' : 'text-slate-900';

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const maxCount = Math.max(...events.map(e => e.count), 1);

  return (
    <div className={`space-y-6 ${base}`}>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total de convites"    value={stats?.total ?? 0}      icon={TrendingUp}     isDark={isDark} accent="text-purple-400" />
        <KpiCard label="Taxa de conversão"    value={`${stats?.convRate ?? 0}%`} icon={TrendingUp}  isDark={isDark} accent="text-emerald-400" />
        <KpiCard label="Aguardando revisão"   value={stats?.byStatus?.submitted ?? 0} icon={Clock}  isDark={isDark} accent="text-amber-400" />
        <KpiCard label="Parados +3 dias"      value={stats?.stale?.length ?? 0}  icon={AlertTriangle} isDark={isDark} accent="text-red-400" />
      </div>

      {/* Funnel */}
      <div className={`rounded-xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Funil de convites</h3>
          <button onClick={load} className="text-slate-400 hover:text-purple-400 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {events.map(e => (
            <div key={e.stage} className="flex items-center gap-3">
              <span className={`text-xs w-28 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {STAGE_LABELS[e.stage]}
              </span>
              <div className={`flex-1 h-5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${STAGE_COLOR[e.stage] ?? 'bg-slate-500'}`}
                  style={{ width: `${Math.round((e.count / maxCount) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold w-8 text-right">{e.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stale invites */}
      {stats?.stale?.length > 0 && (
        <div className={`rounded-xl border p-5 ${isDark ? 'bg-slate-900 border-amber-800/40' : 'bg-amber-50 border-amber-200'}`}>
          <h3 className="font-semibold text-sm text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Convites parados há +3 dias
          </h3>
          <ul className="space-y-1.5 text-sm">
            {stats.stale.map(inv => (
              <li key={inv.id} className={`flex items-center justify-between ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <span>{inv.client_name || inv.client_email || 'Sem nome'} — {inv.company_hint || '—'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-800/30 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>{inv.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
