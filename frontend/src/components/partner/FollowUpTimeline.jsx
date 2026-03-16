import { useState, useEffect } from 'react';
import {
  Clock, Mail, UserX, FileText, ShoppingCart, Bell,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import api from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../lib/i18n';

const TRIGGER_CONFIG = {
  no_fill_3d: { icon: UserX, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  report_7d: { icon: FileText, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  no_purchase_7d: { icon: ShoppingCart, color: 'text-red-400', bgColor: 'bg-red-500/10' },
};

const TRIGGER_I18N = {
  no_fill_3d: 'crm_followup_no_fill',
  report_7d: 'crm_followup_report_review',
  no_purchase_7d: 'crm_followup_no_purchase',
};

export default function FollowUpTimeline({ clientId }) {
  const { isDark } = useTheme();
  const { t } = useI18n();

  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const url = clientId
      ? `/partners/follow-ups?client_id=${clientId}`
      : '/partners/follow-ups';
    api.get(url)
      .then(({ data }) => setFollowUps(data || []))
      .catch(() => setFollowUps([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  const card = `border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;

  if (loading) return <div className={`h-40 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />;

  const visible = expanded ? followUps : followUps.slice(0, 5);

  return (
    <div className={card}>
      <div className="flex items-center gap-2 mb-4">
        <Bell className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
        <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('crm_followup_title')}</h3>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
          {followUps.length}
        </span>
      </div>

      {followUps.length === 0 ? (
        <p className={`text-xs italic text-center py-6 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('crm_followup_empty')}</p>
      ) : (
        <>
          <div className="relative">
            {/* Timeline line */}
            <div className={`absolute left-[15px] top-0 bottom-0 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

            <div className="space-y-3">
              {visible.map((fu) => {
                const config = TRIGGER_CONFIG[fu.trigger_type] || TRIGGER_CONFIG.no_fill_3d;
                const Icon = config.icon;
                return (
                  <div key={fu.id} className="flex items-start gap-3 relative">
                    <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 z-10 ${config.bgColor}`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {t(TRIGGER_I18N[fu.trigger_type] || 'crm_followup_no_fill')}
                        </span>
                        {fu.client_name && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                            {fu.client_name}
                          </span>
                        )}
                        <span className={`text-[10px] ml-auto flex items-center gap-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(fu.sent_at).toLocaleDateString()}
                        </span>
                      </div>
                      {fu.message && (
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fu.message}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {followUps.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`mt-3 w-full flex items-center justify-center gap-1 text-xs py-2 rounded-xl transition ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? t('crm_followup_show_less') || 'Show less' : `${t('crm_followup_show_all') || 'Show all'} (${followUps.length})`}
            </button>
          )}

          <div className={`mt-3 flex items-center gap-1.5 text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            <Mail className="w-3 h-3" />
            {t('crm_followup_auto')}
          </div>
        </>
      )}
    </div>
  );
}
