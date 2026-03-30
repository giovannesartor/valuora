import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Clock, User, MessageCircle, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../lib/i18n';

const TRIGGER_LABELS = {
  no_register: { label: 'No Registration', icon: '🎯', desc: 'Client was added but hasn\'t registered yet' },
  no_data: { label: 'No Data Submitted', icon: '📋', desc: 'Client registered but hasn\'t submitted financial data' },
  no_meeting: { label: 'No Meeting', icon: '📞', desc: 'Client data received but no meeting scheduled' },
  no_purchase: { label: 'No Purchase', icon: '💳', desc: 'Analysis complete but client hasn\'t paid' },
  post_report: { label: 'Post-Report', icon: '📊', desc: 'Report delivered, follow up on next steps' },
};

export default function PartnerFollowUpRulesPage() {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [rules, setRules] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('rules'); // 'rules' | 'alerts'
  const [editing, setEditing] = useState({}); // { ruleId: { days_delay, message_template } }

  const loadRules = async () => {
    try {
      const { data } = await api.get('/partners/followup/rules');
      setRules(data);
    } catch { toast.error('Failed to load rules'); }
  };

  const loadAlerts = async () => {
    try {
      const { data } = await api.get('/partners/followup/alerts');
      setAlerts(data);
    } catch { toast.error('Failed to load alerts'); }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadRules(), loadAlerts()]).finally(() => setLoading(false));
  }, []);

  const handleToggle = async (ruleId) => {
    try {
      const { data } = await api.patch(`/partners/followup/rules/${ruleId}/toggle`);
      setRules(prev => prev.map(r => r.id === ruleId ? data : r));
    } catch { toast.error('Failed to toggle rule'); }
  };

  const handleSaveRule = async (rule) => {
    const edits = editing[rule.id];
    if (!edits) return;
    try {
      await api.put(`/partners/followup/rules?rule_ids=${rule.id}`, [edits]);
      toast.success('Rule updated');
      loadRules();
      setEditing(prev => { const n = { ...prev }; delete n[rule.id]; return n; });
    } catch { toast.error('Failed to update'); }
  };

  const card = `border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;

  if (loading) return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      {[1,2,3].map(i => <div key={i} className={`h-24 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />)}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Follow-Up Rules & Alerts</h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Configure automated triggers and see which clients need attention
          </p>
        </div>
        <button onClick={() => { loadRules(); loadAlerts(); }} className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 mb-6 p-1 rounded-xl ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
        {[
          { key: 'rules', label: 'Rules', icon: Bell },
          { key: 'alerts', label: `Alerts (${alerts.length})`, icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition ${
              tab === key
                ? 'bg-emerald-600 text-white shadow-sm'
                : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Rules Tab */}
      {tab === 'rules' && (
        <div className="space-y-3">
          {rules.map(rule => {
            const info = TRIGGER_LABELS[rule.trigger] || { label: rule.trigger, icon: '📌', desc: '' };
            const edit = editing[rule.id] || {};
            return (
              <div key={rule.id} className={card}>
                <div className="flex items-start gap-4">
                  <span className="text-2xl">{info.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{info.label}</h3>
                      <button onClick={() => handleToggle(rule.id)}>
                        {rule.is_active
                          ? <ToggleRight className="w-6 h-6 text-emerald-500" />
                          : <ToggleLeft className={`w-6 h-6 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                        }
                      </button>
                    </div>
                    <p className={`text-xs mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{info.desc}</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex items-center gap-2">
                        <Clock className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        <input
                          type="number"
                          min={1}
                          value={edit.days_delay ?? rule.days_delay}
                          onChange={e => setEditing({ ...editing, [rule.id]: { ...edit, days_delay: parseInt(e.target.value) || 1 } })}
                          className={`w-16 rounded-lg border px-2 py-1 text-xs text-center outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                        />
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>days delay</span>
                      </div>
                    </div>
                    <textarea
                      value={edit.message_template ?? rule.message_template}
                      onChange={e => setEditing({ ...editing, [rule.id]: { ...edit, message_template: e.target.value } })}
                      rows={2}
                      className={`w-full mt-3 rounded-xl border px-3 py-2 text-xs resize-none outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                    {editing[rule.id] && (
                      <button
                        onClick={() => handleSaveRule(rule)}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 transition"
                      >
                        Save Changes
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alerts Tab */}
      {tab === 'alerts' && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className={`${card} text-center py-12`}>
              <Bell className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No pending alerts</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>All your clients are on track!</p>
            </div>
          ) : alerts.map((alert, idx) => {
            const info = TRIGGER_LABELS[alert.trigger] || { label: alert.trigger, icon: '📌' };
            return (
              <div key={idx} className={`${card} border-l-4 ${alert.days_overdue > 3 ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-xl">{info.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{alert.client_name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${alert.days_overdue > 3 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {alert.days_overdue}d overdue
                      </span>
                    </div>
                    <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{info.label}</p>
                    <div className={`rounded-xl p-3 text-xs ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
                      <MessageCircle className={`w-3 h-3 inline mr-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                      {alert.message}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {alert.client_email && (
                        <a href={`mailto:${alert.client_email}`} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition">
                          Send Email
                        </a>
                      )}
                      {alert.client_phone && (
                        <a href={`https://wa.me/${alert.client_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded-lg bg-green-600 text-white hover:bg-green-500 transition">
                          WhatsApp
                        </a>
                      )}
                      <button
                        onClick={() => { navigator.clipboard.writeText(alert.message); toast.success('Message copied!'); }}
                        className={`text-[10px] px-2 py-1 rounded-lg transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        Copy Message
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
