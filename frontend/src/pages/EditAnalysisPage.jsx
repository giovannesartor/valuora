import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../lib/i18n';

const PCT_FIELDS = ['net_margin', 'growth_rate', 'recurring_revenue_pct', 'founder_dependency', 'dcf_weight'];

const FIELDS = [
  { key: 'revenue',           label: 'Annual Revenue ($)',         type: 'number', hint: 'Gross revenue from last fiscal year.' },
  { key: 'net_margin',        label: 'Net Margin (%)',          type: 'number', hint: 'Ex: 15 = 15%' },
  { key: 'growth_rate',       label: 'Growth Rate (%)',     type: 'number', hint: 'Expected annual growth.' },
  { key: 'debt',              label: 'Total Debt ($)',           type: 'number', hint: 'Total financial liabilities.' },
  { key: 'cash',              label: 'Cash & Equivalents ($)',   type: 'number', hint: 'Cash + short-term investments.' },
  { key: 'ebitda',            label: 'EBITDA ($)',                 type: 'number', hint: 'Optional. Leave blank to calculate.' },
  { key: 'founder_dependency',label: 'Founder Dependency (%)',  type: 'number', hint: '0 = no dependency, 100 = total.' },
  { key: 'projection_years',  label: 'Projection Years',            type: 'number', hint: '5 or 10 years.' },
  { key: 'recurring_revenue_pct', label: 'Recurring Revenue (%)', type: 'number', hint: 'Percentage of revenue that is recurring.' },
  { key: 'num_employees',     label: 'Number of Employees',     type: 'number', hint: 'Total employees.' },
  { key: 'years_in_business', label: 'Years in Business',            type: 'number', hint: 'Years the company has existed.' },
  { key: 'previous_investment',label: 'Previous Investment ($)', type: 'number', hint: 'Total raised in previous rounds.' },
  { key: 'dcf_weight',        label: 'DCF Weight (%)',                type: 'number', hint: 'DCF method weight (e.g., 60 = 60%). Remainder is multiples.' },
];

export default function EditAnalysisPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useI18n();

  const [analysis, setAnalysis] = useState(null);
  const [form, setForm]         = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    api.get(`/analyses/${id}`)
      .then(({ data }) => {
        setAnalysis(data);
        // Pre-fill form — convert decimal fractions to percentages for display
        const initial = {};
        FIELDS.forEach(({ key }) => {
          let val = data[key];
          if (PCT_FIELDS.includes(key) && val != null) val = (parseFloat(val) * 100).toFixed(2);
          initial[key] = val ?? '';
        });
        setForm(initial);
      })
      .catch(() => {
        toast.error('Analysis not found.');
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Build payload — convert % display back to decimals
      const payload = {};
      FIELDS.forEach(({ key, type }) => {
        let raw = form[key];
        if (raw === '' || raw === null || raw === undefined) return;
        let num = type === 'number' ? parseFloat(raw) : raw;
        if (isNaN(num)) return;
        if (PCT_FIELDS.includes(key)) num = num / 100;
        payload[key] = num;
      });

      await api.post(`/analyses/${id}/reanalyze`, payload);
      toast.success('Re-analysis completed successfully!');
      navigate(`/analysis/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error re-analyzing.');
    } finally {
      setSaving(false);
    }
  };

  const cls = {
    card:    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
    title:   isDark ? 'text-white' : 'text-slate-900',
    label:   isDark ? 'text-slate-300' : 'text-slate-700',
    input:   isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500',
    hint:    isDark ? 'text-slate-500' : 'text-slate-400',
  };

  if (loading) {
    return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>{t('loading')}</div>;
  }

  return (
    <div className={`min-h-screen transition-colors ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <button
            onClick={() => navigate(`/analysis/${id}`)}
            className={`transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`font-bold ${cls.title}`}>Re-analyze: {analysis?.company_name}</h1>
            <p className={`text-xs ${cls.hint}`}>Update the financial data and re-run the analysis without a new payment.</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Info banner */}
        <div className={`flex items-start gap-3 rounded-xl border p-4 mb-8 ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
          <Info className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
          <p className={`text-sm ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
            This analysis has already been paid. You can update the data below and re-run the valuation at no additional cost.
            A new PDF will be generated automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={`rounded-2xl border p-6 ${cls.card} mb-6`}>
            <h2 className={`font-semibold mb-6 ${cls.title}`}>{t('financial_data')}</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FIELDS.map(({ key, label, type, hint }) => (
                <div key={key}>
                  <label className={`block text-xs font-semibold mb-1.5 ${cls.label}`}>{label}</label>
                  <input
                    type={type}
                    step="any"
                    value={form[key] ?? ''}
                    onChange={e => handleChange(key, e.target.value)}
                    placeholder={hint}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition ${cls.input}`}
                  />
                  <p className={`text-[11px] mt-1 ${cls.hint}`}>{hint}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(`/analysis/${id}`)}
              className={`px-5 py-2.5 rounded-xl border text-sm font-medium transition ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/20"
            >
              <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              {saving ? t('reanalyzing') : t('reanalyze')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
