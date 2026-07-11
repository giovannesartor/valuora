import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle, Send, Plus, Trash2, Save, Upload, ShieldCheck, Sparkles, Eye, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { usePageTitle } from '../lib/usePageTitle';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Cliente axios "público" sem interceptor de auth — não envia Authorization
const publicApi = axios.create({ baseURL: API_URL });

const EMPTY_FORM = {
  company_name: '',
  sector: '',
  slogan: '',
  contact_email: '',
  contact_phone: '',
  website: '',
  headline: '',
  problem: '',
  solution: '',
  business_model: '',
  sales_channels: '',
  marketing_activities: '',
  target_market: { description: '', tam: '', sam: '', som: '' },
  competitive_landscape: [],
  funding_needs: { amount: 0, description: '' },
  financial_projections: [],
  milestones: [],
  team: [],
  partners_resources: [],
  investor_type: 'geral',
  theme: 'corporate',
  submitter_name: '',
  submitter_email: '',
};

const STORAGE_PREFIX = 'pd_invite_draft_';

export default function PitchDeckInvitePage() {
  const { t } = useTranslation();
  usePageTitle(t('pdi_page_title'));
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPath, setLogoPath] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [attachUploading, setAttachUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [score, setScore] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [savingNow, setSavingNow] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiPrefilled, setAiPrefilled] = useState(false);
  const [aiBannerDismissed, setAiBannerDismissed] = useState(false);
  const draftTimerRef = useRef(null);
  const scoreTimerRef = useRef(null);

  const storageKey = useMemo(() => `${STORAGE_PREFIX}${token}`, [token]);

  // Load invite info
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await publicApi.get(`/pitch-deck/invite/${token}`);
        if (cancelled) return;
        setInfo(res.data);
        // Pre-fill from previous submission_data if any, else from AI prefill_data, else from localStorage
        const prior = res.data?.submission_data;
        const aiPrefill = res.data?.prefill_data;
        if (prior && typeof prior === 'object') {
          setForm({ ...EMPTY_FORM, ...prior });
          if (prior._logo_path) setLogoPath(prior._logo_path);
        } else if (aiPrefill && typeof aiPrefill === 'object') {
          // QV IA pré-preencheu — cliente pode editar livremente
          setForm({ ...EMPTY_FORM, ...aiPrefill });
          setAiPrefilled(true);
        } else {
          const draft = localStorage.getItem(storageKey);
          if (draft) {
            try { setForm({ ...EMPTY_FORM, ...JSON.parse(draft) }); } catch { /* ignore */ }
          } else if (res.data?.company_hint) {
            setForm((f) => ({ ...f, company_name: res.data.company_hint }));
          }
        }
        if (res.data?.client_name) {
          setForm((f) => ({ ...f, submitter_name: f.submitter_name || res.data.client_name }));
        }
        if (res.data?.client_email) {
          setForm((f) => ({ ...f, submitter_email: f.submitter_email || res.data.client_email, contact_email: f.contact_email || res.data.client_email }));
        }
      } catch (err) {
        if (cancelled) return;
        const detail = err?.response?.data?.detail || t('pdi_invite_not_found');
        setError(detail);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, storageKey]);

  // Auto-save no localStorage + servidor (draft) + score live
  useEffect(() => {
    if (!info?.can_submit) return;
    // localStorage imediato (fallback offline)
    try { localStorage.setItem(storageKey, JSON.stringify(form)); } catch { /* ignore */ }

    // server draft debounced 1.5s
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(async () => {
      try {
        const payload = { ...form };
        if (logoPath) payload._logo_path = logoPath;
        await publicApi.patch(`/pitch-deck/invite/${token}/draft`, { submission_data: payload });
        setDraftSavedAt(new Date());
      } catch { /* silent */ }
    }, 1500);

    // score debounced 700ms
    if (scoreTimerRef.current) clearTimeout(scoreTimerRef.current);
    scoreTimerRef.current = setTimeout(async () => {
      try {
        const payload = { ...form };
        if (logoPath) payload._logo_path = logoPath;
        const res = await publicApi.post(`/pitch-deck/invite/${token}/score`, { submission_data: payload });
        setScore(res.data || null);
      } catch { /* silent */ }
    }, 700);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      if (scoreTimerRef.current) clearTimeout(scoreTimerRef.current);
    };
  }, [form, logoPath, info, storageKey, token]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function updateNested(field, key, value) {
    setForm((f) => ({ ...f, [field]: { ...(f[field] || {}), [key]: value } }));
  }
  function addToList(field, item) {
    setForm((f) => ({ ...f, [field]: [...(f[field] || []), item] }));
  }
  function updateListItem(field, idx, key, value) {
    setForm((f) => ({
      ...f,
      [field]: (f[field] || []).map((it, i) => (i === idx ? { ...it, [key]: value } : it)),
    }));
  }
  function removeListItem(field, idx) {
    setForm((f) => ({ ...f, [field]: (f[field] || []).filter((_, i) => i !== idx) }));
  }

  async function uploadFile(file, kind) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await publicApi.post(`/pitch-deck/invite/${token}/upload`, fd, {
      params: { kind },
    });
    return res.data;
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const data = await uploadFile(file, 'logo');
      setLogoPath(data.path);
      toast.success('Logo enviado.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('pdi_logo_upload_error'));
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  }

  async function handleAttachUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachUploading(true);
    try {
      const data = await uploadFile(file, 'attachment');
      setAttachments(data.attachments || []);
      toast.success('Anexo enviado.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('pdi_attach_upload_error'));
    } finally {
      setAttachUploading(false);
      e.target.value = '';
    }
  }

  async function handleVideoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error(t('pdi_video_too_large'));
      e.target.value = '';
      return;
    }
    setVideoUploading(true);
    try {
      const data = await uploadFile(file, 'video');
      setAttachments(data.attachments || []);
      toast.success('Vídeo enviado.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('pdi_video_upload_error'));
    } finally {
      setVideoUploading(false);
      e.target.value = '';
    }
  }

  async function saveNow() {
    setSavingNow(true);
    try {
      const payload = { ...form };
      if (logoPath) payload._logo_path = logoPath;
      await publicApi.patch(`/pitch-deck/invite/${token}/draft`, { submission_data: payload });
      setDraftSavedAt(new Date());
      toast.success(t('pdi_save_success'));
    } catch {
      toast.error(t('pdi_save_error'));
    } finally {
      setSavingNow(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.company_name?.trim()) {
      toast.error(t('pdi_company_name_required'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (logoPath) payload._logo_path = logoPath;
      const res = await publicApi.post(`/pitch-deck/invite/${token}/submit`, payload);
      setInfo(res.data);
      setSubmitted(true);
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : t('pdi_submit_error'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <FullScreen>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </FullScreen>
    );
  }

  if (error) {
    return (
      <FullScreen>
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Convite indisponível</h2>
          <p className="text-slate-500">{error}</p>
        </div>
      </FullScreen>
    );
  }

  if (!info?.can_submit && info?.status === 'converted') {
    return (
      <FullScreen>
        <Done title={t('pdi_converted_title')} message={t('pdi_converted_message')} />
      </FullScreen>
    );
  }
  if (!info?.can_submit && info?.status === 'rejected') {
    return (
      <FullScreen>
        <Done title={t('pdi_rejected_title')} message={t('pdi_rejected_message')} color="red" />
      </FullScreen>
    );
  }
  if (!info?.can_submit || info?.is_expired) {
    return (
      <FullScreen>
        <Done title={t('pdi_expired_title')} message={t('pdi_expired_message')} color="amber" />
      </FullScreen>
    );
  }

  if (submitted) {
    return (
      <FullScreen>
        <Done
          title={t('pdi_submitted_title')}
          message={t('pdi_submitted_message')}
        />
      </FullScreen>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="text-xs tracking-wider uppercase opacity-80">Valuora • Pitch Deck</div>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">
            Preencha as informações do seu pitch deck
          </h1>
          {info.admin_message && (
            <div className="mt-4 rounded-lg bg-white/10 backdrop-blur px-4 py-3 text-sm italic border-l-2 border-white/40">
              "{info.admin_message}"
            </div>
          )}
          <p className="text-sm mt-3 opacity-90">
            Convite válido até {new Date(info.expires_at).toLocaleDateString('pt-BR')}.
            Os dados são salvos automaticamente no seu navegador.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 flex gap-6">
        <div className="flex-1 max-w-3xl">
        {score && <ScoreWidget score={score} savedAt={draftSavedAt} />}
        {aiPrefilled && !aiBannerDismissed && (
          <div className="mb-4 rounded-xl border border-purple-300 dark:border-purple-700/50 bg-purple-50 dark:bg-purple-900/20 p-4 flex items-start gap-3">
            <div className="text-purple-600 dark:text-purple-300 text-lg leading-none mt-0.5">✨</div>
            <div className="flex-1 text-sm">
              <div className="font-semibold text-purple-800 dark:text-purple-200">
                Adiantamos um rascunho para você
              </div>
              <p className="text-purple-700 dark:text-purple-300 mt-1">
                Para te poupar tempo, a <b>QV IA</b> da Quantovale analisou informações públicas
                da sua empresa e pré-preencheu alguns campos abaixo. <b>Revise e edite tudo livremente</b> —
                nenhuma informação será considerada final até você clicar em "Enviar".
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAiBannerDismissed(true)}
              className="text-purple-500 hover:text-purple-700 dark:hover:text-purple-200 text-xs"
              aria-label="Fechar aviso"
            >
              ✕
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <Card title={t('pdi_your_id')}>
            <Grid2>
              <Field label={t('pdi_your_name')}>
                <Input value={form.submitter_name} onChange={(v) => update('submitter_name', v)} placeholder="Maria Silva" />
              </Field>
              <Field label={t('pdi_your_email')}>
                <Input type="email" value={form.submitter_email} onChange={(v) => update('submitter_email', v)} placeholder={t('pdi_email_placeholder')} />
              </Field>
            </Grid2>
          </Card>

          {/* Empresa */}
          <Card title={t('pdi_about_company')}>
            <Grid2>
              <Field label={t('analysis_company_name')} required>
                <Input value={form.company_name} onChange={(v) => update('company_name', v)} required />
              </Field>
              <Field label={t('analysis_sector')}>
                <Input value={form.sector} onChange={(v) => update('sector', v)} placeholder={t('pdi_sector_placeholder')} />
              </Field>
              <Field label="Slogan">
                <Input value={form.slogan} onChange={(v) => update('slogan', v)} />
              </Field>
              <Field label="Website">
                <Input value={form.website} onChange={(v) => update('website', v)} placeholder="https://..." />
              </Field>
              <Field label="E-mail de contato">
                <Input type="email" value={form.contact_email} onChange={(v) => update('contact_email', v)} />
              </Field>
              <Field label="Telefone de contato">
                <Input value={form.contact_phone} onChange={(v) => update('contact_phone', v)} />
              </Field>
            </Grid2>

            <Field label={t('pdi_company_logo')}>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-300 cursor-pointer hover:border-purple-400 text-sm text-slate-600">
                <Upload className="w-4 h-4" />
                {logoUploading ? 'Enviando...' : (logoPath ? 'Trocar logo' : 'Enviar logo (PNG/JPG/SVG)')}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
              </label>
              {logoPath && (
                <div className="mt-2 text-xs text-emerald-600 truncate">✓ Logo enviado</div>
              )}
            </Field>
          </Card>

          {/* Pitch */}
          <Card title="O pitch">
            <Field label="Headline (uma frase de impacto)">
              <Input value={form.headline} onChange={(v) => update('headline', v)} maxLength={200} />
            </Field>
            <Field label="Problema que vocês resolvem">
              <Textarea value={form.problem} onChange={(v) => update('problem', v)} />
            </Field>
            <Field label="Solução">
              <Textarea value={form.solution} onChange={(v) => update('solution', v)} />
            </Field>
            <Field label={t('pdi_business_model')}>
              <Textarea value={form.business_model} onChange={(v) => update('business_model', v)} />
            </Field>
            <Field label="Canais de venda">
              <Textarea value={form.sales_channels} onChange={(v) => update('sales_channels', v)} rows={3} />
            </Field>
            <Field label="Atividades de marketing">
              <Textarea value={form.marketing_activities} onChange={(v) => update('marketing_activities', v)} rows={3} />
            </Field>
          </Card>

          {/* Mercado-alvo */}
          <Card title="Mercado-alvo">
            <Field label="Descrição do mercado">
              <Textarea
                value={form.target_market?.description || ''}
                onChange={(v) => updateNested('target_market', 'description', v)}
                rows={3}
              />
            </Field>
            <Grid3>
              <Field label="TAM (mercado total)">
                <Input value={form.target_market?.tam || ''} onChange={(v) => updateNested('target_market', 'tam', v)} placeholder="R$ ..." />
              </Field>
              <Field label="SAM (mercado endereçável)">
                <Input value={form.target_market?.sam || ''} onChange={(v) => updateNested('target_market', 'sam', v)} />
              </Field>
              <Field label="SOM (mercado obtível)">
                <Input value={form.target_market?.som || ''} onChange={(v) => updateNested('target_market', 'som', v)} />
              </Field>
            </Grid3>
          </Card>

          {/* Concorrência */}
          <Card title="Concorrência">
            <ListEditor
              items={form.competitive_landscape}
              onAdd={() => addToList('competitive_landscape', { competitor: '', advantage: '' })}
              onRemove={(i) => removeListItem('competitive_landscape', i)}
              renderItem={(item, i) => (
                <Grid2>
                  <Input value={item.competitor} onChange={(v) => updateListItem('competitive_landscape', i, 'competitor', v)} placeholder={t('pdi_competitor_placeholder')} />
                  <Input value={item.advantage} onChange={(v) => updateListItem('competitive_landscape', i, 'advantage', v)} placeholder={t('pdi_advantage_placeholder')} />
                </Grid2>
              )}
              addLabel={t('pdi_add_competitor')}
            />
          </Card>

          {/* Captação */}
          <Card title={t('pdi_funding_needs')}>
            <Grid2>
              <Field label="Valor desejado (R$)">
                <Input
                  type="number"
                  value={form.funding_needs?.amount || 0}
                  onChange={(v) => updateNested('funding_needs', 'amount', Number(v) || 0)}
                />
              </Field>
            </Grid2>
            <Field label="Como o dinheiro será usado">
              <Textarea
                value={form.funding_needs?.description || ''}
                onChange={(v) => updateNested('funding_needs', 'description', v)}
                rows={3}
              />
            </Field>
          </Card>

          {/* Projeções */}
          <Card title="Projeções financeiras">
            <ListEditor
              items={form.financial_projections}
              onAdd={() => addToList('financial_projections', { year: new Date().getFullYear() + (form.financial_projections?.length || 0), revenue: 0, expenses: 0, profit: 0 })}
              onRemove={(i) => removeListItem('financial_projections', i)}
              renderItem={(item, i) => (
                <div className="grid grid-cols-4 gap-2">
                  <Input type="number" value={item.year} onChange={(v) => updateListItem('financial_projections', i, 'year', Number(v) || 0)} placeholder="Ano" />
                  <Input type="number" value={item.revenue} onChange={(v) => updateListItem('financial_projections', i, 'revenue', Number(v) || 0)} placeholder="Receita" />
                  <Input type="number" value={item.expenses} onChange={(v) => updateListItem('financial_projections', i, 'expenses', Number(v) || 0)} placeholder="Custos" />
                  <Input type="number" value={item.profit} onChange={(v) => updateListItem('financial_projections', i, 'profit', Number(v) || 0)} placeholder="Lucro" />
                </div>
              )}
              addLabel="Adicionar ano"
            />
          </Card>

          {/* Marcos */}
          <Card title="Marcos / Roadmap">
            <ListEditor
              items={form.milestones}
              onAdd={() => addToList('milestones', { title: '', date: '', description: '', status: 'upcoming' })}
              onRemove={(i) => removeListItem('milestones', i)}
              renderItem={(item, i) => (
                <div className="space-y-2">
                  <Grid2>
                    <Input value={item.title} onChange={(v) => updateListItem('milestones', i, 'title', v)} placeholder="Título" />
                    <Input value={item.date} onChange={(v) => updateListItem('milestones', i, 'date', v)} placeholder="Data (ex: Q3/2026)" />
                  </Grid2>
                  <Textarea value={item.description} onChange={(v) => updateListItem('milestones', i, 'description', v)} rows={2} placeholder="Descrição" />
                  <select
                    value={item.status}
                    onChange={(e) => updateListItem('milestones', i, 'status', e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="upcoming">Próximo</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="completed">Concluído</option>
                  </select>
                </div>
              )}
              addLabel="Adicionar marco"
            />
          </Card>

          {/* Time */}
          <Card title="Time">
            <ListEditor
              items={form.team}
              onAdd={() => addToList('team', { name: '', role: '', bio: '', linkedin: '' })}
              onRemove={(i) => removeListItem('team', i)}
              renderItem={(item, i) => (
                <div className="space-y-2">
                  <Grid2>
                    <Input value={item.name} onChange={(v) => updateListItem('team', i, 'name', v)} placeholder="Nome" />
                    <Input value={item.role} onChange={(v) => updateListItem('team', i, 'role', v)} placeholder="Cargo" />
                  </Grid2>
                  <Input value={item.linkedin} onChange={(v) => updateListItem('team', i, 'linkedin', v)} placeholder="LinkedIn (URL)" />
                  <Textarea value={item.bio} onChange={(v) => updateListItem('team', i, 'bio', v)} rows={2} placeholder="Bio breve" />
                </div>
              )}
              addLabel="Adicionar membro"
            />
          </Card>

          {/* Anexos */}
          <Card title="Anexos opcionais">
            <p className="text-xs text-slate-500 mb-3">Envie até 5 arquivos (PDF ou imagem, máx 8 MB cada).</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-300 cursor-pointer hover:border-purple-400 text-sm text-slate-600">
                <Upload className="w-4 h-4" />
                {attachUploading ? 'Enviando...' : 'Adicionar PDF/imagem'}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleAttachUpload} disabled={attachUploading} />
              </label>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-300 cursor-pointer hover:border-purple-400 text-sm text-slate-600">
                <Video className="w-4 h-4" />
                {videoUploading ? 'Enviando vídeo...' : 'Enviar vídeo (MP4/MOV/WebM, máx 50MB)'}
                <input type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleVideoUpload} disabled={videoUploading} />
              </label>
            </div>
            {attachments.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {attachments.map((a, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-slate-700">
                    <span className="truncate flex items-center gap-2">
                      {a.kind === 'video' && <Video className="w-3.5 h-3.5 text-purple-500" />}
                      {a.name}
                    </span>
                    <span className="text-xs text-slate-400">{(a.size / 1024).toFixed(0)} KB</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Submit */}
          <div className="sticky bottom-0 bg-gradient-to-t from-slate-50 via-slate-50/95 pt-4 pb-6">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={saveNow}
                disabled={savingNow}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingNow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar e continuar depois
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-purple-300 bg-white text-purple-700 font-semibold text-sm hover:bg-purple-50 flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Pré-visualizar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-[2] px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-sm hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar para a equipe Valuora
              </button>
            </div>
            <p className="text-xs text-center text-slate-400 mt-2">
              <Save className="inline w-3 h-3 mr-1" /> Auto-salvo no servidor{draftSavedAt ? ` às ${draftSavedAt.toLocaleTimeString('pt-BR')}` : ''} • use o mesmo link para voltar.
            </p>
          </div>
        </form>

        {/* Footer LGPD */}
        <footer className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-xs text-slate-500 leading-relaxed">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-slate-700 mb-1">Privacidade & LGPD</p>
              <p>
                Coletamos somente os dados deste formulário para gerar o seu pitch deck.
                Você pode solicitar a exclusão destes dados a qualquer momento entrando em contato com a equipe Valuora.
                Convites não submetidos são automaticamente removidos após 90 dias.
              </p>
            </div>
          </div>
        </footer>
        </div>
        <SectionProgress form={form} score={score} />
      </main>
      {previewOpen && <PreviewModal form={form} logoPath={logoPath} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

function ScoreWidget({ score, savedAt }) {
  const lvl = score.level || 'poor';
  const colorMap = {
    excellent: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    good:      'bg-blue-100 text-blue-700 border-blue-300',
    fair:      'bg-amber-100 text-amber-700 border-amber-300',
    poor:      'bg-red-100 text-red-700 border-red-300',
  };
  const labelMap = { excellent: 'Excelente', good: 'Bom', fair: 'Razoável', poor: 'Comece pelos básicos' };
  return (
    <div className={`rounded-2xl border p-4 mb-6 ${colorMap[lvl]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80">Completude do seu pitch</div>
            <div className="text-xl font-bold">{score.score}/100 — {labelMap[lvl]}</div>
          </div>
        </div>
        {savedAt && (
          <span className="text-[10px] opacity-70">salvo às {savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>
      <div className="mt-2 h-1.5 bg-white/50 rounded-full overflow-hidden">
        <div className="h-full bg-current opacity-80 transition-all" style={{ width: `${score.score}%` }} />
      </div>
      {Array.isArray(score.missing) && score.missing.length > 0 && score.score < 100 && (
        <details className="mt-2">
          <summary className="text-xs cursor-pointer opacity-80">Ver itens faltantes ({score.missing.length})</summary>
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs opacity-90">
            {score.missing.slice(0, 12).map((m, i) => <li key={i}>• {m}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

// ─── UI helpers ─────────────────────────────────────────
function FullScreen({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      {children}
    </div>
  );
}

function Done({ title, message, color = 'emerald' }) {
  const colorMap = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
  };
  return (
    <div className="text-center max-w-md">
      <CheckCircle2 className={`w-14 h-14 mx-auto mb-4 ${colorMap[color]}`} />
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-500">{message}</p>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
      <h3 className="font-semibold text-slate-900 mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = 'text', ...rest }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
      {...rest}
    />
  );
}

function Textarea({ value, onChange, rows = 4, ...rest }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
      {...rest}
    />
  );
}

function Grid2({ children }) {
  return <div className="grid md:grid-cols-2 gap-3">{children}</div>;
}
function Grid3({ children }) {
  return <div className="grid md:grid-cols-3 gap-3">{children}</div>;
}

function ListEditor({ items, onAdd, onRemove, renderItem, addLabel }) {
  return (
    <div className="space-y-3">
      {(items || []).map((item, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-3 relative">
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50"
            title="Remover"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {renderItem(item, i)}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:border-purple-400 hover:text-purple-600"
      >
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}

// ─── Section progress (sidebar) ─────────────────────────
const SECTION_DEFS = [
  { id: 'company', label: 'Empresa', fields: ['company_name', 'sector', 'website'] },
  { id: 'pitch', label: 'Pitch', fields: ['headline', 'problem', 'solution', 'business_model'] },
  { id: 'market', label: 'Mercado', fields: ['target_market.description'] },
  { id: 'funding', label: 'Captação', fields: ['funding_needs.amount', 'funding_needs.description'] },
  { id: 'projections', label: 'Projeções', fields: ['financial_projections.length'] },
  { id: 'milestones', label: 'Marcos', fields: ['milestones.length'] },
  { id: 'team', label: 'Time', fields: ['team.length'] },
];

function getValByPath(obj, path) {
  if (path.endsWith('.length')) {
    const arr = obj[path.replace('.length', '')];
    return Array.isArray(arr) && arr.length > 0;
  }
  const parts = path.split('.');
  let v = obj;
  for (const p of parts) {
    if (v == null) return false;
    v = v[p];
  }
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return v > 0;
  return Boolean(v);
}

export function SectionProgress({ form, score }) {
  const sections = SECTION_DEFS.map((s) => {
    const filled = s.fields.filter((f) => getValByPath(form, f)).length;
    return { ...s, filled, total: s.fields.length, pct: Math.round((filled / s.fields.length) * 100) };
  });
  return (
    <aside className="hidden xl:block sticky top-4 w-60 self-start">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Seu progresso</div>
        {score && (
          <div className="mb-3 pb-3 border-b border-slate-100">
            <div className="text-2xl font-bold text-purple-600">{score.score}<span className="text-sm text-slate-400">/100</span></div>
          </div>
        )}
        <ul className="space-y-2.5 text-sm">
          {sections.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.pct === 100 ? 'bg-emerald-500' : s.pct > 0 ? 'bg-amber-400' : 'bg-slate-200'}`} />
              <span className={`flex-1 ${s.pct === 100 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>{s.label}</span>
              <span className="text-xs text-slate-400">{s.filled}/{s.total}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

// ─── Preview modal ──────────────────────────────────────
export function PreviewModal({ form, logoPath, onClose }) {
  const fmt = (v) => (v && String(v).trim()) || <em className="text-slate-300">— vazio —</em>;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">Preview do que será enviado</div>
            <h3 className="font-bold text-slate-900">{form.company_name || t('pdi_your_company')}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5 text-sm">
          <div className="flex items-start gap-4">
            {logoPath && <div className="text-xs text-emerald-600">✓ Logo</div>}
            <div className="flex-1">
              <div className="text-xs text-slate-400 uppercase">Slogan</div>
              <div className="text-base">{fmt(form.slogan)}</div>
            </div>
          </div>
          <Section label="Headline">{fmt(form.headline)}</Section>
          <Section label="Problema">{fmt(form.problem)}</Section>
          <Section label="Solução">{fmt(form.solution)}</Section>
          <Section label={t('pdi_business_model')}>{fmt(form.business_model)}</Section>
          <Section label="Mercado-alvo">{fmt(form.target_market?.description)}</Section>
          <Section label="Captação">
            R$ {Number(form.funding_needs?.amount || 0).toLocaleString('pt-BR')} — {fmt(form.funding_needs?.description)}
          </Section>
          <Section label={`Time (${(form.team || []).length})`}>
            {(form.team || []).map((t, i) => (
              <div key={i} className="border-l-2 border-purple-300 pl-3 mb-2">
                <div className="font-semibold">{t.name || '—'} <span className="text-xs text-slate-500">{t.role}</span></div>
                <div className="text-xs text-slate-600">{t.bio}</div>
              </div>
            ))}
          </Section>
          <Section label={`Marcos (${(form.milestones || []).length})`}>
            <ul className="text-xs space-y-1">
              {(form.milestones || []).map((m, i) => <li key={i}>• {m.date} — {m.title}</li>)}
            </ul>
          </Section>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">Fechar preview</button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-slate-700 whitespace-pre-wrap">{children}</div>
    </div>
  );
}
