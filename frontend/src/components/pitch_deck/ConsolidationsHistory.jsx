import { useEffect, useState } from 'react';
import { X, Loader2, Download, Trash2, Copy, RefreshCcw, FileText, CheckCircle2, XCircle, Clock, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import ConfirmDialog from '../ConfirmDialog';

const STATUS_META = {
  pending:    { label: 'Aguardando', icon: Clock, cls: 'text-slate-500 bg-slate-500/10' },
  processing: { label: 'Processando', icon: Loader2, cls: 'text-amber-500 bg-amber-500/10', spin: true },
  ready:      { label: 'Pronto', icon: CheckCircle2, cls: 'text-emerald-500 bg-emerald-500/10' },
  failed:     { label: 'Falhou', icon: XCircle, cls: 'text-red-500 bg-red-500/10' },
};

/**
 * Painel de histórico de consolidações (lista + ações).
 * Props: { open, isDark, onClose, onDuplicate(consolidation) }
 */
export default function ConsolidationsHistory({ open, isDark, onClose, onDuplicate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [delConfirm, setDelConfirm] = useState({ open: false, id: null });
  const [busy, setBusy] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);

  useEffect(() => {
    if (!open) {
      setPreviewId(null);
      if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
      return;
    }
    fetchItems();
    const id = setInterval(() => {
      // refresh leve enquanto há jobs em processamento
      if (items.some((c) => c.status === 'processing' || c.status === 'pending')) fetchItems();
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchItems() {
    setLoading(true);
    try {
      const r = await api.get('/pitch-deck/consolidations');
      setItems(r.data || []);
    } catch {
      toast.error('Erro ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await api.delete(`/pitch-deck/consolidations/${delConfirm.id}`);
      toast.success('Consolidação excluída.');
      setDelConfirm({ open: false, id: null });
      if (previewId === delConfirm.id) {
        setPreviewId(null);
        if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
      }
      fetchItems();
    } catch {
      toast.error('Erro ao excluir.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadFile(id, kind) {
    try {
      const r = await api.get(`/pitch-deck/consolidations/${id}/${kind}`, { responseType: 'blob' });
      const blob = new Blob([r.data], {
        type: kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consolidacao-${id}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      toast.error(`Erro ao baixar ${kind.toUpperCase()}.`);
    }
  }

  async function openPreview(id) {
    if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
    setPreviewId(id);
    try {
      const r = await api.get(`/pitch-deck/consolidations/${id}/pdf?inline=true`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      setPreviewBlobUrl(url);
    } catch {
      toast.error('Erro ao carregar preview.');
      setPreviewId(null);
    }
  }

  if (!open) return null;

  const cardCls = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const txt = isDark ? 'text-white' : 'text-slate-900';
  const subtxt = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`w-full max-w-6xl my-auto rounded-2xl border shadow-2xl flex flex-col ${cardCls}`}
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            <h2 className={`font-semibold ${txt}`}>Histórico de Consolidações</h2>
            <span className={`text-xs ${subtxt}`}>({items.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={fetchItems} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`} title="Atualizar">
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Lista */}
          <div className={`w-[42%] border-r overflow-y-auto ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Inbox className={`w-10 h-10 mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                <p className={`text-sm ${subtxt}`}>Nenhuma consolidação ainda.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200/50 dark:divide-slate-800">
                {items.map((c) => {
                  const meta = STATUS_META[c.status] || STATUS_META.pending;
                  const Icon = meta.icon;
                  const isSel = previewId === c.id;
                  return (
                    <li
                      key={c.id}
                      onClick={() => c.has_pdf && openPreview(c.id)}
                      className={`px-4 py-3 cursor-pointer transition ${
                        isSel
                          ? (isDark ? 'bg-purple-900/20' : 'bg-purple-50')
                          : (isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate ${txt}`}>
                            {c.title || `Consolidação · ${c.invite_ids?.length || 0} decks`}
                          </div>
                          <div className={`text-xs mt-0.5 ${subtxt}`}>
                            {new Date(c.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            {' · '}{c.invite_ids?.length || 0} decks
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.cls}`}>
                              <Icon className={`w-3 h-3 ${meta.spin ? 'animate-spin' : ''}`} />
                              {meta.label}
                            </span>
                            {(c.status === 'pending' || c.status === 'processing') && (
                              <span className={`text-[10px] ${subtxt}`}>{c.progress_pct}%</span>
                            )}
                          </div>
                          {c.status === 'failed' && c.error && (
                            <div className="text-[11px] text-red-500 mt-1 truncate" title={c.error}>{c.error}</div>
                          )}
                        </div>
                      </div>
                      {c.status === 'ready' && (
                        <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => downloadFile(c.id, 'pdf')}
                            className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                          >
                            <Download className="w-3 h-3" /> PDF
                          </button>
                          {c.has_pptx && (
                            <button
                              onClick={() => downloadFile(c.id, 'pptx')}
                              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                              <Download className="w-3 h-3" /> PPTX
                            </button>
                          )}
                          <button
                            onClick={() => onDuplicate?.(c)}
                            className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded ${isDark ? 'bg-purple-900/30 hover:bg-purple-900/50 text-purple-300' : 'bg-purple-50 hover:bg-purple-100 text-purple-700'}`}
                            title="Duplicar e editar"
                          >
                            <Copy className="w-3 h-3" /> Duplicar
                          </button>
                          <button
                            onClick={() => setDelConfirm({ open: true, id: c.id })}
                            className={`ml-auto p-1 rounded ${isDark ? 'text-red-400 hover:bg-red-900/30' : 'text-red-500 hover:bg-red-50'}`}
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col bg-slate-950/40">
            {previewBlobUrl ? (
              <iframe
                title="Preview PDF"
                src={previewBlobUrl}
                className="w-full h-full border-0"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <FileText className={`w-12 h-12 mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                <p className={`text-sm ${subtxt}`}>
                  {previewId ? 'Carregando preview...' : 'Selecione uma consolidação pronta para visualizar.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={delConfirm.open}
        title="Excluir consolidação"
        message="Esta ação remove o PDF/PPTX e o registro. Não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
        loading={busy}
        onConfirm={handleDelete}
        onCancel={() => setDelConfirm({ open: false, id: null })}
      />
    </div>
  );
}
