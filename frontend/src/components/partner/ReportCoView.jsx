import { useState, useEffect } from 'react';
import {
  BarChart3, AlertTriangle, MessageCircle, Send, Loader2,
  TrendingUp, Users, Settings, Rocket, DollarSign, CheckCircle,
  PlayCircle, ClipboardList, Presentation, BarChart,
} from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../lib/i18n';
import formatCurrency from '../../lib/formatCurrency';

const ICON_MAP = {
  TrendingUp, AlertTriangle, Users, Settings, Rocket, DollarSign,
  CheckCircle, PlayCircle, ClipboardList, Presentation, BarChart,
};

const PRIORITY_COLORS = {
  high: 'border-red-500/30 bg-red-500/5',
  medium: 'border-amber-500/30 bg-amber-500/5',
  low: 'border-slate-500/30 bg-slate-500/5',
};

export default function ReportCoView({ clientId }) {
  const { isDark } = useTheme();
  const { t } = useI18n();

  const [reportData, setReportData] = useState(null);
  const [comments, setComments] = useState([]);
  const [actions, setActions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([
      api.get(`/partners/clients/${clientId}/report-data`).catch(() => ({ data: null })),
      api.get(`/partners/clients/${clientId}/comments`).catch(() => ({ data: [] })),
      api.get(`/partners/clients/${clientId}/action-templates`).catch(() => ({ data: null })),
    ]).then(([rRes, cRes, aRes]) => {
      setReportData(rRes.data);
      setComments(cRes.data || []);
      setActions(aRes.data);
    }).finally(() => setLoading(false));
  }, [clientId]);

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSavingComment(true);
    try {
      const { data } = await api.post(`/partners/clients/${clientId}/comments`, { content: commentText.trim() });
      setComments([data, ...comments]);
      setCommentText('');
      toast.success(t('crm_report_comment_saved'));
    } catch {
      toast.error('Error');
    } finally {
      setSavingComment(false);
    }
  };

  const card = `border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;
  const metricCard = `rounded-xl p-4 text-center ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`;

  if (loading) return <div className={`h-64 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />;

  // No analysis yet
  if (!reportData) {
    return (
      <div className="space-y-4">
        <div className={`${card} text-center py-10`}>
          <BarChart3 className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('crm_report_no_analysis')}</p>
        </div>

        {/* Still show action templates (like "Start Analysis") */}
        {actions?.templates?.length > 0 && (
          <div className={card}>
            <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('crm_actions_title')}</h3>
            <div className="space-y-2">
              {actions.templates.map((tpl) => {
                const Icon = ICON_MAP[tpl.icon] || CheckCircle;
                return (
                  <div key={tpl.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${PRIORITY_COLORS[tpl.priority]}`}>
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <div>
                      <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{tpl.title}</p>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{tpl.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Processing
  if (reportData.status !== 'completed') {
    return (
      <div className={`${card} text-center py-10`}>
        <Loader2 className={`w-8 h-8 mx-auto mb-3 animate-spin ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('crm_report_processing')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Valuation Metrics */}
      <div className={card}>
        <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          {t('crm_report_title')} — {reportData.company_name}
        </h3>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className={metricCard}>
            <p className={`text-[10px] uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('crm_report_equity')}</p>
            <p className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {reportData.equity_value ? formatCurrency(reportData.equity_value) : '—'}
            </p>
          </div>
          <div className={metricCard}>
            <p className={`text-[10px] uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('crm_report_risk')}</p>
            <p className={`text-lg font-bold ${
              reportData.risk_score > 60 ? 'text-red-400' :
              reportData.risk_score > 40 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {reportData.risk_score ? `${reportData.risk_score.toFixed(0)}/100` : '—'}
            </p>
          </div>
          <div className={metricCard}>
            <p className={`text-[10px] uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('crm_report_maturity')}</p>
            <p className={`text-lg font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {reportData.maturity_index ? `${reportData.maturity_index.toFixed(0)}/100` : '—'}
            </p>
          </div>
        </div>

        {/* Key financials */}
        <div className={`grid grid-cols-2 gap-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <div className="flex justify-between px-3 py-1.5 rounded-lg bg-slate-500/5">
            <span>Revenue</span>
            <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{formatCurrency(reportData.revenue)}</span>
          </div>
          <div className="flex justify-between px-3 py-1.5 rounded-lg bg-slate-500/5">
            <span>Net Margin</span>
            <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{reportData.net_margin ? `${reportData.net_margin}%` : '—'}</span>
          </div>
          {reportData.ebitda && (
            <div className="flex justify-between px-3 py-1.5 rounded-lg bg-slate-500/5">
              <span>EBITDA</span>
              <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{formatCurrency(reportData.ebitda)}</span>
            </div>
          )}
          {reportData.growth_rate && (
            <div className="flex justify-between px-3 py-1.5 rounded-lg bg-slate-500/5">
              <span>Growth</span>
              <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{reportData.growth_rate}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Templates */}
      {actions?.templates?.length > 0 && (
        <div className={card}>
          <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('crm_actions_title')}</h3>
          <div className="space-y-2">
            {actions.templates.map((tpl) => {
              const Icon = ICON_MAP[tpl.icon] || CheckCircle;
              return (
                <div key={tpl.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${PRIORITY_COLORS[tpl.priority]}`}>
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{tpl.title}</p>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        tpl.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        tpl.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {t(`crm_actions_priority_${tpl.priority}`)}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{tpl.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('crm_report_comments')}</h3>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={t('crm_report_add_comment')}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm border transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
          />
          <button
            onClick={handleAddComment}
            disabled={!commentText.trim() || savingComment}
            className="px-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {comments.length === 0 ? (
          <p className={`text-xs italic text-center py-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('crm_report_no_comments')}</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className={`px-3 py-2.5 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{c.content}</p>
                <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  {c.partner_name} · {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
