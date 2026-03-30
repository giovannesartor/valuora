import { useEffect, useState } from 'react';
import { Bell, Mail, ShieldCheck, TrendingUp, Users, Megaphone, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../lib/i18n';

const PREFS = [
  { key: 'email_report_ready', label: 'Report Ready', desc: 'Get notified when your valuation report is complete', icon: TrendingUp },
  { key: 'email_payment_received', label: 'Payment Received', desc: 'Confirmation when a payment is processed', icon: ShieldCheck },
  { key: 'email_partner_client', label: 'New Partner Client', desc: 'Alert when a new client registers via your referral', icon: Users },
  { key: 'email_weekly_digest', label: 'Weekly Digest', desc: 'Weekly summary of your account activity', icon: Mail },
  { key: 'email_marketing', label: 'Product Updates', desc: 'New features, tips, and product announcements', icon: Megaphone },
  { key: 'email_security_alerts', label: 'Security Alerts', desc: 'Login from new devices and security-related notifications', icon: ShieldCheck },
];

export default function NotificationPreferencesPage() {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [prefs, setPrefs] = useState({
    email_report_ready: true,
    email_payment_received: true,
    email_partner_client: true,
    email_weekly_digest: true,
    email_marketing: false,
    email_security_alerts: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/auth/me/notification-preferences')
      .then(({ data }) => setPrefs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/auth/me/notification-preferences', prefs);
      toast.success('Preferences saved!');
    } catch { toast.error('Failed to save preferences'); }
    finally { setSaving(false); }
  };

  const toggle = (key) => setPrefs(prev => ({ ...prev, [key]: !prev[key] }));

  const card = `border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Bell className={`w-6 h-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Notification Preferences</h1>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Choose which email notifications you'd like to receive</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className={`h-16 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />)}
        </div>
      ) : (
        <div className={card}>
          <div className="space-y-1">
            {PREFS.map(({ key, label, desc, icon: Icon }) => (
              <div
                key={key}
                className={`flex items-center justify-between p-4 rounded-xl transition ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{label}</p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggle(key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs[key] ? 'bg-emerald-500' : isDark ? 'bg-slate-700' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs[key] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/50">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
