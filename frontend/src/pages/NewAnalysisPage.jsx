import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, ChevronDown, HelpCircle } from 'lucide-react';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

// ─── Currency mask helper ──────────────────────────────────
function formatBRL(value) {
  if (!value && value !== 0) return '';
  const num = typeof value === 'string' ? value.replace(/\D/g, '') : String(value);
  if (!num) return '';
  const cents = parseInt(num, 10);
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(formatted) {
  if (!formatted) return 0;
  return parseFloat(formatted.replace(/\./g, '').replace(',', '.')) || 0;
}

function CurrencyInput({ name, register, label, placeholder, required, isDark, error, setValue }) {
  const [display, setDisplay] = useState('');
  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    const formatted = formatBRL(raw);
    setDisplay(formatted);
    setValue(name, parseBRL(formatted), { shouldValidate: true });
  };
  return (
    <div>
      <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</label>
      <div className="relative">
        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          placeholder={placeholder || '0,00'}
          className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
        />
      </div>
      <input type="hidden" {...register(name, required ? { required: 'Obrigatório', validate: v => v > 0 || 'Valor deve ser maior que zero' } : {})} />
      {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
    </div>
  );
}

// ─── CNPJ mask helper ──────────────────────────────────────
function formatCNPJ(value) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0,2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8)}`;
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
}

const FALLBACK_SECTORS = [
  'tecnologia', 'saude', 'varejo', 'industria', 'servicos',
  'alimentacao', 'educacao', 'construcao', 'agronegocio',
  'financeiro', 'logistica', 'energia', 'imobiliario',
  'consultoria', 'marketing', 'ecommerce', 'outros',
];

const QUALITATIVE_QUESTIONS = [
  { key: 'equipe_sem_fundador', dim: 'Equipe', q: 'A empresa funciona bem sem o fundador no dia a dia?' },
  { key: 'equipe_gestao', dim: 'Equipe', q: 'Existe uma equipe de gestão competente e estruturada?' },
  { key: 'mercado_crescendo', dim: 'Mercado', q: 'O mercado está crescendo de forma consistente?' },
  { key: 'mercado_barreiras', dim: 'Mercado', q: 'Existem barreiras de entrada significativas no seu setor?' },
  { key: 'produto_diferenciacao', dim: 'Produto', q: 'O produto/serviço tem diferenciação relevante vs concorrentes?' },
  { key: 'produto_ip', dim: 'Produto', q: 'A empresa possui propriedade intelectual ou tecnologia proprietária?' },
  { key: 'tracao_clientes', dim: 'Tração', q: 'A base de clientes é diversificada (nenhum cliente > 20% da receita)?' },
  { key: 'tracao_recorrente', dim: 'Tração', q: 'Há um modelo de receita recorrente (assinatura, contratos)?' },
  { key: 'operacao_processos', dim: 'Operação', q: 'Processos operacionais estão documentados e padronizados?' },
  { key: 'operacao_fornecedor', dim: 'Operação', q: 'A empresa não depende de um único fornecedor crítico?' },
];

export default function NewAnalysisPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, setValue } = useForm();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('manual');
  const [projectionYears, setProjectionYears] = useState(5);
  const [showQualitative, setShowQualitative] = useState(false);
  const [qualAnswers, setQualAnswers] = useState({});
  const [sectors, setSectors] = useState([]);
  const [sectorGroups, setSectorGroups] = useState({});
  const { isDark } = useTheme();

  // Fetch sectors from API
  useEffect(() => {
    api.get('/analyses/sectors/list')
      .then(({ data }) => {
        setSectors(data.sectors || []);
        setSectorGroups(data.groups || {});
      })
      .catch(() => setSectors(FALLBACK_SECTORS.map(s => ({ id: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))));
  }, []);

  const onSubmitManual = async (data) => {
    setLoading(true);
    try {
      const payload = {
        company_name: data.company_name,
        sector: data.sector,
        cnpj: data.cnpj || null,
        revenue: typeof data.revenue === 'number' ? data.revenue : parseFloat(data.revenue),
        net_margin: parseFloat(data.net_margin) / 100,
        growth_rate: data.growth_rate ? parseFloat(data.growth_rate) / 100 : null,
        debt: typeof data.debt === 'number' ? data.debt : parseFloat(data.debt || 0),
        cash: typeof data.cash === 'number' ? data.cash : parseFloat(data.cash || 0),
        founder_dependency: parseFloat(data.founder_dependency || 0) / 100,
        projection_years: projectionYears,
        // v3 fields
        ebitda: typeof data.ebitda === 'number' ? data.ebitda : (data.ebitda ? parseFloat(data.ebitda) : null),
        recurring_revenue_pct: data.recurring_revenue_pct ? parseFloat(data.recurring_revenue_pct) / 100 : 0,
        num_employees: data.num_employees ? parseInt(data.num_employees) : 0,
        years_in_business: data.years_in_business ? parseInt(data.years_in_business) : 3,
        previous_investment: typeof data.previous_investment === 'number' ? data.previous_investment : parseFloat(data.previous_investment || 0),
        qualitative_answers: Object.keys(qualAnswers).length > 0 ? qualAnswers : null,
        dcf_weight: data.dcf_weight ? parseFloat(data.dcf_weight) / 100 : 0.60,
      };
      const { data: result } = await api.post('/analyses/', payload);
      toast.success('Análise criada com sucesso!');
      navigate(`/analise/${result.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao criar análise.');
    } finally {
      setLoading(false);
    }
  };

  const onUpload = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const file = form.get('file');
    if (!file || !file.name) {
      toast.error('Selecione um arquivo.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_name', form.get('company_name'));
      formData.append('sector', form.get('sector'));
      formData.append('cnpj', form.get('cnpj') || '');
      const { data: result } = await api.post('/analyses/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Análise criada a partir do upload!');
      navigate(`/analise/${result.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao processar upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className={`transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-navy-900'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className={`font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>Nova Análise</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setMode('manual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'manual'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                : isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Inserir manualmente
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'upload'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                : isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Upload DRE / Balanço
          </button>
        </div>

        {mode === 'manual' ? (
          <form onSubmit={handleSubmit(onSubmitManual)} className={`border rounded-2xl p-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-navy-900'}`}>Dados da empresa</h2>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nome da empresa *</label>
                <input
                  {...register('company_name', { required: 'Obrigatório' })}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="Nome da empresa"
                />
                {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name.message}</p>}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Setor *</label>
                <select
                  {...register('sector', { required: 'Obrigatório' })}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                >
                  <option value="">Selecione...</option>
                  {Object.keys(sectorGroups).length > 0
                    ? Object.entries(sectorGroups).map(([group, items]) => (
                        <optgroup key={group} label={group}>
                          {items.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </optgroup>
                      ))
                    : sectors.map((s) => (
                        <option key={s.id || s} value={s.id || s}>{s.label || s}</option>
                      ))
                  }
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>CNPJ (opcional)</label>
                <input
                  {...register('cnpj')}
                  maxLength={18}
                  onChange={(e) => { e.target.value = formatCNPJ(e.target.value); }}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <CurrencyInput name="revenue" register={register} setValue={setValue} label="Receita anual (R$) *" placeholder="1.000.000,00" required isDark={isDark} error={errors.revenue} />

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Margem líquida (%) *</label>
                <input
                  {...register('net_margin', { required: 'Obrigatório' })}
                  type="number"
                  step="0.1"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="15"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Taxa de crescimento (%)</label>
                <input
                  {...register('growth_rate')}
                  type="number"
                  step="0.1"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="10"
                />
              </div>

              <CurrencyInput name="debt" register={register} setValue={setValue} label="Dívida total (R$)" placeholder="0,00" isDark={isDark} error={errors.debt} />
              <CurrencyInput name="cash" register={register} setValue={setValue} label="Caixa (R$)" placeholder="0,00" isDark={isDark} error={errors.cash} />

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Dependência do fundador (0-100%)
                </label>
                <input
                  {...register('founder_dependency')}
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="0"
                />
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>0% = nenhuma dependência, 100% = totalmente dependente</p>
              </div>
            </div>

            {/* v3: Additional fields */}
            <div className="mt-6">
              <button type="button" onClick={() => document.getElementById('v3-fields').classList.toggle('hidden')}
                className={`flex items-center gap-2 text-sm font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
                <ChevronDown className="w-4 h-4" /> Dados adicionais (opcional, melhora a precisão)
              </button>
              <div id="v3-fields" className="hidden mt-4 grid md:grid-cols-2 gap-5">
                <CurrencyInput name="ebitda" register={register} setValue={setValue} label="EBITDA anual (R$)" placeholder="Calcular automaticamente" isDark={isDark} error={errors.ebitda} />
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>% Receita recorrente</label>
                  <input {...register('recurring_revenue_pct')} type="number" min="0" max="100" step="5"
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    placeholder="0" />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>N° de funcionários</label>
                  <input {...register('num_employees')} type="number" min="0"
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    placeholder="0" />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Anos de operação</label>
                  <input {...register('years_in_business')} type="number" min="0"
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    placeholder="3" />
                </div>
                <CurrencyInput name="previous_investment" register={register} setValue={setValue} label="Investimento já recebido (R$)" placeholder="0,00" isDark={isDark} error={errors.previous_investment} />
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Peso DCF vs Múltiplos (%)</label>
                  <input {...register('dcf_weight')} type="number" min="30" max="90" step="5" defaultValue="60"
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`} />
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>60% = DCF 60%, Múltiplos 40%</p>
                </div>
              </div>
            </div>

            {/* Projection Years Toggle */}
            <div className="mt-6">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Horizonte de projeção
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setProjectionYears(5)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition border ${
                    projectionYears === 5
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-lg shadow-emerald-600/25'
                      : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-emerald-500/50' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  5 anos
                </button>
                <button
                  type="button"
                  onClick={() => setProjectionYears(10)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition border ${
                    projectionYears === 10
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-lg shadow-emerald-600/25'
                      : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-emerald-500/50' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  10 anos
                </button>
              </div>
              <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {projectionYears === 5
                  ? 'Recomendado para empresas com histórico curto ou setores voláteis'
                  : 'Recomendado para empresas maduras com receita previsível'}
              </p>
            </div>

            {/* Qualitative Questions */}
            <div className="mt-6">
              <button type="button" onClick={() => setShowQualitative(!showQualitative)}
                className={`flex items-center gap-2 text-sm font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
                <HelpCircle className="w-4 h-4" />
                Avaliação qualitativa (±15% no valor — opcional)
                <ChevronDown className={`w-4 h-4 transition-transform ${showQualitative ? 'rotate-180' : ''}`} />
              </button>
              {showQualitative && (
                <div className={`mt-4 space-y-3 border rounded-xl p-5 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Avalie cada item de 1 (discordo totalmente) a 5 (concordo totalmente)
                  </p>
                  {QUALITATIVE_QUESTIONS.map((q, idx) => (
                    <div key={q.key} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2 ${idx > 0 ? `border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}` : ''}`}>
                      <div className="flex-1">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>{q.dim}</span>
                        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{q.q}</p>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <button key={v} type="button"
                            onClick={() => setQualAnswers(prev => ({ ...prev, [q.key]: v }))}
                            className={`w-9 h-9 rounded-lg text-sm font-semibold transition ${
                              qualAnswers[q.key] === v
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                : isDark ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-300'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/25"
            >
              {loading ? 'Calculando valuation...' : 'Calcular valuation'}
            </button>
          </form>
        ) : (
          <form onSubmit={onUpload} className={`border rounded-2xl p-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-navy-900'}`}>Upload de DRE / Balanço</h2>

            <div className="grid md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nome da empresa *</label>
                <input
                  name="company_name"
                  required
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="Nome da empresa"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Setor *</label>
                <select
                  name="sector"
                  required
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                >
                  <option value="">Selecione...</option>
                  {Object.keys(sectorGroups).length > 0
                    ? Object.entries(sectorGroups).map(([group, items]) => (
                        <optgroup key={group} label={group}>
                          {items.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </optgroup>
                      ))
                    : sectors.map((s) => (
                        <option key={s.id || s} value={s.id || s}>{s.label || s}</option>
                      ))
                  }
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>CNPJ *</label>
                <input
                  name="cnpj"
                  required
                  maxLength={18}
                  onChange={(e) => { e.target.value = formatCNPJ(e.target.value); }}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>

            <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition ${isDark ? 'border-slate-700 hover:border-emerald-500/50' : 'border-slate-200 hover:border-emerald-300'}`}>
              <Upload className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
              <p className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Arraste ou selecione seu arquivo</p>
              <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>PDF ou Excel (DRE, Balanço Patrimonial)</p>
              <input
                type="file"
                name="file"
                accept=".pdf,.xlsx,.xls"
                className={`block mx-auto text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:text-sm ${isDark ? 'text-slate-400 file:bg-emerald-500/20 file:text-emerald-400' : 'text-slate-500 file:bg-emerald-50 file:text-emerald-600 hover:file:bg-emerald-100'}`}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/25"
            >
              {loading ? 'Processando...' : 'Enviar e analisar'}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
