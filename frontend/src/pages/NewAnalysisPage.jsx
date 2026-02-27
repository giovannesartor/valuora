import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, ChevronDown, HelpCircle, FileText, X, Info, MessageSquare, ImagePlus, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import { validateCNPJ } from '../lib/inputMasks';

// ─── Processing Modal ──────────────────────────────────────
const UPLOAD_STEPS = [
  { key: 'sending', label: 'Enviando documentos...' },
  { key: 'extracting', label: 'Analisando documentos com IA...' },
  { key: 'valuation', label: 'Calculando valuation...' },
  { key: 'analysis', label: 'Gerando análise estratégica...' },
  { key: 'done', label: 'Finalizando relatório...' },
];

const MANUAL_STEPS = [
  { key: 'sending', label: 'Enviando dados...' },
  { key: 'valuation', label: 'Calculando valuation...' },
  { key: 'analysis', label: 'Gerando relatório...' },
  { key: 'done', label: 'Finalizando...' },
];

function ProcessingModal({ isOpen, steps, currentStep, error, onRetry, onClose, isDark, progressPercentage, estimatedTimeRemaining }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className={`relative w-full max-w-md rounded-2xl p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          {error ? (
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          ) : currentStep >= steps.length ? (
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          )}
          <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {error ? 'Erro no processamento' : currentStep >= steps.length ? 'Valuation concluído!' : 'Processando valuation...'}
          </h3>
          {!error && currentStep < steps.length && (
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {estimatedTimeRemaining ? `Cerca de ${estimatedTimeRemaining}s restantes` : 'Isso pode levar até 1 minuto'}
            </p>
          )}
        </div>

        {/* Steps with granular progress */}
        {!error && (
          <div className="space-y-3 mb-6">
            {steps.map((step, idx) => {
              const isActive = idx === currentStep;
              const isDone = idx < currentStep;
              const isPending = idx > currentStep;
              const stepProgress = isActive ? progressPercentage : (isDone ? 100 : 0);
              
              return (
                <div key={step.key} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                  isActive ? (isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200') :
                  isDone ? (isDark ? 'bg-slate-800/50' : 'bg-slate-50') : ''
                }`}>
                  <div className="shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                    ) : (
                      <div className={`w-5 h-5 rounded-full border-2 ${isDark ? 'border-slate-600' : 'border-slate-300'}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium transition-colors ${
                        isDone ? (isDark ? 'text-slate-400' : 'text-slate-500') :
                        isActive ? (isDark ? 'text-emerald-400' : 'text-emerald-700') :
                        (isDark ? 'text-slate-500' : 'text-slate-400')
                      }`}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          {progressPercentage}%
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <div className={`h-1.5 rounded-full overflow-hidden mt-2 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Overall progress bar */}
        {!error && currentStep < steps.length && (
          <div className="space-y-2">
            <div className={`flex justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>Progresso geral</span>
              <span>{Math.round((currentStep / steps.length) * 100 + (progressPercentage / steps.length))}%</span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${(currentStep / steps.length) * 100 + (progressPercentage / steps.length)}%` }}
              />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 text-sm ${isDark ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {error}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Fechar
              </button>
              <button
                onClick={onRetry}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 transition"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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

// ─── CNPJ → Receita Federal lookup (BrasilAPI) ────────────
const CNAE_TO_SECTOR = {
  '47': 'varejo', '46': 'varejo', '45': 'varejo',
  '62': 'tecnologia', '63': 'tecnologia', '61': 'tecnologia',
  '86': 'saude', '87': 'saude', '88': 'saude',
  '85': 'educacao', '80': 'educacao',
  '41': 'construcao', '42': 'construcao', '43': 'construcao',
  '01': 'agronegocio', '02': 'agronegocio', '03': 'agronegocio',
  '10': 'alimentacao', '11': 'alimentacao', '56': 'alimentacao',
  '64': 'financeiro', '65': 'financeiro', '66': 'financeiro',
  '49': 'logistica', '50': 'logistica', '51': 'logistica', '52': 'logistica',
  '35': 'energia', '36': 'energia',
  '68': 'imobiliario',
  '73': 'marketing', '74': 'consultoria',
};
function cnaeToSector(cnae) {
  if (!cnae) return '';
  const code = String(cnae).slice(0, 2);
  return CNAE_TO_SECTOR[code] || 'outros';
}

async function lookupCNPJ(rawCnpj) {
  const digits = rawCnpj.replace(/\D/g, '');
  if (digits.length !== 14) return null;
  try {
    const { data } = await api.get(`/cnpj/${digits}`);
    return {
      company_name: data.razao_social || data.nome_fantasia || '',
      sector: cnaeToSector(data.cnae_codigo),
      years_in_business: data.tempo_empresa_anos ?? null,
    };
  } catch { return null; }
}

const FALLBACK_SECTORS = [
  'tecnologia', 'saude', 'varejo', 'industria', 'servicos',
  'alimentacao', 'educacao', 'construcao', 'agronegocio',
  'financeiro', 'logistica', 'energia', 'imobiliario',
  'consultoria', 'marketing', 'ecommerce', 'outros',
];

const QUALITATIVE_QUESTIONS = [
  { key: 'gov_profissional', dim: 'Governança', q: 'A gestão da empresa é profissionalizada e não depende exclusivamente do fundador/sócio?' },
  { key: 'gov_compliance', dim: 'Governança', q: 'A empresa possui processos decisórios claros, controles internos e compliance?' },
  { key: 'mercado_lider', dim: 'Mercado', q: 'A empresa é líder ou ocupa posição relevante no seu segmento de atuação?' },
  { key: 'mercado_tendencia', dim: 'Mercado', q: 'O setor de atuação apresenta tendência de crescimento para os próximos anos?' },
  { key: 'financeiro_crescimento', dim: 'Financeiro', q: 'O faturamento da empresa tem crescido de forma consistente nos últimos 3 anos?' },
  { key: 'financeiro_margens', dim: 'Financeiro', q: 'As margens (bruta e líquida) da empresa estão acima da média do setor?' },
  { key: 'clientes_diversificacao', dim: 'Clientes', q: 'A receita é diversificada — nenhum cliente representa mais de 25% do faturamento?' },
  { key: 'clientes_recorrencia', dim: 'Clientes', q: 'A empresa possui receita recorrente ou contratos de longo prazo?' },
  { key: 'diferenciacao_moat', dim: 'Diferenciação', q: 'A empresa possui marca forte, patentes, tecnologia própria ou outro diferencial difícil de replicar?' },
  { key: 'escala_operacional', dim: 'Escalabilidade', q: 'A operação é escalável — crescer receita não exige aumento proporcional de custos?' },
];

const QUAL_OPTIONS = [
  { value: 1, label: 'Não', color: 'red' },
  { value: 3, label: 'Parcialmente', color: 'yellow' },
  { value: 5, label: 'Sim', color: 'green' },
];

export default function NewAnalysisPage() {
  usePageTitle('Nova Análise');
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, setValue, getValues, reset } = useForm();
  const [loading, setLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [mode, setMode] = useState('manual');
  const [projectionYears, setProjectionYears] = useState(5);
  const [showV3Fields, setShowV3Fields] = useState(false);
  const [qualAnswers, setQualAnswers] = useState({});
  const [qualObservations, setQualObservations] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [sectorGroups, setSectorGroups] = useState({});
  const [cnpjLookingUp, setCnpjLookingUp] = useState(false);
  const [cnpjFilled, setCnpjFilled] = useState(false);
  const [cnpjLookingUpUpload, setCnpjLookingUpUpload] = useState(false);
  const [cnpjFilledUpload, setCnpjFilledUpload] = useState(false);
  const uploadCompanyNameRef = useRef(null);
  const uploadSectorRef = useRef(null);
  const { isDark } = useTheme();

  // Processing modal state
  const [processingOpen, setProcessingOpen] = useState(false);
  const [processingSteps, setProcessingSteps] = useState(MANUAL_STEPS);
  const [processingStep, setProcessingStep] = useState(0);
  const [processingError, setProcessingError] = useState(null);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);
  const stepTimerRef = useRef(null);
  const retryFnRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const startTimeRef = useRef(null);

  const startProcessing = (steps, timings) => {
    setProcessingSteps(steps);
    setProcessingStep(0);
    setProcessingError(null);
    setProgressPercentage(0);
    setEstimatedTimeRemaining(0);
    setProcessingOpen(true);
    
    // Calculate total estimated time
    const totalTime = timings.reduce((acc, t) => acc + t, 0);
    startTimeRef.current = Date.now();
    
    // Automatically advance steps with granular progress
    let idx = 0;
    let stepProgress = 0;
    
    const advance = () => {
      if (idx < timings.length) {
        const stepDuration = timings[idx];
        
        // Update progress within current step
        progressIntervalRef.current = setInterval(() => {
          stepProgress += 2; // Update every 2%
          if (stepProgress > 100) stepProgress = 100;
          setProgressPercentage(stepProgress);
          
          // Calculate estimated time remaining
          const elapsed = Date.now() - startTimeRef.current;
          const remaining = totalTime - elapsed;
          setEstimatedTimeRemaining(Math.max(0, Math.ceil(remaining / 1000)));
        }, stepDuration / 50); // 50 updates per step
        
        stepTimerRef.current = setTimeout(() => {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          idx++;
          setProcessingStep(prev => Math.min(prev + 1, steps.length - 1));
          stepProgress = 0;
          advance();
        }, stepDuration);
      }
    };
    advance();
  };

  const stopProcessing = () => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  const completeProcessing = (analysisId) => {
    stopProcessing();
    localStorage.removeItem('qv_draft_analysis');
    setProcessingStep(99); // past last = done state
    setTimeout(() => {
      setProcessingOpen(false);
      navigate(`/analise/${analysisId}`);
    }, 1200);
  };

  const failProcessing = (message) => {
    stopProcessing();
    setProcessingError(message);
  };

  // Auto-save draft on mount + restore
  useEffect(() => {
    const saved = localStorage.getItem('qv_draft_analysis');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed._form) reset(parsed._form);
        if (parsed._mode) setMode(parsed._mode);
        if (parsed._projectionYears) setProjectionYears(parsed._projectionYears);
        if (parsed._qualAnswers) setQualAnswers(parsed._qualAnswers);
        if (parsed._qualObservations) setQualObservations(parsed._qualObservations);
        toast('Rascunho restaurado automaticamente', { icon: '📝' });
      } catch { localStorage.removeItem('qv_draft_analysis'); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const formValues = getValues();
      const hasData = Object.values(formValues).some(v => v !== null && v !== undefined && v !== '')
        || Object.keys(qualAnswers).length > 0;
      if (hasData) {
        const draft = {
          _form: formValues,
          _mode: mode,
          _projectionYears: projectionYears,
          _qualAnswers: qualAnswers,
          _qualObservations: qualObservations,
        };
        localStorage.setItem('qv_draft_analysis', JSON.stringify(draft));
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 3000);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [getValues, mode, projectionYears, qualAnswers, qualObservations]);

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
    startProcessing(MANUAL_STEPS, [2000, 5000, 8000]);
    const doSubmit = async () => {
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
          qualitative_answers: Object.keys(qualAnswers).length > 0
            ? Object.fromEntries(Object.entries(qualAnswers).map(([k, v]) => [
                k, { score: v, ...(qualObservations[k] ? { obs: qualObservations[k] } : {}) }
              ]))
            : null,
          dcf_weight: data.dcf_weight ? parseFloat(data.dcf_weight) / 100 : 0.60,
        };
        const { data: result } = await api.post('/analyses/', payload, { timeout: 120000 });
        // Upload logo if provided
        if (logoFile && result.id) {
          const logoData = new FormData();
          logoData.append('logo', logoFile);
          try {
            await api.post(`/analyses/${result.id}/logo`, logoData, { headers: { 'Content-Type': 'multipart/form-data' } });
          } catch { /* logo upload is best-effort */ }
        }
        completeProcessing(result.id);
      } catch (err) {
        const msg = err.code === 'ECONNABORTED' || err.message?.includes('timeout')
          ? 'A requisição demorou mais que o esperado. Tente novamente.'
          : err.response?.data?.detail || 'Erro ao criar análise. Tente novamente.';
        failProcessing(msg);
      } finally {
        setLoading(false);
      }
    };
    retryFnRef.current = () => {
      setLoading(true);
      startProcessing(MANUAL_STEPS, [2000, 5000, 8000]);
      doSubmit();
    };
    doSubmit();
  };

  const [uploadFiles, setUploadFiles] = useState([]);

  const onUpload = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    if (uploadFiles.length === 0) {
      toast.error('Selecione pelo menos um arquivo.');
      return;
    }
    setLoading(true);
    startProcessing(UPLOAD_STEPS, [3000, 10000, 15000, 10000]);
    const doUpload = async () => {
      try {
        const formData = new FormData();
        uploadFiles.forEach(f => formData.append('files', f));
        formData.append('company_name', form.get('company_name'));
        formData.append('sector', form.get('sector'));
        formData.append('cnpj', form.get('cnpj') || '');
        formData.append('founder_dependency', form.get('founder_dependency') || '0');
        formData.append('projection_years', String(projectionYears));
        if (Object.keys(qualAnswers).length > 0) {
          const nested = Object.fromEntries(Object.entries(qualAnswers).map(([k, v]) => [
            k, { score: v, ...(qualObservations[k] ? { obs: qualObservations[k] } : {}) }
          ]));
          formData.append('qualitative_answers', JSON.stringify(nested));
        }
        if (logoFile) {
          formData.append('logo', logoFile);
        }
        const { data: result } = await api.post('/analyses/upload', formData, {
          timeout: 120000,
        });
        completeProcessing(result.id);
      } catch (err) {
        const msg = err.code === 'ECONNABORTED' || err.message?.includes('timeout')
          ? 'A requisição demorou mais que o esperado. O servidor pode estar processando. Tente novamente em alguns instantes.'
          : err.message?.includes('Network Error') || err.message?.includes('CORS')
          ? 'Erro de conexão com o servidor. Tente novamente em alguns instantes.'
          : err.response?.data?.detail || 'Erro ao processar upload. Tente novamente.';
        failProcessing(msg);
      } finally {
        setLoading(false);
      }
    };
    retryFnRef.current = () => {
      setLoading(true);
      startProcessing(UPLOAD_STEPS, [3000, 10000, 15000, 10000]);
      doUpload();
    };
    doUpload();
  };

  return (
    <>
      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className={`transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Nova Análise</h1>
          </div>
          {draftSaved && (
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Salvo automaticamente
            </span>
          )}
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
            <h2 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Dados da empresa</h2>

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
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  CNPJ (opcional)
                  {cnpjLookingUp && <span className="ml-2 text-xs text-emerald-500 animate-pulse">Consultando Receita Federal...</span>}
                  {cnpjFilled && !cnpjLookingUp && <span className="ml-2 text-xs text-emerald-500">✓ Dados preenchidos automaticamente</span>}
                </label>
                <input
                  {...register('cnpj')}
                  maxLength={18}
                  onChange={async (e) => {
                    const formatted = formatCNPJ(e.target.value);
                    e.target.value = formatted;
                    const digits = formatted.replace(/\D/g, '');
                    if (digits.length === 14) {
                      if (!validateCNPJ(digits)) {
                        setCnpjError('CNPJ inválido. Verifique os dígitos informados.');
                        setCnpjFilled(false);
                        return;
                      }
                      setCnpjError(null);
                      setCnpjLookingUp(true);
                      setCnpjFilled(false);
                      const info = await lookupCNPJ(digits);
                      setCnpjLookingUp(false);
                      if (info) {
                        if (info.company_name) setValue('company_name', info.company_name);
                        if (info.sector) setValue('sector', info.sector);
                        if (info.years_in_business) setValue('years_in_business', String(info.years_in_business));
                        setCnpjFilled(true);
                      }
                    } else {
                      setCnpjError(null);
                      setCnpjFilled(false);
                    }
                  }}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${cnpjError ? 'border-red-400 dark:border-red-500' : isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'} ${isDark ? 'bg-slate-800 text-white placeholder-slate-500' : 'bg-white text-slate-900 placeholder-slate-400'}`}
                  placeholder="00.000.000/0001-00"
                />
                {cnpjError && <p className="mt-1 text-xs text-red-500">{cnpjError}</p>}
              </div>

              {/* Logo Upload */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Logo da empresa (opcional)</label>
                <div className="relative">
                  {logoPreview ? (
                    <div className={`flex items-center gap-3 px-4 py-3 border rounded-xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <img src={logoPreview} alt="Logo" className="w-10 h-10 rounded-lg object-contain" loading="lazy" />
                      <span className={`text-sm truncate flex-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{logoFile?.name}</span>
                      <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                        className={`p-1 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition ${isDark ? 'bg-slate-800 border-slate-700 hover:border-emerald-500/50 text-slate-500' : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-400'}`}>
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-sm">Clique para enviar a logo</span>
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (f.size > 2 * 1024 * 1024) { toast.error('Logo deve ter no máximo 2MB'); return; }
                            setLogoFile(f);
                            setLogoPreview(URL.createObjectURL(f));
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
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
              <button type="button" onClick={() => setShowV3Fields(!showV3Fields)}
                className={`flex items-center gap-2 text-sm font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
                <ChevronDown className={`w-4 h-4 transition-transform ${showV3Fields ? 'rotate-180' : ''}`} /> Dados adicionais (opcional, melhora a precisão)
              </button>
              {showV3Fields && (
              <div className="mt-4 grid md:grid-cols-2 gap-5">
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
              )}
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

            {/* Qualitative Assessment — MANDATORY */}
            <div className={`mt-8 border rounded-2xl p-6 ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Avaliação Qualitativa</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>±15% no valor</span>
              </div>
              <p className={`text-xs mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Responda cada pergunta para refinar a precisão do valuation. O campo de observação é opcional.
              </p>

              <div className="space-y-4">
                {QUALITATIVE_QUESTIONS.map((q, idx) => (
                  <div key={q.key} className={`pb-4 ${idx < QUALITATIVE_QUESTIONS.length - 1 ? `border-b ${isDark ? 'border-slate-700/60' : 'border-slate-200'}` : ''}`}>
                    <div className="flex items-start gap-2 mb-2.5">
                      <span className={`text-xs font-semibold uppercase tracking-wide mt-0.5 shrink-0 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>{q.dim}</span>
                      <p className={`text-sm leading-snug ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{q.q}</p>
                    </div>
                    <div className="flex gap-2 mb-2">
                      {QUAL_OPTIONS.map((opt) => {
                        const selected = qualAnswers[q.key] === opt.value;
                        const colorMap = {
                          red: selected
                            ? 'bg-red-500/90 text-white border-red-500 shadow-lg shadow-red-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-red-400 hover:text-red-400' : 'border-slate-300 text-slate-500 hover:border-red-400 hover:text-red-500',
                          yellow: selected
                            ? 'bg-amber-500/90 text-white border-amber-500 shadow-lg shadow-amber-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-amber-400 hover:text-amber-400' : 'border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-500',
                          green: selected
                            ? 'bg-emerald-500/90 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-emerald-400 hover:text-emerald-400' : 'border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-500',
                        };
                        return (
                          <button key={opt.value} type="button"
                            onClick={() => setQualAnswers(prev => ({ ...prev, [q.key]: opt.value }))}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${colorMap[opt.color]}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Optional observation */}
                    <div className="relative">
                      <MessageSquare className={`absolute left-3 top-2.5 w-3.5 h-3.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                      <input type="text"
                        placeholder="Observação (opcional)"
                        value={qualObservations[q.key] || ''}
                        onChange={(e) => setQualObservations(prev => ({ ...prev, [q.key]: e.target.value }))}
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-lg border transition ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 placeholder-slate-600 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-600 placeholder-slate-400 focus:border-emerald-400'}`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress indicator */}
              <div className={`mt-4 flex items-center gap-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <span>{Object.keys(qualAnswers).length}/{QUALITATIVE_QUESTIONS.length} respondidas</span>
                <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(Object.keys(qualAnswers).length / QUALITATIVE_QUESTIONS.length) * 100}%` }} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || Object.keys(qualAnswers).length < QUALITATIVE_QUESTIONS.length}
              className="mt-8 w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/25"
            >
              {loading ? 'Calculando valuation...' : Object.keys(qualAnswers).length < QUALITATIVE_QUESTIONS.length ? `Responda todas as perguntas (${Object.keys(qualAnswers).length}/${QUALITATIVE_QUESTIONS.length})` : 'Calcular valuation'}
            </button>
          </form>
        ) : (
          <form onSubmit={onUpload} className={`border rounded-2xl p-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Upload de DRE / Balanço</h2>

            {/* Info badge */}
            <div className={`flex items-start gap-3 rounded-xl p-4 mb-6 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-medium mb-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>O que a IA extrai automaticamente</p>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-blue-400/80' : 'text-blue-600'}`}>
                  Receita, margem líquida, taxa de crescimento, dívidas e caixa são extraídos automaticamente dos seus documentos.
                  Campos como dependência do fundador e avaliação qualitativa precisam ser preenchidos manualmente abaixo.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nome da empresa *</label>
                <input
                  ref={uploadCompanyNameRef}
                  name="company_name"
                  required
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="Nome da empresa"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Setor *</label>
                <select
                  ref={uploadSectorRef}
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
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  CNPJ *
                  {cnpjLookingUpUpload && <span className="ml-2 text-xs text-emerald-500 animate-pulse">Consultando Receita Federal...</span>}
                  {cnpjFilledUpload && !cnpjLookingUpUpload && <span className="ml-2 text-xs text-emerald-500">✓ Dados preenchidos automaticamente</span>}
                </label>
                <input
                  name="cnpj"
                  required
                  maxLength={18}
                  onChange={async (e) => {
                    e.target.value = formatCNPJ(e.target.value);
                    const digits = e.target.value.replace(/\D/g, '');
                    if (digits.length === 14) {
                      setCnpjLookingUpUpload(true);
                      setCnpjFilledUpload(false);
                      const info = await lookupCNPJ(digits);
                      setCnpjLookingUpUpload(false);
                      if (info) {
                        if (info.company_name && uploadCompanyNameRef.current) uploadCompanyNameRef.current.value = info.company_name;
                        if (info.sector && uploadSectorRef.current) uploadSectorRef.current.value = info.sector;
                        setCnpjFilledUpload(true);
                      }
                    } else {
                      setCnpjFilledUpload(false);
                    }
                  }}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>

            {/* Logo Upload */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Logo da empresa (opcional)</label>
              {logoPreview ? (
                <div className={`flex items-center gap-3 px-4 py-3 border rounded-xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <img src={logoPreview} alt="Logo" className="w-10 h-10 rounded-lg object-contain" loading="lazy" />
                  <span className={`text-sm truncate flex-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{logoFile?.name}</span>
                  <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                    className={`p-1 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className={`flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition ${isDark ? 'bg-slate-800 border-slate-700 hover:border-emerald-500/50 text-slate-500' : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-400'}`}>
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-sm">Clique para enviar a logo</span>
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 2 * 1024 * 1024) { toast.error('Logo deve ter no máximo 2MB'); return; }
                        setLogoFile(f);
                        setLogoPreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                </label>
              )}
            </div>

            {/* File Upload */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Documentos financeiros *</label>
              <div className={`flex items-start gap-2 rounded-lg px-3 py-2 mb-3 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <p className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  Para melhor resultado e projeção, anexe os <strong>últimos 3 DREs</strong> e <strong>últimos 3 Balanços Patrimoniais</strong>.
                  Mínimo: 1 DRE + 1 Balanço.
                </p>
              </div>
              <div
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition ${isDark ? 'border-slate-700 hover:border-emerald-500/50' : 'border-slate-200 hover:border-emerald-300'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedFiles = Array.from(e.dataTransfer.files).filter(f => /\.(pdf|xlsx|xls)$/i.test(f.name));
                  if (droppedFiles.length > 0) setUploadFiles(prev => [...prev, ...droppedFiles].slice(0, 6));
                }}
              >
                <Upload className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                <p className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Arraste ou selecione seus arquivos</p>
                <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>PDF ou Excel — até 6 arquivos (DRE + Balanço)</p>
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls"
                  multiple
                  onChange={(e) => {
                    const newFiles = Array.from(e.target.files || []);
                    setUploadFiles(prev => [...prev, ...newFiles].slice(0, 6));
                    e.target.value = '';
                  }}
                  className={`block mx-auto text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:text-sm ${isDark ? 'text-slate-400 file:bg-emerald-500/20 file:text-emerald-400' : 'text-slate-500 file:bg-emerald-50 file:text-emerald-600 hover:file:bg-emerald-100'}`}
                />
              </div>
              {/* File list */}
              {uploadFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadFiles.map((f, i) => (
                    <div key={`${f.name}-${f.size}-${i}`} className={`flex items-center justify-between px-4 py-2.5 rounded-xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className={`text-sm truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{f.name}</span>
                        <span className={`text-xs shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setUploadFiles(prev => prev.filter((_, idx) => idx !== i)); }}
                        className="text-red-400 hover:text-red-500 transition p-2 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Founder Dependency */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Dependência do fundador (0-100%)
              </label>
              <input
                name="founder_dependency"
                type="number"
                min="0"
                max="100"
                step="5"
                defaultValue="0"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="0"
              />
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>0% = nenhuma dependência, 100% = totalmente dependente</p>
            </div>

            {/* Projection Years Toggle */}
            <div className="mb-6">
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

            {/* Qualitative Assessment — MANDATORY */}
            <div className={`mb-6 border rounded-2xl p-6 ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Avaliação Qualitativa</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>±15% no valor</span>
              </div>
              <p className={`text-xs mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Responda cada pergunta para refinar a precisão do valuation. O campo de observação é opcional.
              </p>

              <div className="space-y-4">
                {QUALITATIVE_QUESTIONS.map((q, idx) => (
                  <div key={q.key} className={`pb-4 ${idx < QUALITATIVE_QUESTIONS.length - 1 ? `border-b ${isDark ? 'border-slate-700/60' : 'border-slate-200'}` : ''}`}>
                    <div className="flex items-start gap-2 mb-2.5">
                      <span className={`text-xs font-semibold uppercase tracking-wide mt-0.5 shrink-0 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>{q.dim}</span>
                      <p className={`text-sm leading-snug ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{q.q}</p>
                    </div>
                    <div className="flex gap-2 mb-2">
                      {QUAL_OPTIONS.map((opt) => {
                        const selected = qualAnswers[q.key] === opt.value;
                        const colorMap = {
                          red: selected
                            ? 'bg-red-500/90 text-white border-red-500 shadow-lg shadow-red-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-red-400 hover:text-red-400' : 'border-slate-300 text-slate-500 hover:border-red-400 hover:text-red-500',
                          yellow: selected
                            ? 'bg-amber-500/90 text-white border-amber-500 shadow-lg shadow-amber-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-amber-400 hover:text-amber-400' : 'border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-500',
                          green: selected
                            ? 'bg-emerald-500/90 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-emerald-400 hover:text-emerald-400' : 'border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-500',
                        };
                        return (
                          <button key={opt.value} type="button"
                            onClick={() => setQualAnswers(prev => ({ ...prev, [q.key]: opt.value }))}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${colorMap[opt.color]}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Optional observation */}
                    <div className="relative">
                      <MessageSquare className={`absolute left-3 top-2.5 w-3.5 h-3.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                      <input type="text"
                        placeholder="Observação (opcional)"
                        value={qualObservations[q.key] || ''}
                        onChange={(e) => setQualObservations(prev => ({ ...prev, [q.key]: e.target.value }))}
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-lg border transition ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 placeholder-slate-600 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-600 placeholder-slate-400 focus:border-emerald-400'}`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress indicator */}
              <div className={`mt-4 flex items-center gap-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <span>{Object.keys(qualAnswers).length}/{QUALITATIVE_QUESTIONS.length} respondidas</span>
                <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(Object.keys(qualAnswers).length / QUALITATIVE_QUESTIONS.length) * 100}%` }} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || uploadFiles.length === 0 || Object.keys(qualAnswers).length < QUALITATIVE_QUESTIONS.length}
              className="mt-2 w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/25"
            >
              {loading ? 'Processando...' : `Enviar ${uploadFiles.length > 0 ? `(${uploadFiles.length} arquivo${uploadFiles.length > 1 ? 's' : ''})` : ''} e analisar`}
            </button>
          </form>
        )}
      </main>

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={processingOpen}
        steps={processingSteps}
        currentStep={processingStep}
        error={processingError}
        isDark={isDark}
        progressPercentage={progressPercentage}
        estimatedTimeRemaining={estimatedTimeRemaining}
        onRetry={() => retryFnRef.current?.()}
        onClose={() => { setProcessingOpen(false); setProcessingError(null); }}
      />
    </>
  );
}
