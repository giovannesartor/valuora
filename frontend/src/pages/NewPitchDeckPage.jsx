import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Save, Sparkles, Loader2, Plus, Trash2,
  Building2, AlertTriangle, Lightbulb, Target, Users, BarChart3,
  DollarSign, MessageSquare, Megaphone, Clock, Briefcase, FileText,
  Linkedin, Camera, UserRound, Palette, Database,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import api from '../lib/api';
import toast from 'react-hot-toast';

const STEPS = [
  { key: 'company', label: 'Empresa', icon: Building2 },
  { key: 'problem', label: 'Problema', icon: AlertTriangle },
  { key: 'solution', label: 'Solução', icon: Lightbulb },
  { key: 'market', label: 'Mercado', icon: Target },
  { key: 'competition', label: 'Concorrência', icon: Users },
  { key: 'business', label: 'Modelo', icon: BarChart3 },
  { key: 'financials', label: 'Financeiro', icon: DollarSign },
  { key: 'team', label: 'Equipe', icon: Briefcase },
  { key: 'roadmap', label: 'Roadmap', icon: Clock },
  { key: 'funding', label: 'Capital', icon: MessageSquare },
];

export default function NewPitchDeckPage() {
  usePageTitle('Novo Pitch Deck');
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const analysisId = searchParams.get('analysis');

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState({});
  const [deckId, setDeckId] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const editId = searchParams.get('edit');

  const [form, setForm] = useState({
    company_name: '',
    sector: '',
    slogan: '',
    headline: '',
    website: '',
    contact_email: '',
    contact_phone: '',
    problem: '',
    solution: '',
    target_market: { description: '', tam: '', sam: '', som: '', segments: [] },
    competitive_landscape: [{ competitor: '', advantage: '' }],
    business_model: '',
    sales_channels: '',
    marketing_activities: '',
    financial_projections: [{ year: new Date().getFullYear() + 1, revenue: 0, expenses: 0, profit: 0 }],
    team: [{ name: '', role: '', bio: '', linkedin: '', photo_url: '' }],
    milestones: [{ title: '', date: '', description: '', status: 'upcoming' }],
    funding_needs: { amount: 0, description: '', breakdown: [{ label: '', value: 0 }] },
    partners_resources: [{ name: '' }],
    analysis_id: analysisId || null,
    investor_type: 'geral',
    theme: 'corporate',
  });

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  // Load existing pitch deck when editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const res = await api.get(`/pitch-deck/${editId}`);
        const d = res.data;
        setDeckId(editId);
        setForm(p => ({
          ...p,
          company_name: d.company_name || p.company_name,
          sector: d.sector || p.sector,
          slogan: d.slogan || p.slogan,
          headline: d.headline || p.headline,
          website: d.website || p.website,
          contact_email: d.contact_email || p.contact_email,
          contact_phone: d.contact_phone || p.contact_phone,
          problem: d.problem || p.problem,
          solution: d.solution || p.solution,
          target_market: d.target_market || p.target_market,
          competitive_landscape: d.competitive_landscape?.length ? d.competitive_landscape : p.competitive_landscape,
          business_model: d.business_model || p.business_model,
          sales_channels: d.sales_channels || p.sales_channels,
          marketing_activities: d.marketing_activities || p.marketing_activities,
          financial_projections: d.financial_projections?.length ? d.financial_projections : p.financial_projections,
          team: d.team?.length ? d.team : p.team,
          milestones: d.milestones?.length ? d.milestones : p.milestones,
          funding_needs: d.funding_needs || p.funding_needs,
          partners_resources: d.partners_resources?.length ? d.partners_resources : p.partners_resources,
          analysis_id: d.analysis_id || p.analysis_id,
          investor_type: d.investor_type || p.investor_type,
          theme: d.theme || p.theme,
        }));
        toast.success('Pitch deck carregado para edição!', { icon: '✏️' });
      } catch {
        toast.error('Não foi possível carregar o pitch deck.');
        navigate('/pitch-deck');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // Restore localStorage draft on mount (new decks only)
  useEffect(() => {
    if (editId || analysisId) return;
    const saved = localStorage.getItem('qv_pitchdeck_draft');
    if (!saved) return;
    try {
      const { formData, savedDeckId, savedAt } = JSON.parse(saved);
      if (Date.now() - savedAt < 7 * 24 * 3600 * 1000) {
        setForm(formData);
        if (savedDeckId) setDeckId(savedDeckId);
        setDraftRestored(true);
        toast.success('Rascunho anterior restaurado!', { icon: '💾' });
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist form to localStorage on every change (new decks only)
  useEffect(() => {
    if (editId || analysisId) return;
    localStorage.setItem('qv_pitchdeck_draft', JSON.stringify({
      formData: form,
      savedDeckId: deckId,
      savedAt: Date.now(),
    }));
  }, [form, deckId, editId, analysisId]);

  // Auto-save draft when deckId exists and user navigates steps
  useEffect(() => {
    if (!deckId) return;
    const save = async () => {
      try { await api.patch(`/pitch-deck/${deckId}`, form); } catch {}
    };
    save();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, deckId]);

  async function handleSave() {
    setSaving(true);
    try {
      if (deckId) {
        await api.patch(`/pitch-deck/${deckId}`, form);
        toast.success('Pitch deck salvo!');
      } else {
        const res = await api.post('/pitch-deck/', form);
        setDeckId(res.data.id);
        toast.success('Pitch deck criado!');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAI(section) {
    if (!deckId) {
      // Save first
      try {
        const res = await api.post('/pitch-deck/', form);
        setDeckId(res.data.id);
      } catch (err) {
        toast.error('Salve o pitch deck primeiro.');
        return;
      }
    }
    setAiLoading(p => ({ ...p, [section]: true }));
    try {
      const res = await api.post(`/pitch-deck/${deckId}/ai-improve`, {
        section,
        current_text: form[section] || '',
        company_name: form.company_name,
        sector: form.sector,
      });
      const aiField = `ai_${section}`;
      toast.success(`IA melhorou a seção "${section}"!`);
      // Show AI text as a suggestion — user can accept or keep original
      set(section, res.data.improved_text);
    } catch (err) {
      toast.error('Erro ao usar IA.');
    } finally {
      setAiLoading(p => ({ ...p, [section]: false }));
    }
  }

  async function handleFinish() {
    if (!form.company_name) {
      toast.error('Preencha o nome da empresa.');
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      let id = deckId;
      if (id) {
        await api.patch(`/pitch-deck/${id}`, form);
      } else {
        const res = await api.post('/pitch-deck/', form);
        id = res.data.id;
        setDeckId(id);
      }
      localStorage.removeItem('qv_pitchdeck_draft');
      toast.success('Pitch deck salvo!');
      navigate(`/pitch-deck/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function prefillFromAnalysis() {
    if (!analysisId) return;
    setPrefillLoading(true);
    try {
      const res = await api.get(`/pitch-deck/prefill/${analysisId}`);
      const d = res.data;
      setForm(p => ({
        ...p,
        company_name: d.company_name || p.company_name,
        sector: d.sector || p.sector,
        financial_projections: d.financial_projections?.length ? d.financial_projections : p.financial_projections,
        analysis_id: analysisId,
      }));
      toast.success('Dados do laudo importados!');
    } catch {
      toast.error('Falha ao importar dados do laudo.');
    } finally {
      setPrefillLoading(false);
    }
  }

  const cardCls = `rounded-xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`;
  const inputCls = `w-full rounded-lg border px-4 py-2.5 text-sm transition focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 ${
    isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
  }`;
  const textareaCls = `${inputCls} min-h-[120px] resize-y`;
  const labelCls = `block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`;

  function AIButton({ section }) {
    return (
      <button
        type="button"
        onClick={() => handleAI(section)}
        disabled={aiLoading[section]}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition ${
          isDark ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
        } disabled:opacity-50`}
      >
        {aiLoading[section] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        Melhorar com IA
      </button>
    );
  }

  // ─── Step renderers ─────────────────────────
  const INVESTOR_TYPES = [
    { value: 'geral', label: 'Geral', desc: 'Para qualquer investidor' },
    { value: 'angel', label: 'Angel', desc: 'Investidor-anjo / early-stage' },
    { value: 'pe', label: 'Private Equity', desc: 'Fundos PE / buyout' },
    { value: 'bank', label: 'Banco / CRA', desc: 'Crédito corporativo' },
  ];

  const THEMES = [
    { value: 'corporate', label: 'Corporate', color: '#0F172A' },
    { value: 'emerald', label: 'Emerald', color: '#059669' },
    { value: 'ocean', label: 'Ocean', color: '#0284C7' },
    { value: 'violet', label: 'Violet', color: '#7C3AED' },
  ];

  function renderCompany() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nome da empresa *</label>
            <input className={inputCls} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Ex: Quanto Vale" />
          </div>
          <div>
            <label className={labelCls}>Setor</label>
            <input className={inputCls} value={form.sector} onChange={e => set('sector', e.target.value)} placeholder="Ex: Tecnologia / SaaS" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Slogan / Tagline</label>
          <input className={inputCls} value={form.slogan} onChange={e => set('slogan', e.target.value)} placeholder="Ex: Valuation inteligente para PMEs" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelCls}>Headline estratégico</label>
            <AIButton section="headline" />
          </div>
          <textarea className={textareaCls} value={form.headline} onChange={e => set('headline', e.target.value)} placeholder="Uma frase impactante que resume sua proposta de valor" rows={3} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Website</label>
            <input className={inputCls} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className={labelCls}>E-mail de contato</label>
            <input className={inputCls} type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="contato@empresa.com" />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input className={inputCls} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="(11) 99999-9999" />
          </div>
        </div>
        {/* Investor Type + Theme selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}><span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Tipo de Investidor</span></label>
            <div className="grid grid-cols-2 gap-2">
              {INVESTOR_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set('investor_type', t.value)}
                  className={`text-left px-3 py-2 rounded-xl border text-xs transition ${
                    form.investor_type === t.value
                      ? isDark ? 'border-purple-500/60 bg-purple-500/10 text-purple-300' : 'border-purple-400 bg-purple-50 text-purple-700'
                      : isDark ? 'border-slate-700 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold">{t.label}</div>
                  <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}><span className="flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Tema Visual</span></label>
            <div className="flex flex-wrap gap-2">
              {THEMES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set('theme', t.value)}
                  title={t.label}
                  className={`w-9 h-9 rounded-xl border-2 transition ${
                    form.theme === t.value ? 'border-white scale-110 ring-2 ring-offset-1' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ background: t.color, ringColor: t.color }}
                />
              ))}
            </div>
            <p className={`text-[10px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Tema ativo: {THEMES.find(t => t.value === form.theme)?.label}</p>
          </div>
        </div>
      </div>
    );
  }

  function renderProblem() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Descreva o problema que sua empresa resolve. Faça o investidor sentir a dor do cliente.
          </p>
          <AIButton section="problem" />
        </div>
        <textarea className={textareaCls} value={form.problem} onChange={e => set('problem', e.target.value)}
          placeholder="Qual é o problema real que seus clientes enfrentam? Como isso impacta a vida deles?" rows={6} />
      </div>
    );
  }

  function renderSolution() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Sua solução para o problema — por que sua empresa é a melhor posicionada?
          </p>
          <AIButton section="solution" />
        </div>
        <textarea className={textareaCls} value={form.solution} onChange={e => set('solution', e.target.value)}
          placeholder="Como sua empresa resolve o problema? Qual é o diferencial?" rows={6} />
      </div>
    );
  }

  function renderMarket() {
    const tm = form.target_market;
    const setTM = (k, v) => set('target_market', { ...tm, [k]: v });
    return (
      <div className="space-y-4">
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Descreva o tamanho do mercado e seus segmentos-alvo.
        </p>
        <div>
          <label className={labelCls}>Descrição do mercado</label>
          <textarea className={textareaCls} value={tm.description} onChange={e => setTM('description', e.target.value)}
            placeholder="Descreva seu mercado-alvo..." rows={4} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>TAM (Mercado Total)</label>
            <input className={inputCls} value={tm.tam} onChange={e => setTM('tam', e.target.value)} placeholder="Ex: R$ 50 bilhões" />
          </div>
          <div>
            <label className={labelCls}>SAM (Mercado Endereçável)</label>
            <input className={inputCls} value={tm.sam} onChange={e => setTM('sam', e.target.value)} placeholder="Ex: R$ 5 bilhões" />
          </div>
          <div>
            <label className={labelCls}>SOM (Mercado Atingível)</label>
            <input className={inputCls} value={tm.som} onChange={e => setTM('som', e.target.value)} placeholder="Ex: R$ 500 milhões" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Segmentos (um por linha)</label>
          <textarea className={`${inputCls} min-h-[80px]`} value={(tm.segments || []).join('\n')}
            onChange={e => setTM('segments', e.target.value.split('\n').filter(Boolean))}
            placeholder="PMEs com faturamento &gt; R$ 1M&#10;Startups early-stage&#10;..." rows={3} />
        </div>
      </div>
    );
  }

  function renderCompetition() {
    const competitors = form.competitive_landscape;
    const setComp = (idx, key, val) => {
      const copy = [...competitors];
      copy[idx] = { ...copy[idx], [key]: val };
      set('competitive_landscape', copy);
    };
    return (
      <div className="space-y-4">
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Liste seus concorrentes e suas vantagens competitivas.
        </p>
        {competitors.map((c, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div>
              <label className={labelCls}>Concorrente</label>
              <input className={inputCls} value={c.competitor} onChange={e => setComp(i, 'competitor', e.target.value)} placeholder="Nome do concorrente" />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className={labelCls}>Nossa vantagem</label>
                <input className={inputCls} value={c.advantage} onChange={e => setComp(i, 'advantage', e.target.value)} placeholder="Por que somos melhores" />
              </div>
              {competitors.length > 1 && (
                <button onClick={() => set('competitive_landscape', competitors.filter((_, j) => j !== i))}
                  className="p-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          </div>
        ))}
        <button onClick={() => set('competitive_landscape', [...competitors, { competitor: '', advantage: '' }])}
          className={`inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition ${isDark ? 'text-purple-400 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'}`}>
          <Plus className="w-4 h-4" /> Adicionar concorrente
        </button>
      </div>
    );
  }

  function renderBusiness() {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelCls}>Modelo de negócios</label>
            <AIButton section="business_model" />
          </div>
          <textarea className={textareaCls} value={form.business_model} onChange={e => set('business_model', e.target.value)}
            placeholder="Como sua empresa ganha dinheiro? Fontes de receita, pricing..." rows={5} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelCls}>Canais de vendas</label>
            <AIButton section="sales_channels" />
          </div>
          <textarea className={textareaCls} value={form.sales_channels} onChange={e => set('sales_channels', e.target.value)}
            placeholder="Como você vende e distribui? Sales digital, direct sales, marketplace..." rows={4} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelCls}>Marketing & crescimento</label>
            <AIButton section="marketing" />
          </div>
          <textarea className={textareaCls} value={form.marketing_activities} onChange={e => set('marketing_activities', e.target.value)}
            placeholder="Estratégias de aquisição, retenção e crescimento..." rows={4} />
        </div>
      </div>
    );
  }

  function renderFinancials() {
    const proj = form.financial_projections;
    const setProj = (idx, key, val) => {
      const copy = [...proj];
      copy[idx] = { ...copy[idx], [key]: parseFloat(val) || 0 };
      set('financial_projections', copy);
    };
    return (
      <div className="space-y-4">
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Projeções financeiras para os próximos anos.
        </p>
        {proj.map((p, i) => (
          <div key={i} className="grid grid-cols-4 gap-3 items-end">
            <div>
              <label className={labelCls}>Ano</label>
              <input className={inputCls} type="number" value={p.year} onChange={e => setProj(i, 'year', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Receita (R$)</label>
              <input className={inputCls} type="number" value={p.revenue} onChange={e => setProj(i, 'revenue', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Despesas (R$)</label>
              <input className={inputCls} type="number" value={p.expenses} onChange={e => setProj(i, 'expenses', e.target.value)} />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className={labelCls}>Lucro (R$)</label>
                <input className={inputCls} type="number" value={p.profit} onChange={e => setProj(i, 'profit', e.target.value)} />
              </div>
              {proj.length > 1 && (
                <button onClick={() => set('financial_projections', proj.filter((_, j) => j !== i))}
                  className="p-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          </div>
        ))}
        <button onClick={() => {
          const lastYear = proj.length > 0 ? proj[proj.length - 1].year + 1 : new Date().getFullYear() + 1;
          set('financial_projections', [...proj, { year: lastYear, revenue: 0, expenses: 0, profit: 0 }]);
        }}
          className={`inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition ${isDark ? 'text-purple-400 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'}`}>
          <Plus className="w-4 h-4" /> Adicionar ano
        </button>
      </div>
    );
  }

  function renderTeam() {
    const team = form.team;
    const setTeam = (idx, key, val) => {
      const copy = [...team];
      copy[idx] = { ...copy[idx], [key]: val };
      set('team', copy);
    };
    return (
      <div className="space-y-4">
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Os membros-chave da equipe — adicione foto, bio e LinkedIn.
        </p>
        {team.map((m, i) => (
          <div key={i} className={`p-4 rounded-xl border space-y-3 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50/50'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Membro {i + 1}</span>
              {team.length > 1 && (
                <button onClick={() => set('team', team.filter((_, j) => j !== i))}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nome</label>
                <input className={inputCls} value={m.name} onChange={e => setTeam(i, 'name', e.target.value)} placeholder="Nome completo" />
              </div>
              <div>
                <label className={labelCls}>Cargo / Função</label>
                <input className={inputCls} value={m.role} onChange={e => setTeam(i, 'role', e.target.value)} placeholder="CEO, CTO, COO..." />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}><span className="inline-flex items-center gap-1"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</span></label>
                <input className={inputCls} value={m.linkedin || ''} onChange={e => setTeam(i, 'linkedin', e.target.value)} placeholder="https://linkedin.com/in/usuario" />
              </div>
              <div>
                <label className={labelCls}><span className="inline-flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> URL da Foto</span></label>
                <input className={inputCls} value={m.photo_url || ''} onChange={e => setTeam(i, 'photo_url', e.target.value)} placeholder="https://... (URL da foto)" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Bio / Experiência</label>
              <textarea className={`${inputCls} min-h-[60px]`} value={m.bio || ''} onChange={e => setTeam(i, 'bio', e.target.value)} placeholder="Breve descrição da experiência e perfil profissional..." rows={2} />
            </div>
          </div>
        ))}
        <button onClick={() => set('team', [...team, { name: '', role: '', bio: '', linkedin: '', photo_url: '' }])}
          className={`inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition ${isDark ? 'text-purple-400 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'}`}>
          <Plus className="w-4 h-4" /> Adicionar membro
        </button>
        <div className="mt-6">
          <label className={labelCls}>Parceiros & recursos estratégicos</label>
          {form.partners_resources.map((p, i) => (
            <div key={i} className="flex gap-2 items-center mb-2">
              <input className={`${inputCls} flex-1`} value={p.name}
                onChange={e => {
                  const copy = [...form.partners_resources];
                  copy[i] = { name: e.target.value };
                  set('partners_resources', copy);
                }} placeholder="Nome do parceiro" />
              {form.partners_resources.length > 1 && (
                <button onClick={() => set('partners_resources', form.partners_resources.filter((_, j) => j !== i))}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
          <button onClick={() => set('partners_resources', [...form.partners_resources, { name: '' }])}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition ${isDark ? 'text-purple-400 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'}`}>
            <Plus className="w-3 h-3" /> Adicionar parceiro
          </button>
        </div>
      </div>
    );
  }

  function renderRoadmap() {
    const ms = form.milestones;
    const setMS = (idx, key, val) => {
      const copy = [...ms];
      copy[idx] = { ...copy[idx], [key]: val };
      set('milestones', copy);
    };
    const statusConfig = {
      completed:   { color: 'bg-emerald-500', ring: 'ring-emerald-500/40', label: 'Concluído', text: 'text-emerald-500' },
      in_progress: { color: 'bg-amber-500',   ring: 'ring-amber-500/40',   label: 'Em andamento', text: 'text-amber-500' },
      upcoming:    { color: isDark ? 'bg-slate-600' : 'bg-slate-300', ring: isDark ? 'ring-slate-500/40' : 'ring-slate-300', label: 'Planejado', text: isDark ? 'text-slate-400' : 'text-slate-500' },
    };
    return (
      <div className="space-y-6">
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Marcos estratégicos no roadmap da empresa.
        </p>

        {/* V4: Visual timeline */}
        {ms.filter(m => m.title).length > 0 && (
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[10px] uppercase font-semibold mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pré-visualização do Roadmap</p>
            <div className="relative flex items-start gap-0 overflow-x-auto pb-2">
              {ms.filter(m => m.title).map((m, i, arr) => {
                const cfg = statusConfig[m.status] || statusConfig.upcoming;
                return (
                  <div key={i} className="flex items-center min-w-0">
                    <div className="flex flex-col items-center min-w-[100px] max-w-[120px]">
                      {/* Date */}
                      <span className={`text-[10px] mb-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.date || '—'}</span>
                      {/* Node */}
                      <div className={`w-5 h-5 rounded-full flex-shrink-0 ring-2 ${cfg.color} ${cfg.ring} shadow-md z-10`} />
                      {/* Title */}
                      <span className={`text-[10px] mt-1 text-center leading-tight font-medium ${cfg.text}`}>{m.title}</span>
                      {/* Status badge */}
                      <span className={`text-[9px] mt-0.5 font-semibold ${cfg.text}`}>{cfg.label}</span>
                    </div>
                    {/* Connector */}
                    {i < arr.length - 1 && (
                      <div className={`flex-1 h-0.5 min-w-[24px] ${arr[i+1].status === 'completed' ? 'bg-emerald-500' : isDark ? 'bg-slate-700' : 'bg-slate-300'} -mt-10`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Form entries */}
        {ms.map((m, i) => (
          <div key={i} className={`rounded-lg border p-4 space-y-3 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="flex justify-between items-start">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                <div>
                  <label className={labelCls}>Título</label>
                  <input className={inputCls} value={m.title} onChange={e => setMS(i, 'title', e.target.value)} placeholder="Ex: Lançamento MVP" />
                </div>
                <div>
                  <label className={labelCls}>Data</label>
                  <input className={inputCls} value={m.date} onChange={e => setMS(i, 'date', e.target.value)} placeholder="Ex: Q1 2025" />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={inputCls} value={m.status} onChange={e => setMS(i, 'status', e.target.value)}>
                    <option value="completed">Concluído</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="upcoming">Planejado</option>
                  </select>
                </div>
              </div>
              {ms.length > 1 && (
                <button onClick={() => set('milestones', ms.filter((_, j) => j !== i))}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition ml-2"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <input className={inputCls} value={m.description} onChange={e => setMS(i, 'description', e.target.value)} placeholder="Descrição breve..." />
            </div>
          </div>
        ))}
        <button onClick={() => set('milestones', [...ms, { title: '', date: '', description: '', status: 'upcoming' }])}
          className={`inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition ${isDark ? 'text-purple-400 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'}`}>
          <Plus className="w-4 h-4" /> Adicionar marco
        </button>
      </div>
    );
  }

  function renderFunding() {
    const fn = form.funding_needs;
    const setFN = (k, v) => set('funding_needs', { ...fn, [k]: v });
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Quanto capital está buscando e como pretende utilizar?
          </p>
          <AIButton section="funding_use" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Valor total buscado (R$)</label>
            <input className={inputCls} type="number" value={fn.amount} onChange={e => setFN('amount', parseFloat(e.target.value) || 0)} placeholder="1000000" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Descrição do uso dos recursos</label>
          <textarea className={textareaCls} value={fn.description} onChange={e => setFN('description', e.target.value)}
            placeholder="Como o capital será investido?" rows={4} />
        </div>
        <div>
          <label className={labelCls}>Breakdown detalhado</label>
          {(fn.breakdown || []).map((b, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 mb-2 items-end">
              <input className={inputCls} value={b.label} placeholder="Área (ex: Marketing)"
                onChange={e => {
                  const copy = [...fn.breakdown];
                  copy[i] = { ...copy[i], label: e.target.value };
                  setFN('breakdown', copy);
                }} />
              <div className="flex gap-2 items-center">
                <input className={`${inputCls} flex-1`} type="number" value={b.value} placeholder="Valor (R$)"
                  onChange={e => {
                    const copy = [...fn.breakdown];
                    copy[i] = { ...copy[i], value: parseFloat(e.target.value) || 0 };
                    setFN('breakdown', copy);
                  }} />
                {fn.breakdown.length > 1 && (
                  <button onClick={() => setFN('breakdown', fn.breakdown.filter((_, j) => j !== i))}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          ))}
          <button onClick={() => setFN('breakdown', [...(fn.breakdown || []), { label: '', value: 0 }])}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition ${isDark ? 'text-purple-400 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'}`}>
            <Plus className="w-3 h-3" /> Adicionar item
          </button>
        </div>
      </div>
    );
  }

  const stepRenderers = [
    renderCompany, renderProblem, renderSolution, renderMarket,
    renderCompetition, renderBusiness, renderFinancials, renderTeam,
    renderRoadmap, renderFunding,
  ];

  const currentStep = STEPS[step];
  const StepIcon = currentStep.icon;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/pitch-deck')}
          className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {form.company_name || 'Novo Pitch Deck'}
          </h1>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Passo {step + 1} de {STEPS.length}
          </p>
        </div>
      </div>

      {/* Step progress bar */}
      <div className={`h-0.5 rounded-full overflow-hidden mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Import from analysis banner */}
      {analysisId && (
        <div className={`flex items-center justify-between rounded-lg border px-4 py-2.5 mb-4 text-sm ${isDark ? 'bg-blue-950/20 border-blue-500/30 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
          <span className="flex items-center gap-2"><Database className="w-4 h-4" /> Laudo de valuation vinculado.</span>
          <button
            onClick={prefillFromAnalysis}
            disabled={prefillLoading}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${isDark ? 'bg-blue-500/20 hover:bg-blue-500/30' : 'bg-blue-100 hover:bg-blue-200'} disabled:opacity-50`}
          >
            {prefillLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
            Importar dados financeiros
          </button>
        </div>
      )}

      {/* Draft restored banner */}
      {draftRestored && (
        <div className={`flex items-center justify-between rounded-lg border px-4 py-2.5 mb-4 text-sm ${isDark ? 'bg-amber-950/20 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          <span>💾 Rascunho restaurado automaticamente.</span>
          <button
            onClick={() => {
              localStorage.removeItem('qv_pitchdeck_draft');
              setDraftRestored(false);
              setForm({
                company_name: '', sector: '', slogan: '', headline: '', website: '', contact_email: '', contact_phone: '',
                problem: '', solution: '',
                target_market: { description: '', tam: '', sam: '', som: '', segments: [] },
                competitive_landscape: [{ competitor: '', advantage: '' }],
                business_model: '', sales_channels: '', marketing_activities: '',
                financial_projections: [{ year: new Date().getFullYear() + 1, revenue: 0, expenses: 0, profit: 0 }],
                team: [{ name: '', role: '', bio: '', linkedin: '', photo_url: '' }],
                milestones: [{ title: '', date: '', description: '', status: 'upcoming' }],
                funding_needs: { amount: 0, description: '', breakdown: [{ label: '', value: 0 }] },
                partners_resources: [{ name: '' }],
                analysis_id: analysisId || null,
                investor_type: 'geral',
                theme: 'corporate',
              });
              setDeckId(null);
              toast('Rascunho limpo.', { icon: '🗑️' });
            }}
            className={`text-xs font-medium px-3 py-1 rounded-lg transition ${isDark ? 'hover:bg-amber-500/20' : 'hover:bg-amber-100'}`}
          >
            Limpar rascunho
          </button>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                isActive
                  ? isDark ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200'
                  : isDone
                    ? isDark ? 'text-emerald-400/70 hover:bg-slate-800' : 'text-emerald-600/70 hover:bg-slate-50'
                    : isDark ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className={cardCls}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
            <StepIcon className="w-5 h-5 text-purple-500" />
          </div>
          <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentStep.label}</h2>
        </div>
        {stepRenderers[step]()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-30 ${
            isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ArrowLeft className="w-4 h-4" /> Anterior
        </button>

        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
            isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
          }`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar rascunho
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-600/30"
          >
            Próximo <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/30"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Finalizar
          </button>
        )}
      </div>
    </div>
  );
}
