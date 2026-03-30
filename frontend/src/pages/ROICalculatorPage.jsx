import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, TrendingUp, DollarSign, Clock, BarChart3, Target, ArrowRight, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../lib/i18n';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';

const SECTORS = [
  'tecnologia','saas','ecommerce','fintech','saude','farmacia','estetica',
  'varejo','atacado','industria','consultoria','contabilidade','marketing',
  'servicos','alimentacao','hotelaria','educacao','edtech','construcao',
  'imobiliario','agronegocio','agritech','logistica','entregas','energia',
  'energia_solar','financeiro','seguros','midia','games','outros',
];

export default function ROICalculatorPage() {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    current_revenue: '',
    current_net_margin: '',
    expected_growth_rate: '10',
    investment_amount: '',
    investment_horizon_years: '5',
    sector: 'outros',
    exit_multiple: '',
  });

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.current_revenue || !form.current_net_margin || !form.investment_amount) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        current_revenue: parseFloat(form.current_revenue),
        current_net_margin: parseFloat(form.current_net_margin) / 100,
        expected_growth_rate: parseFloat(form.expected_growth_rate) / 100,
        investment_amount: parseFloat(form.investment_amount),
        investment_horizon_years: parseInt(form.investment_horizon_years),
        sector: form.sector,
      };
      if (form.exit_multiple) payload.exit_multiple = parseFloat(form.exit_multiple);

      const { data } = await api.post('/roi-calculator/calculate', payload);
      setResult(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  const fmtUSD = (v) => {
    if (!v && v !== 0) return '$0';
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Calculator className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('roi_title') || 'ROI Calculator'}
          </h1>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('roi_subtitle') || 'Estimate return on investment, IRR, payback period, and exit value'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className={`lg:col-span-2 rounded-2xl border p-6 h-fit ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          {[
            { key: 'current_revenue', label: t('roi_revenue') || 'Annual Revenue ($)', type: 'number', required: true, placeholder: '1000000' },
            { key: 'current_net_margin', label: t('roi_margin') || 'Net Margin (%)', type: 'number', required: true, placeholder: '15' },
            { key: 'expected_growth_rate', label: t('roi_growth') || 'Expected Growth (%)', type: 'number', placeholder: '10' },
            { key: 'investment_amount', label: t('roi_investment') || 'Investment Amount ($)', type: 'number', required: true, placeholder: '500000' },
            { key: 'investment_horizon_years', label: t('roi_horizon') || 'Horizon (years)', type: 'number', placeholder: '5' },
            { key: 'exit_multiple', label: t('roi_exit_mult') || 'Exit Multiple (optional)', type: 'number', placeholder: 'Auto' },
          ].map(({ key, label, type, required, placeholder }) => (
            <div key={key} className="mb-4">
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {label} {required && <span className="text-red-400">*</span>}
              </label>
              <input
                type={type}
                value={form[key]}
                onChange={e => updateField(key, e.target.value)}
                placeholder={placeholder}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/40 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
              />
            </div>
          ))}

          <div className="mb-5">
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('roi_sector') || 'Sector'}
            </label>
            <select
              value={form.sector}
              onChange={e => updateField('sector', e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/40 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              {SECTORS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-sm hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                {t('roi_calculate') || 'Calculate ROI'}
              </>
            )}
          </button>
        </form>

        {/* Results */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5"
              >
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'ROI', value: `${result.roi_pct}%`, icon: TrendingUp, color: result.roi_pct > 100 ? 'emerald' : result.roi_pct > 30 ? 'blue' : 'amber' },
                    { label: 'MOIC', value: `${result.moic}x`, icon: DollarSign, color: result.moic > 3 ? 'emerald' : 'blue' },
                    { label: 'IRR', value: `${result.irr_pct}%`, icon: BarChart3, color: result.irr_pct > 20 ? 'emerald' : 'blue' },
                    { label: 'Payback', value: result.payback_years ? `${result.payback_years}yr` : 'N/A', icon: Clock, color: result.payback_years && result.payback_years <= 3 ? 'emerald' : 'amber' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${color}-500/10`}>
                          <Icon className={`w-3.5 h-3.5 text-${color}-500`} />
                        </div>
                        <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
                      </div>
                      <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Exit value card */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-emerald-500" />
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Exit Summary</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Projected Equity</p>
                      <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtUSD(result.projected_equity_value)}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total Return</p>
                      <p className={`text-lg font-bold ${result.total_return > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmtUSD(result.total_return)}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] uppercase font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Exit Multiple</p>
                      <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{result.exit_multiple_used}x</p>
                    </div>
                  </div>
                </div>

                {/* Revenue projection chart */}
                {result.annual_cash_flows?.length > 0 && (
                  <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Revenue Projection</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={result.annual_cash_flows}>
                        <defs>
                          <linearGradient id="roiGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#059669" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `Y${v}`} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmtUSD} />
                        <Tooltip
                          formatter={(v) => fmtUSD(v)}
                          contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#059669" fill="url(#roiGrad)" strokeWidth={2} name="Revenue" />
                        <Area type="monotone" dataKey="net_income" stroke="#8b5cf6" fill="none" strokeWidth={2} strokeDasharray="4 4" name="Net Income" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* AI Summary */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Summary</h3>
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{result.summary}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`rounded-2xl border-2 border-dashed p-12 text-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}
              >
                <Calculator className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                <p className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('roi_empty') || 'Fill in the form and click Calculate to see your ROI analysis'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
