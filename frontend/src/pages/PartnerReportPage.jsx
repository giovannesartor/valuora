import { useState, useEffect } from 'react';
import { BarChart3, Download, Loader2, Calendar, DollarSign, FileText, TrendingUp, Users } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';

export default function PartnerReportPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [recentReports, setRecentReports] = useState([]);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, reportsRes] = await Promise.all([
        api.get(`/partner/reports/metrics?period=${period}`),
        api.get('/partner/reports/recent'),
      ]);
      setMetrics(metricsRes.data);
      setRecentReports(reportsRes.data);
    } catch {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async () => {
    try {
      const { data } = await api.get(`/partner/reports/export?period=${period}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `valuora-partner-report-${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to export');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Revenue',
      value: `$${(metrics?.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      change: metrics?.revenue_change,
    },
    {
      title: 'Reports Generated',
      value: metrics?.reports_count || 0,
      icon: FileText,
      change: metrics?.reports_change,
    },
    {
      title: 'New Clients',
      value: metrics?.new_clients || 0,
      icon: Users,
      change: metrics?.clients_change,
    },
    {
      title: 'Avg. Report Value',
      value: `$${(metrics?.avg_report_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      change: metrics?.avg_change,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-emerald-500" />
            Reports
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Performance metrics and revenue insights for your partner account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button
            onClick={downloadCSV}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
          >
            <div className="flex items-center justify-between">
              <card.icon className="w-5 h-5 text-emerald-500" />
              {card.change != null && (
                <span
                  className={`text-xs font-medium ${
                    card.change >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {card.change >= 0 ? '+' : ''}
                  {card.change}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-3">{card.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.title}</p>
          </div>
        ))}
      </div>

      {/* Recent Reports Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">Recent Client Reports</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {recentReports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.client_name || 'Unknown'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                      {r.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    ${(r.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-emerald-600 font-medium">
                    ${(r.commission || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {recentReports.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    No reports generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
