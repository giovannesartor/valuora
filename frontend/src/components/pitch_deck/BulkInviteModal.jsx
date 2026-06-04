import { useState } from 'react';
import { X, Loader2, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

/**
 * Bulk import de convites via CSV ou colando linhas.
 * Formato esperado:  email,nome,empresa  (uma por linha)
 */
export default function BulkInviteModal({ open, isDark, onClose, onCreated }) {
  const [text, setText] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [adminMessage, setAdminMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  if (!open) return null;

  function parseCsv(raw) {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((l, idx) => {
      const cells = l.split(/[,;\t]/).map((c) => c.trim());
      // pula header se for "email,nome,empresa"
      if (idx === 0 && /e?mail/i.test(cells[0]) && cells.length > 1) return null;
      const [email, name, company] = cells;
      return { client_email: email, client_name: name || null, company_hint: company || null };
    }).filter(Boolean).filter((r) => r.client_email && /@/.test(r.client_email));
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result || ''));
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function submit() {
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error('Nenhuma linha válida encontrada.');
      return;
    }
    if (rows.length > 200) {
      toast.error('Máximo 200 convites por lote.');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.post('/pitch-deck/invites/bulk', {
        rows,
        expires_in_days: Number(expiresInDays) || 14,
        admin_message: adminMessage.trim() || null,
        send_email: sendEmail,
      });
      setResult(res.data);
      if (res.data?.created > 0) {
        toast.success(`${res.data.created} convite(s) criado(s).`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro no lote.');
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setText('');
    setResult(null);
    onClose?.();
  }

  function done() {
    setText('');
    setResult(null);
    onCreated?.();
  }

  const cardCls = isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900';
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm ${
    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={close}>
      <div className={`rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border shadow-2xl ${cardCls}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-500" />
            Convites em lote (CSV)
          </h3>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cole linhas no formato <code>email,nome,empresa</code> (uma por linha) ou envie um arquivo CSV.
                Header opcional. Máximo 200 por lote.
              </p>

              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 cursor-pointer text-xs text-slate-600 hover:border-purple-400">
                <FileText className="w-3.5 h-3.5" />
                Selecionar arquivo CSV
                <input type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={onFile} />
              </label>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder={'maria@acme.com,Maria Silva,ACME Ltda\njoao@beta.io,João Souza,Beta Tech'}
                className={inputCls + ' resize-y font-mono text-xs'}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Expira em (dias)">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm pb-2.5 cursor-pointer">
                  <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="w-4 h-4 rounded accent-purple-600" />
                  Enviar e-mails imediatamente
                </label>
              </div>

              <Field label="Mensagem (opcional, vai em todos)">
                <textarea
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  rows={2}
                  className={inputCls + ' resize-none'}
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={close} className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Cancelar
                </button>
                <button
                  onClick={submit}
                  disabled={submitting || !text.trim()}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Enviar lote
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/10 p-4 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span><b>{result.created}</b> criados, <b>{result.skipped}</b> pulados.</span>
              </div>

              {result.errors?.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-1.5 font-semibold mb-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Avisos
                  </div>
                  <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button onClick={done} className="px-5 py-2 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-500">
                  Concluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
