import { useState, useEffect, useRef } from 'react';
import { X, Loader2, FileText, Presentation, Mail, CheckCircle2, XCircle, Sparkles, Download, Wand2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const POLL_MS = 2500;

/**
 * Modal para criar e acompanhar uma consolidação de N pitch decks (relatório executivo).
 * Props: { open, isDark, selected: [{id, label}], seed?: {invite_ids, title, language, include_pptx}, onClose, onDone }
 */
export default function ConsolidationModal({ open, isDark, selected, seed, onClose, onDone }) {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('pt');
  const [includePptx, setIncludePptx] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [creating, setCreating] = useState(false);
  const [job, setJob] = useState(null);   // {id, status, progress_pct, ...}
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState(null); // {groups, ungrouped}
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!open) {
      // reset
      setTitle('');
      setLanguage('pt');
      setIncludePptx(false);
      setEmailRecipients('');
      setCreating(false);
      setJob(null);
      setSuggestion(null);
      setSuggesting(false);
      if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    // aplica seed (duplicar e editar)
    if (seed) {
      if (seed.title) setTitle(seed.title);
      if (seed.language) setLanguage(seed.language);
      if (typeof seed.include_pptx === 'boolean') setIncludePptx(seed.include_pptx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!job?.id) return;
    if (job.status === 'ready' || job.status === 'failed') {
      if (pollRef.current) clearInterval(pollRef.current);
      // ao ficar pronto, carrega preview inline
      if (job.status === 'ready' && job.has_pdf && !previewBlobUrl && !loadingPreview) {
        loadPreview(job.id);
      }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get(`/pitch-deck/consolidations/${job.id}`);
        setJob(r.data);
      } catch {
        // ignore
      }
    }, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status]);

  async function loadPreview(id) {
    setLoadingPreview(true);
    try {
      const r = await api.get(`/pitch-deck/consolidations/${id}/pdf?inline=true`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      setPreviewBlobUrl(url);
    } catch {
      // silencioso
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSuggestGroups() {
    if (!selected || selected.length < 2) return;
    setSuggesting(true);
    try {
      const r = await api.post('/pitch-deck/consolidations/suggest-groups', {
        invite_ids: selected.map((s) => s.id),
      });
      setSuggestion(r.data);
      if (!r.data?.groups?.length) {
        toast.info('IA não encontrou grupos com afinidade clara.');
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao sugerir grupos.');
    } finally {
      setSuggesting(false);
    }
  }

  if (!open) return null;

  const recipients = emailRecipients
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  async function startJob() {
    if (!selected || selected.length < 2) {
      toast.error('Selecione ao menos 2 pitch decks.');
      return;
    }
    if (selected.length > 10) {
      toast.error('Máximo de 10 pitch decks por consolidação.');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/pitch-deck/consolidations', {
        invite_ids: selected.map((s) => s.id),
        title: title || null,
        language,
        include_pptx: includePptx,
        email_recipients: recipients,
      });
      setJob(res.data);
      toast.success('Consolidação iniciada — gerando em segundo plano.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao iniciar consolidação.');
    } finally {
      setCreating(false);
    }
  }

  async function downloadFile(kind /* 'pdf' | 'pptx' */) {
    try {
      const r = await api.get(`/pitch-deck/consolidations/${job.id}/${kind}`, { responseType: 'blob' });
      const blob = new Blob([r.data], {
        type: kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consolidacao-${job.id}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      toast.error(err?.response?.data?.detail || `Erro ao baixar ${kind.toUpperCase()}.`);
    }
  }

  const cardCls = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const txt = isDark ? 'text-white' : 'text-slate-900';
  const subtxt = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `w-full text-sm px-3 py-2 rounded-lg border ${
    isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
  }`;

  const isRunning = job && (job.status === 'pending' || job.status === 'processing');
  const isReady = job && job.status === 'ready';
  const isFailed = job && job.status === 'failed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`w-full ${job ? 'max-w-5xl' : 'max-w-2xl'} rounded-2xl border shadow-2xl ${cardCls}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className={`font-semibold ${txt}`}>Resumo Consolidado de Pitch Decks</h2>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {!job ? (
            <>
              <p className={`text-sm mb-4 ${subtxt}`}>
                A IA gera um resumo executivo individual de cada pitch + análise cruzada (rankings, sinergias, top picks) num PDF único.
              </p>

              <div className={`mb-4 rounded-xl border p-3 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-xs font-medium ${subtxt}`}>Pitch decks selecionados ({selected?.length || 0})</div>
                  <button
                    type="button"
                    onClick={handleSuggestGroups}
                    disabled={suggesting || !selected || selected.length < 2}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded ${isDark ? 'bg-purple-900/30 hover:bg-purple-900/50 text-purple-300' : 'bg-purple-50 hover:bg-purple-100 text-purple-700'} disabled:opacity-50`}
                    title="IA sugere agrupamentos por afinidade (setor/tese/estágio)"
                  >
                    {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Sugerir grupos (IA)
                  </button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(selected || []).map((s) => (
                    <div key={s.id} className={`text-sm ${txt} truncate`}>• {s.label}</div>
                  ))}
                </div>
              </div>

              {suggestion && (suggestion.groups?.length > 0 || suggestion.ungrouped?.length > 0) && (
                <div className={`mb-4 rounded-xl border p-3 ${isDark ? 'border-purple-800/50 bg-purple-900/10' : 'border-purple-200 bg-purple-50/50'}`}>
                  <div className={`text-xs font-semibold mb-2 ${txt} flex items-center gap-1`}>
                    <Wand2 className="w-3.5 h-3.5 text-purple-500" /> Sugestão da IA
                  </div>
                  {(suggestion.groups || []).map((g, idx) => (
                    <div key={idx} className="mb-2 last:mb-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${txt}`}>{g.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                          {g.invite_ids.length} decks
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            // aplica esse grupo como seleção (notifica via onDone? não — só ajusta title)
                            setTitle(g.label);
                            toast.success(`Use os ${g.invite_ids.length} decks deste grupo: feche e re-selecione na tabela.`);
                          }}
                          className={`ml-auto text-[10px] px-2 py-0.5 rounded ${isDark ? 'text-purple-300 hover:bg-purple-900/40' : 'text-purple-700 hover:bg-purple-100'}`}
                        >
                          Usar título
                        </button>
                      </div>
                      <div className={`text-xs ${subtxt} ml-0.5`}>{g.rationale}</div>
                    </div>
                  ))}
                  {suggestion.ungrouped?.length > 0 && (
                    <div className={`text-[11px] mt-1 ${subtxt}`}>
                      Sem afinidade: {suggestion.ungrouped.length} deck(s)
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${subtxt}`}>Título (opcional)</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Comitê de Investimentos — Abril/2026"
                    className={inputCls}
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${subtxt}`}>Idioma</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                    <option value="pt">Português</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <label className={`flex items-center gap-2 text-sm ${txt}`}>
                  <input type="checkbox" checked={includePptx} onChange={(e) => setIncludePptx(e.target.checked)} />
                  <Presentation className="w-4 h-4 text-orange-500" />
                  Gerar também versão <b>PPTX</b> (slides comparativos)
                </label>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${subtxt}`}>
                    <Mail className="w-3.5 h-3.5 inline mr-1" />
                    Enviar por e-mail (opcional, lista separada por vírgulas)
                  </label>
                  <textarea
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                    placeholder="investidor1@fundo.com, comite@fundo.com"
                    className={`${inputCls} h-20 resize-none`}
                  />
                  <div className={`text-[11px] mt-1 ${subtxt}`}>
                    {recipients.length > 0 ? `${recipients.length} destinatário(s)` : 'Nenhum — só será gerado para download'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {isRunning && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
                  {isReady && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {isFailed && <XCircle className="w-4 h-4 text-red-500" />}
                  <span className={`text-sm font-medium ${txt}`}>
                    {isRunning && 'Processando...'}
                    {isReady && 'Pronto!'}
                    {isFailed && 'Falhou'}
                  </span>
                  <span className={`ml-auto text-xs ${subtxt}`}>{job.progress_pct || 0}%</span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                  <div
                    className={`h-full ${isFailed ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-emerald-500'} transition-all duration-500`}
                    style={{ width: `${job.progress_pct || 0}%` }}
                  />
                </div>
                <div className={`text-xs mt-2 ${subtxt}`}>{job.progress_message || '—'}</div>
                {isFailed && job.error && (
                  <div className="mt-2 text-xs text-red-500">{job.error}</div>
                )}
              </div>

              {isReady && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => downloadFile('pdf')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition"
                  >
                    <Download className="w-4 h-4" /> Baixar PDF
                  </button>
                  {job.has_pptx && (
                    <button
                      onClick={() => downloadFile('pptx')}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-500 transition"
                    >
                      <Presentation className="w-4 h-4" /> Baixar PPTX
                    </button>
                  )}
                </div>
              )}

              {isReady && job.meta_json?.executive_takeaway && (
                <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className={`text-xs font-semibold mb-1 ${txt}`}>Sumário Executivo (IA)</div>
                  <div className={`text-sm ${subtxt}`}>{job.meta_json.executive_takeaway}</div>
                </div>
              )}

              {isReady && (
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold ${txt} ${isDark ? 'bg-slate-950/40' : 'bg-slate-50'}`}>
                    <Eye className="w-3.5 h-3.5" /> Pré-visualização
                  </div>
                  {loadingPreview ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                    </div>
                  ) : previewBlobUrl ? (
                    <iframe
                      title="Preview PDF"
                      src={previewBlobUrl}
                      className="w-full bg-white"
                      style={{ height: '60vh', border: 0 }}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <button onClick={() => loadPreview(job.id)} className="text-xs text-purple-500 hover:underline">Carregar preview</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {!job && (
            <>
              <button onClick={onClose} className={`px-4 py-2 text-sm rounded-lg ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                Cancelar
              </button>
              <button
                onClick={startJob}
                disabled={creating || !selected || selected.length < 2}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar resumo consolidado
              </button>
            </>
          )}
          {job && (isReady || isFailed) && (
            <button
              onClick={() => { onDone?.(); onClose(); }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
