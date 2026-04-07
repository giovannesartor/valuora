import { useState, useEffect } from 'react';
import { BarChart3, Users, Zap, AlertTriangle, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';

export default function AdminIntegrationPage() {
  const [stats, setStats] = useState(null);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, appsRes] = await Promise.all([
          api.get('/admin/integrations/stats'),
          api.get('/admin/integrations/apps'),
        ]);
        setStats(statsRes.data);
        setApps(appsRes.data);
      } catch {
        toast.error('Failed to load integration data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleApp = async (appId, isActive) => {
    try {
      await api.patch(`/admin/integrations/apps/${appId}`, { is_active: !isActive });
      setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, is_active: !isActive } : a)));
      toast.success(`App ${!isActive ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update app');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Zap className="w-7 h-7 text-emerald-500" />
          Integration Management
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Monitor OAuth apps, API usage, and integration health.
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Apps', value: stats.total_apps, icon: Users },
            { label: 'Active Apps', value: stats.active_apps, icon: Zap },
            { label: 'Requests Today', value: stats.requests_today, icon: BarChart3 },
            { label: 'Errors Today', value: stats.errors_today, icon: AlertTriangle },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-2">
                <s.icon className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Apps Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">OAuth Applications ({apps.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="text-left p-4 font-medium text-slate-500">App Name</th>
                <th className="text-left p-4 font-medium text-slate-500">Owner</th>
                <th className="text-left p-4 font-medium text-slate-500">Client ID</th>
                <th className="text-center p-4 font-medium text-slate-500">Requests</th>
                <th className="text-center p-4 font-medium text-slate-500">Status</th>
                <th className="text-center p-4 font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {apps.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{app.name}</p>
                      {app.is_first_party && (
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-1.5 py-0.5 rounded-full">
                          First-party
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{app.owner_email || '—'}</td>
                  <td className="p-4 font-mono text-xs text-slate-500">{app.client_id?.substring(0, 16)}...</td>
                  <td className="p-4 text-center text-slate-600 dark:text-slate-400">{app.total_requests ?? 0}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      app.is_active
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${app.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {app.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => toggleApp(app.id, app.is_active)}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      {app.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {apps.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No applications registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
