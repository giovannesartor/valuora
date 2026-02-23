import { useState } from 'react';
import { X, ArrowRight, CheckCircle, Loader2, BarChart3, Copy, Check, Gift } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';

const SETORES = [
  'Tecnologia', 'SaaS', 'E-commerce', 'Fintech', 'Saúde',
  'Serviços', 'Varejo', 'Indústria', 'Logística', 'Educação',
  'Alimentação', 'Construção', 'Agronegócio', 'Outro',
];

const FAIXAS_RECEITA = [
  { value: 'ate_100k', label: 'Até R$ 100 mil' },
  { value: '100k_500k', label: 'R$ 100 mil – R$ 500 mil' },
  { value: '500k_2m', label: 'R$ 500 mil – R$ 2 milhões' },
  { value: '2m_10m', label: 'R$ 2 milhões – R$ 10 milhões' },
  { value: 'acima_10m', label: 'Acima de R$ 10 milhões' },
];

export default function DiagnosticoModal({ isOpen, onClose }) {
  const { isDark } = useTheme();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    email: '',
    nome: '',
    setor: '',
    receita_anual: '',
    margem_lucro: '',
    tempo_empresa: '',
  });

  const totalSteps = 3;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    if (step === 1) return form.setor && form.receita_anual;
    if (step === 2) return form.margem_lucro !== '' && form.tempo_empresa !== '';
    if (step === 3) return form.email;
    return false;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        email: form.email,
        nome: form.nome || undefined,
        setor: form.setor,
        receita_anual: form.receita_anual,
        margem_lucro: parseFloat(form.margem_lucro),
        tempo_empresa: parseInt(form.tempo_empresa),
      };
      const { data } = await api.post('/diagnostico/', payload);
      setResult(data);
    } catch (err) {
      console.error('Diagnostico error:', err);
      alert('Erro ao processar diagnóstico. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText('PRIMEIRA');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setStep(1);
    setResult(null);
    setForm({ email: '', nome: '', setor: '', receita_anual: '', margem_lucro: '', tempo_empresa: '' });
    onClose();
  };

  if (!isOpen) return null;

  const inputClass = `w-full rounded-xl px-4 py-3 text-sm border transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
  }`;

  const labelClass = `block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`;

  // ─── Score color logic ──────────────────────────────
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getScoreGradient = (score) => {
    if (score >= 80) return 'from-emerald-500 to-cyan-500';
    if (score >= 60) return 'from-blue-500 to-cyan-500';
    if (score >= 40) return 'from-yellow-500 to-orange-400';
    return 'from-orange-500 to-red-500';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Close */}
        <button
          onClick={handleClose}
          className={`absolute top-4 right-4 z-10 p-1 rounded-lg transition ${isDark ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* ─── Result view ───────────────────────────── */}
        {result ? (
          <div>
            <div className={`bg-gradient-to-r ${getScoreGradient(result.score)} px-8 py-8 text-center rounded-t-2xl`}>
              <BarChart3 className="w-8 h-8 text-white/80 mx-auto mb-3" />
              <div className="text-5xl font-extrabold text-white mb-1">{Math.round(result.score)}/100</div>
              <div className="text-white/90 font-semibold text-lg">{result.score_label}</div>
            </div>
            <div className="px-8 py-6">
              <p className={`text-center text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {result.mensagem}
              </p>

              {/* Recomendações */}
              <div className="space-y-3 mb-6">
                <h4 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Recomendações:</h4>
                {result.recomendacoes.map((rec, i) => (
                  <div key={i} className={`flex items-start gap-2.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>

              {/* Coupon */}
              <div className={`flex items-center justify-between rounded-xl border-2 border-dashed px-5 py-4 mb-5 ${isDark ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-yellow-400 bg-yellow-50'}`}>
                <div>
                  <p className={`text-xs mb-0.5 ${isDark ? 'text-yellow-400/80' : 'text-yellow-700'}`}>
                    <Gift className="w-3.5 h-3.5 inline mr-1" />
                    10% de desconto:
                  </p>
                  <span className={`text-xl font-extrabold tracking-widest ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>PRIMEIRA</span>
                </div>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    copied
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : isDark
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>

              <a
                href="/cadastro"
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:from-blue-500 hover:to-cyan-500 transition shadow-lg shadow-blue-600/25"
              >
                Iniciar Valuation Completo
                <ArrowRight className="w-4 h-4" />
              </a>

              <p className={`text-center text-xs mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                O resultado detalhado também foi enviado para seu e-mail.
              </p>
            </div>
          </div>
        ) : (
          /* ─── Form view ──────────────────────────────── */
          <div>
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-t-2xl px-8 py-6 text-center">
              <BarChart3 className="w-7 h-7 text-white/80 mx-auto mb-2" />
              <h3 className="text-white text-lg font-bold">Diagnóstico Gratuito</h3>
              <p className="text-blue-100 text-sm">Descubra o nível de prontidão da sua empresa para valuation</p>
            </div>

            {/* Progress bar */}
            <div className="px-8 pt-5">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Passo {step} de {totalSteps}</span>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-300"
                  style={{ width: `${(step / totalSteps) * 100}%` }}
                />
              </div>
            </div>

            <div className="px-8 py-6">
              {/* Step 1: Setor + Receita */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Setor da empresa *</label>
                    <select
                      value={form.setor}
                      onChange={(e) => handleChange('setor', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Selecione o setor</option>
                      {SETORES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Faixa de receita anual *</label>
                    <div className="space-y-2">
                      {FAIXAS_RECEITA.map((f) => (
                        <button
                          key={f.value}
                          onClick={() => handleChange('receita_anual', f.value)}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${
                            form.receita_anual === f.value
                              ? 'border-blue-500 bg-blue-500/10 text-blue-500 font-medium'
                              : isDark
                                ? 'border-slate-700 text-slate-300 hover:border-slate-600'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Margem + Tempo */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Margem de lucro líquido (%) *</label>
                    <input
                      type="number"
                      value={form.margem_lucro}
                      onChange={(e) => handleChange('margem_lucro', e.target.value)}
                      placeholder="Ex: 15"
                      min="0"
                      max="100"
                      step="0.1"
                      className={inputClass}
                    />
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      Lucro líquido ÷ receita × 100
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Tempo de empresa (anos) *</label>
                    <input
                      type="number"
                      value={form.tempo_empresa}
                      onChange={(e) => handleChange('tempo_empresa', e.target.value)}
                      placeholder="Ex: 5"
                      min="0"
                      max="100"
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Email + Nome */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Seu e-mail *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="seu@email.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Seu nome (opcional)</label>
                    <input
                      type="text"
                      value={form.nome}
                      onChange={(e) => handleChange('nome', e.target.value)}
                      placeholder="Como prefere ser chamado"
                      className={inputClass}
                    />
                  </div>
                  <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    Enviaremos o resultado detalhado + um cupom de desconto exclusivo.
                  </p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center gap-3 mt-6">
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className={`px-5 py-3 rounded-xl text-sm font-medium transition ${
                      isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Voltar
                  </button>
                )}
                {step < totalSteps ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    disabled={!canProceed()}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition ${
                      canProceed()
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-600/25'
                        : isDark
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Próximo
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!canProceed() || loading}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition ${
                      canProceed() && !loading
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-600/25'
                        : isDark
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        Ver Resultado
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
