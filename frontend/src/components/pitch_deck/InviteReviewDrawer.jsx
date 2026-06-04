import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, XCircle, FileText, AlertTriangle, MessageSquare, Trash2, UserCog, Sparkles, Download, ShieldAlert, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import ConfirmDialog from '../ConfirmDialog';

const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '');

function resolveAttachmentUrl(path) {
  if (!path) return '#';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}/uploads/${String(path).replace(/^\/+/, '')}`;
}

/**
 * Drawer admin para revisar uma submissão e converter em PitchDeck.
 *
 * Mostra os dados enviados pelo cliente em modo somente-leitura
 * (a edição completa é feita após a conversão, na página do PitchDeck).
 * Permite editar campos básicos do invite (notas internas, e-mail/nome) e
 * disparar Converter / Rejeitar.
 */
export default function InviteReviewDrawer({ inviteId, isDark, onClose, onChanged, onConverted }) {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [notes, setNotes] = useState('');
  const [admins, setAdmins] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purging, setPurging] = useState(false);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestChangesText, setRequestChangesText] = useState('');
  const [requestChangesSendEmail, setRequestChangesSendEmail] = useState(true);
  const [requestingChanges, setRequestingChanges] = useState(false);

  useEffect(() => {
    if (!inviteId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/pitch-deck/invites/${inviteId}`);
        if (cancelled) return;
        setInvite(res.data);
        setNotes(res.data?.notes_admin || '');
      } catch {
        toast.error('Erro ao carregar convite.');
        onClose?.();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inviteId]);

  useEffect(() => {
    api.get('/pitch-deck/invites/options/admins')
      .then((r) => setAdmins(r.data || []))
      .catch(() => {});
  }, []);

  async function refresh() {
    try {
      const res = await api.get(`/pitch-deck/invites/${inviteId}`);
      setInvite(res.data);
    } catch {}
  }

  async function assign(adminId) {
    setAssigning(true);
    try {
      await api.post(`/pitch-deck/invites/${inviteId}/assign`, { admin_id: adminId || null });
      toast.success(adminId ? 'Atribuído.' : 'Atribuição removida.');
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao atribuir.');
    } finally {
      setAssigning(false);
    }
  }

  async function addComment() {
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      await api.post(`/pitch-deck/invites/${inviteId}/comments`, { body: commentText.trim() });
      setCommentText('');
      toast.success('Comentário adicionado.');
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao comentar.');
    } finally {
      setPostingComment(false);
    }
  }

  async function deleteComment(commentId) {
    if (!confirm('Excluir este comentário?')) return;
    try {
      await api.delete(`/pitch-deck/invites/${inviteId}/comments/${commentId}`);
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao excluir.');
    }
  }

  async function purgeData() {
    setPurging(true);
    try {
      await api.post(`/pitch-deck/invites/${inviteId}/purge-data`);
      toast.success('Dados pessoais apagados (LGPD).');
      setPurgeOpen(false);
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao apagar.');
    } finally {
      setPurging(false);
    }
  }

  async function exportPptx() {
    if (!invite?.converted_pitch_deck_id) return;
    try {
      const res = await api.get(`/pitch-deck/${invite.converted_pitch_deck_id}/download-pptx`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pitch-deck-${invite.converted_pitch_deck_id}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao exportar PPTX.');
    }
  }

  async function saveNotes() {
    setSaving(true);
    try {
      await api.patch(`/pitch-deck/invites/${inviteId}`, { notes_admin: notes });
      toast.success('Notas salvas.');
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function convert() {
    setConverting(true);
    try {
      const res = await api.post(`/pitch-deck/invites/${inviteId}/convert`);
      toast.success('Pitch Deck criado!');
      onConverted?.(res.data.pitch_deck_id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao converter.');
    } finally {
      setConverting(false);
    }
  }

  async function reject() {
    if (!confirm('Rejeitar este convite? O cliente não poderá mais enviar.')) return;
    setRejecting(true);
    try {
      await api.post(`/pitch-deck/invites/${inviteId}/reject`);
      toast.success('Convite rejeitado.');
      onChanged?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao rejeitar.');
    } finally {
      setRejecting(false);
    }
  }

  async function submitRequestChanges() {
    if (requestChangesText.trim().length < 10) {
      toast.error('Descreva os ajustes em pelo menos 10 caracteres.');
      return;
    }
    setRequestingChanges(true);
    try {
      await api.post(`/pitch-deck/invites/${inviteId}/request-changes`, {
        message: requestChangesText.trim(),
        send_email: requestChangesSendEmail,
      });
      toast.success(requestChangesSendEmail ? 'Pedido enviado ao cliente.' : 'Status atualizado para PENDING.');
      setRequestChangesOpen(false);
      setRequestChangesText('');
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao pedir ajustes.');
    } finally {
      setRequestingChanges(false);
    }
  }

  const sub = invite?.submission_data || {};
  const isFinal = invite?.status === 'converted' || invite?.status === 'rejected';
  const noSubmission = !invite?.submitted_at;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full max-w-2xl h-full overflow-y-auto shadow-2xl ${
          isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`sticky top-0 z-10 flex items-center justify-between p-5 border-b ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div>
            <h3 className="font-semibold text-base">Revisão do convite</h3>
            {invite && (
              <p className="text-xs text-slate-500 mt-0.5">
                Status: <span className="font-medium">{invite.status}</span>
                {invite.is_expired && <span className="ml-2 text-red-500">vencido</span>}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading || !invite ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Score + SLA */}
            {invite.score && (
              <ScorePanel score={invite.score} slaBreached={invite.sla_breached} isDark={isDark} />
            )}

            {/* Atribuição */}
            <Section title="Atribuição">
              <div className="flex items-center gap-2">
                <UserCog className="w-4 h-4 text-slate-400" />
                <select
                  value={invite.assigned_admin_id || ''}
                  disabled={assigning || isFinal}
                  onChange={(e) => assign(e.target.value || null)}
                  className={`flex-1 text-sm px-3 py-2 rounded-lg border ${
                    isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <option value="">— Não atribuído —</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </Section>

            {/* Metadata */}
            <Section title="Convite">
              <KV label="Cliente" value={invite.client_name || '—'} />
              <KV label="E-mail" value={invite.client_email || '—'} />
              <KV label="Empresa (dica)" value={invite.company_hint || '—'} />
              <KV label="Criado em" value={new Date(invite.created_at).toLocaleString('pt-BR')} />
              <KV label="Expira em" value={new Date(invite.expires_at).toLocaleDateString('pt-BR')} />
              {invite.last_email_sent_at && (
                <KV label="Último e-mail" value={new Date(invite.last_email_sent_at).toLocaleString('pt-BR')} />
              )}
            </Section>

            {/* Notas admin */}
            <Section title="Notas internas">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Observações internas sobre este convite..."
                className={`w-full px-3 py-2 rounded-lg text-sm border ${
                  isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                }`}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={saveNotes}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar notas'}
                </button>
              </div>
            </Section>

            {/* Submissão */}
            <Section title="Dados enviados pelo cliente">
              {noSubmission ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                  O cliente ainda não preencheu este convite.
                </div>
              ) : (
                <div className="space-y-3">
                  <KV label="Empresa" value={sub.company_name} />
                  <KV label="Setor" value={sub.sector} />
                  <KV label="Slogan" value={sub.slogan} />
                  <KV label="Contato" value={[sub.contact_email, sub.contact_phone].filter(Boolean).join(' • ')} />
                  <KV label="Website" value={sub.website} />
                  <Long label="Headline" value={sub.headline} />
                  <Long label="Problema" value={sub.problem} />
                  <Long label="Solução" value={sub.solution} />
                  <Long label="Modelo de negócio" value={sub.business_model} />
                  <Long label="Canais de venda" value={sub.sales_channels} />
                  <Long label="Marketing" value={sub.marketing_activities} />
                  {sub.target_market && <JsonBlock label="Mercado-alvo" value={sub.target_market} />}
                  {sub.competitive_landscape && <JsonBlock label="Concorrência" value={sub.competitive_landscape} />}
                  {sub.funding_needs && <JsonBlock label="Necessidade de captação" value={sub.funding_needs} />}
                  {sub.financial_projections && <JsonBlock label="Projeções financeiras" value={sub.financial_projections} />}
                  {sub.milestones && <JsonBlock label="Marcos" value={sub.milestones} />}
                  {sub.team && <JsonBlock label="Time" value={sub.team} />}
                  {sub.partners_resources && <JsonBlock label="Parceiros / recursos" value={sub.partners_resources} />}
                </div>
              )}
            </Section>

            {/* Anexos */}
            {invite.attachments && invite.attachments.length > 0 && (
              <Section title={`Anexos (${invite.attachments.length})`}>
                <ul className="space-y-1.5 text-sm">
                  {invite.attachments.map((a, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                      <span className="truncate">{a.name}</span>
                      <a
                        href={resolveAttachmentUrl(a.path)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-purple-500 hover:underline"
                      >
                        abrir
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Comentários internos */}
            <Section title={`Comentários internos (${invite.comments?.length || 0})`}>
              <div className="space-y-2">
                {(invite.comments || []).map((c) => (
                  <div key={c.id} className={`rounded-lg border px-3 py-2 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {c.admin_name || 'admin'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                        <button onClick={() => deleteComment(c.id)} className="text-slate-400 hover:text-red-500" title="Excluir">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
                {(!invite.comments || invite.comments.length === 0) && (
                  <p className="text-xs text-slate-400 italic">Sem comentários.</p>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addComment(); }}
                  placeholder="Adicionar comentário..."
                  className={`flex-1 text-sm px-3 py-2 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
                />
                <button
                  onClick={addComment}
                  disabled={postingComment || !commentText.trim()}
                  className="px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 disabled:opacity-50 flex items-center gap-1"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Enviar
                </button>
              </div>
            </Section>

            {/* LGPD purge */}
            <Section title="LGPD">
              <button
                onClick={() => setPurgeOpen(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Apagar dados pessoais (LGPD)
              </button>
              <p className="text-[10px] text-slate-400 mt-1">Remove e-mail, nome, conteúdo da submissão e anexos do convite.</p>
            </Section>

            {/* Ações finais */}
            {!isFinal && (
              <div className={`sticky bottom-0 -mx-5 px-5 py-4 border-t ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'} flex justify-between gap-2 flex-wrap`}>
                <button
                  onClick={reject}
                  disabled={rejecting || converting}
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Rejeitar
                </button>
                {!noSubmission && (
                  <button
                    onClick={() => setRequestChangesOpen(true)}
                    disabled={converting || rejecting}
                    className="px-3 py-2 rounded-xl text-sm font-medium border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 disabled:opacity-50 flex items-center gap-2"
                    title="Devolver para o cliente editar sem rejeitar"
                  >
                    <Edit3 className="w-4 h-4" />
                    Pedir ajustes
                  </button>
                )}
                <button
                  onClick={convert}
                  disabled={converting || rejecting || noSubmission}
                  className="flex-1 min-w-[180px] px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 flex items-center justify-center gap-2"
                  title={noSubmission ? 'Aguardando preenchimento do cliente' : 'Gerar Pitch Deck a partir desta submissão'}
                >
                  {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Gerar Pitch Deck
                </button>
              </div>
            )}

            {invite.status === 'converted' && invite.converted_pitch_deck_id && (
              <div className="rounded-xl border border-emerald-300 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 p-4 flex items-center justify-between gap-2">
                <span className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Pitch Deck já gerado.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportPptx}
                    className="text-xs px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> PPTX
                  </button>
                  <button
                    onClick={() => onConverted?.(invite.converted_pitch_deck_id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" /> Abrir
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={purgeOpen}
        title="Apagar dados pessoais (LGPD)"
        message="Esta ação remove e-mail, nome, conteúdo da submissão e anexos. Confirma?"
        confirmLabel="Apagar"
        variant="danger"
        loading={purging}
        onConfirm={purgeData}
        onCancel={() => setPurgeOpen(false)}
      />

      {requestChangesOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setRequestChangesOpen(false)}>
          <div className={`w-full max-w-md rounded-2xl p-5 shadow-2xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-base mb-2 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-amber-500" /> Pedir ajustes ao cliente
            </h4>
            <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              O convite volta para PENDING. O cliente continua editando o mesmo formulário.
            </p>
            <textarea
              value={requestChangesText}
              onChange={(e) => setRequestChangesText(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="Ex: Por favor adicione mais detalhes sobre a tração nos últimos 6 meses, e revise os números de SAM/SOM..."
              className={`w-full px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-amber-500`}
            />
            <label className="mt-3 flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={requestChangesSendEmail}
                onChange={(e) => setRequestChangesSendEmail(e.target.checked)}
                className="accent-amber-600"
              />
              Enviar e-mail ao cliente com a mensagem
            </label>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRequestChangesOpen(false)}
                className={`px-4 py-2 rounded-lg text-sm border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-700'}`}
              >
                Cancelar
              </button>
              <button
                onClick={submitRequestChanges}
                disabled={requestingChanges || requestChangesText.trim().length < 10}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 flex items-center gap-2"
              >
                {requestingChanges ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                Pedir ajustes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScorePanel({ score, slaBreached, isDark }) {
  const lvl = score.level || 'poor';
  const colorMap = {
    excellent: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40',
    good:      'bg-blue-500/15 text-blue-600 border-blue-500/40',
    fair:      'bg-amber-500/15 text-amber-600 border-amber-500/40',
    poor:      'bg-red-500/15 text-red-600 border-red-500/40',
  };
  const labelMap = { excellent: 'Excelente', good: 'Bom', fair: 'Razoável', poor: 'Incompleto' };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[lvl]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5" />
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80">Completude</div>
            <div className="text-2xl font-bold">{score.score}/100 — {labelMap[lvl]}</div>
          </div>
        </div>
        {slaBreached && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-red-500/15 text-red-600">
            <AlertTriangle className="w-3.5 h-3.5" /> SLA &gt;48h
          </span>
        )}
      </div>
      {Array.isArray(score.missing) && score.missing.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs cursor-pointer opacity-80">Itens faltantes ({score.missing.length})</summary>
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs opacity-90">
            {score.missing.map((m, i) => <li key={i}>• {m}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function KV({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 text-slate-400 text-xs uppercase tracking-wider pt-0.5">{label}</span>
      <span className="flex-1 break-words">{value}</span>
    </div>
  );
}

function Long({ label, value }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <p className="whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}

function JsonBlock({ label, value }) {
  return (
    <div className="text-sm">
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <pre className="text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
