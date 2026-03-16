import { useState, useEffect } from 'react';
import { Compass, ArrowRight, ArrowLeft, Check, RotateCcw, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../lib/i18n';

const CATEGORY_LABELS = {
  company_info: 'crm_consult_cat_company',
  revenue_growth: 'crm_consult_cat_revenue',
  profitability: 'crm_consult_cat_profit',
  balance_sheet: 'crm_consult_cat_balance',
  business_profile: 'crm_consult_cat_business',
  risk_factors: 'crm_consult_cat_risk',
};

const FIELD_LABELS = {
  company_name: 'crm_consult_field_company_name',
  sector: 'crm_consult_field_sector',
  cnpj: 'crm_consult_field_cnpj',
  revenue: 'crm_consult_field_revenue',
  growth_rate: 'crm_consult_field_growth_rate',
  net_margin: 'crm_consult_field_net_margin',
  ebitda: 'crm_consult_field_ebitda',
  debt: 'crm_consult_field_debt',
  cash: 'crm_consult_field_cash',
  years_in_business: 'crm_consult_field_years',
  num_employees: 'crm_consult_field_employees',
  recurring_revenue_pct: 'crm_consult_field_recurring',
  founder_dependency: 'crm_consult_field_founder',
  previous_investment: 'crm_consult_field_investment',
};

const SECTORS = [
  'Technology', 'SaaS', 'E-commerce', 'Fintech', 'Healthcare',
  'Services', 'Retail', 'Manufacturing', 'Logistics', 'Education',
  'Food', 'Construction', 'Agribusiness', 'Other',
];

export default function GuidedConsultation({ clientId }) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [questions, setQuestions] = useState(null);
  const [session, setSession] = useState(null);
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([
      api.get(`/partners/clients/${clientId}/consultation/questions`),
      api.get(`/partners/clients/${clientId}/consultation`),
    ]).then(([qRes, sRes]) => {
      setQuestions(qRes.data);
      if (sRes.data) {
        setSession(sRes.data);
        setResponses(sRes.data.responses || {});
        setStep(sRes.data.current_step || 0);
      }
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [clientId]);

  const handleSave = async (completed = false) => {
    setSaving(true);
    try {
      const { data } = await api.post(`/partners/clients/${clientId}/consultation`, {
        responses,
        current_step: step,
        is_completed: completed,
      });
      setSession(data);
      toast.success(completed ? t('crm_consult_completed') : t('crm_consult_saved'));
      if (completed) setActive(false);
    } catch {
      toast.error('Error');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (key, value) => {
    setResponses(prev => ({ ...prev, [key]: value }));
  };

  const card = `border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;
  const inputCls = `w-full rounded-xl px-4 py-2.5 text-sm border transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`;

  if (loading) return <div className={`h-48 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />;

  // Intro screen
  if (!active) {
    return (
      <div className={card}>
        <div className="flex items-center gap-2 mb-3">
          <Compass className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('crm_consult_title')}</h3>
        </div>
        <p className={`text-xs mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('crm_consult_subtitle')}</p>

        {session && session.is_completed && (
          <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-xs font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
            <Check className="w-4 h-4" />
            {t('crm_consult_completed')}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setActive(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium hover:from-emerald-500 hover:to-teal-500 transition"
          >
            {session && !session.is_completed ? t('crm_consult_resume') : t('crm_consult_start')}
            <ArrowRight className="w-4 h-4" />
          </button>
          {session && (
            <button
              onClick={() => { setResponses({}); setStep(0); setSession(null); setActive(true); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('crm_consult_restart')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Wizard active
  const totalSteps = questions?.total_steps || 6;
  const currentQ = questions?.questions?.[step];
  if (!currentQ) return null;

  const isLastStep = step === totalSteps - 1;

  return (
    <div className={card}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Compass className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {t(CATEGORY_LABELS[currentQ.category] || 'crm_consult_title')}
          </h3>
        </div>
        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {t('crm_consult_step')} {step + 1} {t('crm_consult_of')} {totalSteps}
        </span>
      </div>

      {/* Progress bar */}
      <div className={`h-1.5 rounded-full mb-6 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
        <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
      </div>

      {/* Fields */}
      <div className="space-y-4 mb-6">
        {currentQ.fields.map((field) => (
          <div key={field.key}>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t(FIELD_LABELS[field.key] || field.key)} {field.required && <span className="text-red-400">*</span>}
            </label>
            {field.type === 'select' ? (
              <select
                value={responses[field.key] || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className={inputCls}
              >
                <option value="">—</option>
                {(field.options || SECTORS).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'slider' ? (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={field.min || 0}
                  max={field.max || 1}
                  step={field.step || 0.1}
                  value={responses[field.key] || 0}
                  onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <span className={`text-sm font-mono min-w-[3ch] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {responses[field.key] || 0}
                </span>
              </div>
            ) : (
              <input
                type={field.type === 'currency' || field.type === 'number' || field.type === 'percent' ? 'number' : 'text'}
                value={responses[field.key] || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={field.type === 'currency' ? '0.00' : field.type === 'percent' ? '0' : ''}
                step={field.type === 'currency' ? '0.01' : field.type === 'percent' ? '0.1' : undefined}
                className={inputCls}
              />
            )}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setStep(s => s - 1); handleSave(); }}
          disabled={step === 0}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-30 ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <ArrowLeft className="w-4 h-4" />
          {t('crm_consult_back')}
        </button>

        {isLastStep ? (
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {t('crm_consult_finish')}
          </button>
        ) : (
          <button
            onClick={() => { setStep(s => s + 1); handleSave(); }}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium hover:from-emerald-500 hover:to-teal-500 transition"
          >
            {t('crm_consult_next')}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
