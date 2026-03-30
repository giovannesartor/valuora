import { useEffect, useState } from 'react';
import { Palette, Gift, Save, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../lib/i18n';

export default function PartnerSettingsPage() {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [brandColor, setBrandColor] = useState('#10b981');
  const [brandSecondary, setBrandSecondary] = useState('#0d9488');
  const [saving, setSaving] = useState(false);
  const [freeReportUsed, setFreeReportUsed] = useState(false);
  const [freeReportClientId, setFreeReportClientId] = useState('');
  const [generatingFree, setGeneratingFree] = useState(false);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    api.get('/partners/brand')
      .then(({ data }) => {
        if (data.brand_color) setBrandColor(data.brand_color);
        if (data.brand_secondary_color) setBrandSecondary(data.brand_secondary_color);
      })
      .catch(() => {});

    api.get('/partners/dashboard')
      .then(({ data }) => {
        setFreeReportUsed(data.free_report_used ?? false);
      })
      .catch(() => {});

    api.get('/partners/clients?page_size=100')
      .then(({ data }) => {
        setClients((data.clients || data || []).filter(c => c.analysis_id));
      })
      .catch(() => {});
  }, []);

  const handleSaveBrand = async () => {
    setSaving(true);
    try {
      await api.put('/partners/brand', {
        brand_color: brandColor,
        brand_secondary_color: brandSecondary,
      });
      toast.success('Brand colors saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleFreeReport = async () => {
    if (!freeReportClientId) return toast.error('Select a client first');
    setGeneratingFree(true);
    try {
      await api.post(`/partners/free-report/generate?client_id=${freeReportClientId}`);
      toast.success('Free report activated!');
      setFreeReportUsed(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to generate');
    } finally { setGeneratingFree(false); }
  };

  const card = `border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Partner Settings</h1>
      <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Customize your brand and manage special tools
      </p>

      {/* Brand Colors */}
      <div className={`${card} mb-6`}>
        <div className="flex items-center gap-3 mb-4">
          <Palette className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Brand Colors</h2>
        </div>
        <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          These colors will be applied to your clients' PDF reports
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={e => setBrandColor(e.target.value)}
                className="w-10 h-10 rounded-lg border-0 cursor-pointer"
              />
              <input
                type="text"
                value={brandColor}
                onChange={e => setBrandColor(e.target.value)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-mono outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
              />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Secondary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandSecondary}
                onChange={e => setBrandSecondary(e.target.value)}
                className="w-10 h-10 rounded-lg border-0 cursor-pointer"
              />
              <input
                type="text"
                value={brandSecondary}
                onChange={e => setBrandSecondary(e.target.value)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-mono outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl p-4 mb-4" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandSecondary})` }}>
          <p className="text-white text-sm font-bold">Preview: Your Brand Gradient</p>
          <p className="text-white/80 text-xs mt-1">This is how your colors will look on reports</p>
        </div>

        <button
          onClick={handleSaveBrand}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Colors'}
        </button>
      </div>

      {/* Free Report */}
      <div className={card}>
        <div className="flex items-center gap-3 mb-4">
          <Gift className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Free Demo Report</h2>
        </div>
        <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Each partner gets 1 free Professional report to use as a demo tool for selling the service to potential clients.
        </p>

        {freeReportUsed ? (
          <div className={`flex items-center gap-2 p-4 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <p className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Free report already used
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <select
              value={freeReportClientId}
              onChange={e => setFreeReportClientId(e.target.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              <option value="">Select a client with completed analysis…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.client_name} — {c.client_company || 'No company'}</option>
              ))}
            </select>
            <button
              onClick={handleFreeReport}
              disabled={generatingFree || !freeReportClientId}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition disabled:opacity-50"
            >
              <Gift className="w-4 h-4" /> {generatingFree ? 'Activating…' : 'Activate Free Report'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
