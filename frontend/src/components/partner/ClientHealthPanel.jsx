import { useState, useEffect } from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../lib/i18n';

const STAGE_LABELS = {
  registered: 'crm_health_stage_registered',
  filling: 'crm_health_stage_filling',
  analysis_complete: 'crm_health_stage_complete',
  report_sent: 'crm_health_stage_report',
};

const STAGE_COLORS = {
  registered: 'text-yellow-500 bg-yellow-500/10',
  filling: 'text-blue-500 bg-blue-500/10',
  analysis_complete: 'text-emerald-500 bg-emerald-500/10',
  report_sent: 'text-teal-500 bg-teal-500/10',
};

export default function ClientHealthPanel({ clientId }) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFields, setShowFields] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    api.get(`/partners/clients/${clientId}/health`)
      .then(({ data }) => setHealth(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <div className={`h-48 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />;
  if (!health) return null;

  const fillColor = health.fill_percentage >= 80 ? 'bg-emerald-500' :
                    health.fill_percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('crm_health_title')}</h3>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STAGE_COLORS[health.stage] || 'text-slate-400 bg-slate-500/10'}`}>
          {t(STAGE_LABELS[health.stage] || 'crm_health_stage_registered')}
        </span>
      </div>

      {/* Fill percentage bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('crm_health_fill')}</span>
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{health.fill_percentage}%</span>
        </div>
        <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
          <div className={`h-full rounded-full transition-all duration-500 ${fillColor}`} style={{ width: `${health.fill_percentage}%` }} />
        </div>
      </div>

      {/* Expandable fields */}
      <button
        onClick={() => setShowFields(!showFields)}
        className={`flex items-center justify-between w-full text-xs font-medium mb-2 py-1.5 transition ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}
      >
        <span>{t('crm_health_fields')} ({health.fields.filter(f => f.filled).length}/{health.fields.length})</span>
        {showFields ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {showFields && (
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {health.fields.map((f) => (
            <div key={f.field} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${f.filled ? (isDark ? 'text-emerald-400 bg-emerald-500/5' : 'text-emerald-600 bg-emerald-50') : (isDark ? 'text-slate-500 bg-slate-800' : 'text-slate-400 bg-slate-100')}`}>
              {f.filled ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3 opacity-50" />}
              {f.label}
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {health.alerts.length > 0 && (
        <div className="mb-4">
          <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('crm_health_alerts')}</h4>
          <div className="space-y-1.5">
            {health.alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg ${
                a.severity === 'error'
                  ? (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')
                  : (isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600')
              }`}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {health.suggestions.length > 0 && (
        <div>
          <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('crm_health_suggestions')}</h4>
          <div className="space-y-1.5">
            {health.suggestions.map((s, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">{s.area}:</span> {s.message}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    s.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                    s.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-500/20 text-slate-400'
                  }`}>{s.impact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {health.alerts.length === 0 && health.suggestions.length === 0 && health.fill_percentage > 0 && (
        <p className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('crm_health_no_suggestions')}</p>
      )}
    </div>
  );
}
