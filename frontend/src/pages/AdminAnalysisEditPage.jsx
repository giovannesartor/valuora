import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import { useI18n } from '../lib/i18n';

const SECTORS = [
  'Tecnologia', 'Saúde', 'Varejo', 'Indústria', 'Logística', 'Educação',
  'Finanças', 'Imóveis', 'Agronegócio', 'Construção', 'Alimentação',
  'E-commerce', 'Consultoria', 'Serviços', 'Manufatura',
];

function Field({ label, name, type = 'number', value, onChange, hint, isDark, suffix }) {
  const cls = `w-full px-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition
    ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900'}`;
  return (
    <div>
      <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {label}
        {hint && <span className={`ml-1 font-normal ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>({hint})</span>}
      </label>
      <div className="relative">
        {type === 'select_sector' ? (
          <select value={value || ''} onChange={e => onChange(name, e.target.value)} className={cls}>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input
            type={type === 'number' ? 'number' : 'text'}
            step={type === 'number' ? 'any' : undefined}
            value={value ?? ''}
            onChange={e => onChange(name, type === 'number' ? (e.target.value === '' ? null : parseFloat(e.target.value)) : e.target.value)}
            className={cls + (suffix ? ' pr-10' : '')}
          />
        )}
        {suffix && (
          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default function AdminAnalysisEditPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  usePageTitle(t('aae_page_title'));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    api.get(`/admin/analyses/${id}/edit`)
      .then(r => setData(r.data))
      .catch(() => toast.error(t('aae_not_found')))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field, val) => setData(prev => ({ ...prev, [field]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/analyses/${id}/edit`, buildPayload());
      toast.success(t('aae_save_success'));
    } catch (err) {
      toast.error(err.response?.data?.detail || t('aae_save_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm(t('aae_regenerate_confirm'))) return;
    setRegenerating(true);
    try {
      await api.post(`/admin/analyses/${id}/regenerate`, buildPayload());
      toast.success(t('aae_regenerate_success'));
    } catch (err) {
      toast.error(err.response?.data?.detail || t('aae_regenerate_error'));
    } finally {
      setRegenerating(false);
    }
  };

  const buildPayload = () => {
    const p = { ...data };
    // Convert percentage fields to decimal if needed
    delete p.id; delete p.plan; delete p.status; delete p.generate_confirmed;
    delete p.generated_at; delete p.equity_value; delete p.user_id;
    return p;
  };

  const cls = { card: `rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}` };

  if (loading) return <div className="p-8 text-center text-slate-500">{t('aae_loading')}</div>;
  if (!data) return <div className="p-8 text-center text-red-500">{t('aae_not_found')}</div>;

  return (
    <main className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Editar análise: {data.company_name}
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            ID: {id} · Plano: {data.plan || '—'} · Status: {data.status} ·{' '}
            {data.generate_confirmed ? t('aae_report_generated') : t('aae_waiting_generation')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:brightness-110 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? t('aae_saving') : t('aae_save_btn')}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={regenerating || !data.plan}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:brightness-110 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? t('aae_regenerating') : t('aae_save_regenerate')}
          </button>
        </div>
      </div>

      {!data.plan && (
        <div className={`rounded-xl p-4 mb-5 flex items-center gap-3 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
            {t('aae_no_plan_warning')}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Dados básicos */}
        <div className={cls.card}>
          <h3 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('aae_basic_data')}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Nome da empresa" name="company_name" type="text" value={data.company_name} onChange={set} isDark={isDark} />
            <Field label="Setor" name="sector" type="select_sector" value={data.sector} onChange={set} isDark={isDark} />
            <Field label="CNPJ" name="cnpj" type="text" value={data.cnpj} onChange={set} isDark={isDark} />
            <Field label="Tipo de empresa" name="company_type" type="text" value={data.company_type} onChange={set} isDark={isDark} hint="traditional, startup, new_economy, personal_equity" />
          </div>
        </div>

        {/* Dados financeiros principais */}
        <div className={cls.card}>
          <h3 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('aae_main_financial')}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Receita anual (R$)" name="revenue" value={data.revenue} onChange={set} isDark={isDark} />
            <Field label="Margem líquida" name="net_margin" value={data.net_margin != null ? +(data.net_margin * 100).toFixed(4) : ''} onChange={(n, v) => set(n, v != null ? v / 100 : null)} isDark={isDark} hint="ex: 15 = 15%" suffix="%" />
            <Field label="Taxa de crescimento" name="growth_rate" value={data.growth_rate != null ? +(data.growth_rate * 100).toFixed(4) : ''} onChange={(n, v) => set(n, v != null ? v / 100 : null)} isDark={isDark} hint="ex: 10 = 10% a.a." suffix="%" />
            <Field label="Dívida total (R$)" name="debt" value={data.debt} onChange={set} isDark={isDark} />
            <Field label="Caixa (R$)" name="cash" value={data.cash} onChange={set} isDark={isDark} />
            <Field label="EBITDA (R$)" name="ebitda" value={data.ebitda} onChange={set} isDark={isDark} hint="deixe vazio para calcular auto" />
            <Field label="Dependência do fundador" name="founder_dependency" value={data.founder_dependency != null ? +(data.founder_dependency * 100).toFixed(1) : ''} onChange={(n, v) => set(n, v != null ? v / 100 : null)} isDark={isDark} hint="0-100%" suffix="%" />
            <Field label="Receita recorrente" name="recurring_revenue_pct" value={data.recurring_revenue_pct != null ? +(data.recurring_revenue_pct * 100).toFixed(1) : ''} onChange={(n, v) => set(n, v != null ? v / 100 : null)} isDark={isDark} hint="% do total" suffix="%" />
          </div>
        </div>

        {/* Dados adicionais */}
        <div className={cls.card}>
          <h3 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('aae_additional_data')}</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Funcionários" name="num_employees" value={data.num_employees} onChange={set} isDark={isDark} />
            <Field label="Anos de operação" name="years_in_business" value={data.years_in_business} onChange={set} isDark={isDark} />
            <Field label="Investimento recebido (R$)" name="previous_investment" value={data.previous_investment} onChange={set} isDark={isDark} />
            <Field label="Ativos tangíveis (R$)" name="tangible_assets" value={data.tangible_assets} onChange={set} isDark={isDark} />
            <Field label="Ativos intangíveis (R$)" name="intangible_assets" value={data.intangible_assets} onChange={set} isDark={isDark} />
            <Field label="Participações (R$)" name="equity_participations" value={data.equity_participations} onChange={set} isDark={isDark} />
            <Field label="Burn rate mensal (R$)" name="monthly_burn_rate" value={data.monthly_burn_rate} onChange={set} isDark={isDark} />
            <Field label="Receita NTM (R$)" name="revenue_ntm" value={data.revenue_ntm} onChange={set} isDark={isDark} hint="próximos 12 meses" />
            <Field label="Peso DCF" name="dcf_weight" value={data.dcf_weight} onChange={set} isDark={isDark} hint="0-1, ex: 0.6 = 60% DCF" />
          </div>
        </div>

        {/* Avaliação qualitativa — JSON simplificado */}
        <div className={cls.card}>
          <h3 className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('aae_qualitative')}</h3>
          <p className={`text-xs mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('aae_qualitative_hint')}</p>
          <textarea
            value={data.qualitative_answers ? JSON.stringify(data.qualitative_answers, null, 2) : '{}'}
            onChange={e => { try { set('qualitative_answers', JSON.parse(e.target.value)); } catch {} }}
            rows={8}
            className={`w-full px-4 py-3 border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500 resize-none transition
              ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? t('aae_saving') : t('aae_save_changes')}
        </button>
        <button onClick={handleRegenerate} disabled={regenerating || !data.plan}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
          {regenerating ? t('aae_regenerating') : t('aae_save_regenerate_btn')}
        </button>
      </div>
    </main>
  );
}
