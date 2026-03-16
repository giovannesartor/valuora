import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Eye, Search, Filter, Download, Send,
  FileText, Mail, RefreshCw, X, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../lib/i18n';
import formatCurrency from '../lib/formatCurrency';

export default function AdminAnalysesPage() {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Modals
  const [genModal, setGenModal] = useState(null);       // analysis for generate modal
  const [genPlan, setGenPlan] = useState('profissional');
  const [genSendEmail, setGenSendEmail] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  const [sendModal, setSendModal] = useState(null);     // analysis for send modal
  const [sendEmail, setSendEmail] = useState('');
  const [sendLoading, setSendLoading] = useState(false);

  const [downloadLoading, setDownloadLoading] = useState(null);
  const [resendLoading, setResendLoading] = useState(null);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await api.get('/admin/export/analyses', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analyses-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error exporting CSV.');
    } finally {
      setExporting(false);
    }
  };
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

  // --- Action handlers ---
  const handleGenerate = async () => {
    if (!genModal) return;
    setGenLoading(true);
    try {
      const { data } = await api.post(`/admin/analyses/${genModal.id}/generate-report`, {
        plan: genPlan,
        send_email: genSendEmail,
      });
      toast.success(data.message || t('admin_report_generated'));
      setGenModal(null);
      fetchAnalyses();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setGenLoading(false);
    }
  };

  const handleDownload = async (analysisId) => {
    setDownloadLoading(analysisId);
    try {
      const res = await api.get(`/admin/analyses/${analysisId}/download-pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `valuora-report-${analysisId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error downloading PDF.');
    } finally {
      setDownloadLoading(null);
    }
  };

  const handleSendToClient = async () => {
    if (!sendModal) return;
    setSendLoading(true);
    try {
      const payload = sendEmail.trim() ? { email: sendEmail.trim() } : {};
      const { data } = await api.post(`/admin/analyses/${sendModal.id}/send-to-client`, payload);
      toast.success(data.message || t('admin_report_sent'));
      setSendModal(null);
      setSendEmail('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error sending report.');
    } finally {
      setSendLoading(false);
    }
  };


  const statusColor = {
    draft: isDark ? 'bg-slate-500/10 text-slate-400' : 'bg-slate-100 text-slate-500',
    processing: 'bg-yellow-500/10 text-yellow-500',
    completed: 'bg-green-500/10 text-green-500',
    failed: 'bg-red-500/10 text-red-500',
  };

  const handleResend = async (analysisId) => {
    setResendLoading(analysisId);
    try {
      const { data } = await api.post(`/admin/analyses/${analysisId}/resend-report`);
      toast.success(data.message || 'Report resent!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error resending report.');
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
              <h1 className={`text-xl md:text-2xl font-bold ${cls.title}`}>Analyses</h1>
              <p className={`mt-1 text-sm ${cls.sub}`}>{total} analyses on the platform</p>
            </div>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition disabled:opacity-50 ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
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
                  placeholder="Search by company or user..."
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
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
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
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Company</th>
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell ${cls.th}`}>User</th>
                      <th className={`text-left px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell ${cls.th}`}>Sector</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Status</th>
                      <th className={`text-right px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden md:table-cell ${cls.th}`}>Valuation</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider hidden md:table-cell ${cls.th}`}>Plan</th>
                      <th className={`text-center px-4 md:px-6 py-4 text-xs font-semibold uppercase tracking-wider ${cls.th}`}>Action</th>
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
                          {a.results?.equity_value ? formatCurrency(a.results.equity_value) : '—'}
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-center hidden md:table-cell`}>
                          <span className={`text-xs uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{a.plan || '—'}</span>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <Link
                              to={`/analysis/${a.id}`}
                              className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition"
                              title={t('admin_report_view')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                            {a.status === 'completed' && (
                              <>
                                <button
                                  onClick={() => { setGenModal(a); setGenPlan(a.plan || 'profissional'); setGenSendEmail(false); }}
                                  className="inline-flex items-center gap-1 text-xs text-purple-500 hover:text-purple-400 transition"
                                  title={t('admin_report_generate')}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDownload(a.id)}
                                  disabled={downloadLoading === a.id}
                                  className="inline-flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition disabled:opacity-50"
                                  title={t('admin_report_download')}
                                >
                                  {downloadLoading === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => { setSendModal(a); setSendEmail(''); }}
                                  className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 transition"
                                  title={t('admin_report_send')}
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleResend(a.id)}
                                  disabled={resendLoading === a.id}
                                  className="inline-flex items-center gap-1 text-xs text-sky-500 hover:text-sky-400 transition disabled:opacity-50"
                                  title={t('admin_report_resend')}
                                >
                                  {resendLoading === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                </button>
                              </>
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
              <p className={`text-sm ${cls.sub}`}>Page {page} of {totalPages}</p>
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

      {/* Generate Report Modal */}
      {genModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !genLoading && setGenModal(null)}>
          <div className={`w-full max-w-md rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('admin_report_generate')}</h3>
              <button onClick={() => setGenModal(null)} className={isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}><X className="w-5 h-5" /></button>
            </div>
            <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {genModal.company_name} — {genModal.user_name || genModal.user_email}
            </p>

            <label className={`block text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('admin_report_plan')}</label>
            <div className="flex gap-2 mb-4">
              {['essencial', 'profissional', 'estrategico'].map(p => (
                <button
                  key={p}
                  onClick={() => setGenPlan(p)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition ${
                    genPlan === p
                      ? 'bg-purple-600 text-white border-purple-600'
                      : isDark
                        ? 'border-slate-700 text-slate-400 hover:border-purple-500'
                        : 'border-slate-300 text-slate-600 hover:border-purple-500'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 mb-5 cursor-pointer">
              <input type="checkbox" checked={genSendEmail} onChange={e => setGenSendEmail(e.target.checked)} className="rounded border-slate-600" />
              <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('admin_report_also_send')}</span>
            </label>

            <button
              onClick={handleGenerate}
              disabled={genLoading}
              className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {genLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {genLoading ? t('admin_report_generating') : t('admin_report_generate')}
            </button>
          </div>
        </div>
      )}

      {/* Send to Client Modal */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !sendLoading && setSendModal(null)}>
          <div className={`w-full max-w-md rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('admin_report_send')}</h3>
              <button onClick={() => setSendModal(null)} className={isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}><X className="w-5 h-5" /></button>
            </div>
            <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {sendModal.company_name} — {sendModal.user_name || sendModal.user_email}
            </p>

            <label className={`block text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('admin_report_email_label')}</label>
            <input
              type="email"
              value={sendEmail}
              onChange={e => setSendEmail(e.target.value)}
              placeholder={sendModal.user_email || t('admin_report_email_placeholder')}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
            />
            <p className={`text-[11px] mb-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('admin_report_email_hint')}</p>

            <button
              onClick={handleSendToClient}
              disabled={sendLoading}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sendLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {sendLoading ? t('admin_report_sending') : t('admin_report_send')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
