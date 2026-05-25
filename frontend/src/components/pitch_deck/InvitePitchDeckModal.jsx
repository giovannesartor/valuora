import { useState } from 'react';
import { X, Send, Sparkles, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function InvitePitchDeckModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    client_email:    '',
    client_name:     '',
    company_hint:    '',
    admin_message:   '',
    expires_in_days: 14,
    send_email:      true,
    language:        'pt',
  });
  const [aiUrl, setAiUrl]           = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleAiExtract() {
    if (!aiUrl.trim()) { toast.error('Informe uma URL para extrair.'); return; }
    setAiLoading(true);
    try {
      const { data } = await api.post('/pitch-deck/invites/ai-extract', { url: aiUrl.trim(), crawl_subpages: true });
      const d = data.extracted || data;
      // Fill in company hint from extracted data
      if (d.company_name) set('company_hint', d.company_name);
      toast.success('Dados extraídos! Serão enviados como rascunho ao cliente.');
      // store prefill for submission
      setForm(prev => ({ ...prev, _prefill: data }));
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? 'Erro ao extrair dados.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        client_email:    form.client_email || undefined,
        client_name:     form.client_name  || undefined,
        company_hint:    form.company_hint || undefined,
        admin_message:   form.admin_message || undefined,
        expires_in_days: Number(form.expires_in_days),
        send_email:      form.send_email,
        language:        form.language,
        prefill_data:    form._prefill ?? undefined,
      };
      const { data } = await api.post('/pitch-deck/invites', payload);
      toast.success(
        form.send_email && form.client_email
          ? `Convite enviado para ${form.client_email}!`
          : 'Convite criado! Copie o link e envie manualmente.',
        { duration: 5000 }
      );
      if (data.public_url && !form.send_email) {
        navigator.clipboard?.writeText(data.public_url).catch(() => {});
      }
      onCreated?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? 'Erro ao criar convite.');
    } finally {
      setSubmitting(false);
    }
  }

  const labelCls = 'block text-xs font-semibold mb-1 text-slate-400 uppercase tracking-wide';
  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold text-base">Enviar convite de Pitch Deck</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* AI pre-fill */}
          <div className="rounded-xl bg-purple-950/30 border border-purple-700/30 p-4 space-y-2">
            <label className={labelCls}>Pré-preencher com IA (opcional)</label>
            <p className="text-xs text-slate-400 mb-2">Informe o site da empresa e a IA extrai os dados para o cliente receber o formulário já parcialmente preenchido.</p>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://empresa.com.br"
                value={aiUrl}
                onChange={e => setAiUrl(e.target.value)}
                className={inputCls + ' flex-1'}
              />
              <button
                type="button"
                onClick={handleAiExtract}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium disabled:opacity-50 transition whitespace-nowrap"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Extrair
              </button>
            </div>
          </div>

          {/* Client info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nome do cliente</label>
              <input className={inputCls} placeholder="João Silva" value={form.client_name} onChange={e => set('client_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>E-mail do cliente</label>
              <input className={inputCls} type="email" placeholder="joao@empresa.com" value={form.client_email} onChange={e => set('client_email', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Nome da empresa (dica)</label>
            <input className={inputCls} placeholder="Ex: Acme Ltda" value={form.company_hint} onChange={e => set('company_hint', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Mensagem personalizada (opcional)</label>
            <textarea className={inputCls + ' resize-none'} rows={2} placeholder="Olá! Preencha o formulário para gerarmos seu pitch deck." value={form.admin_message} onChange={e => set('admin_message', e.target.value)} />
          </div>

          {/* Options row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Validade (dias)</label>
              <input className={inputCls} type="number" min={1} max={90} value={form.expires_in_days} onChange={e => set('expires_in_days', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Idioma do PDF</label>
              <select className={inputCls} value={form.language} onChange={e => set('language', e.target.value)}>
                <option value="pt">Português</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer pb-1">
                <input type="checkbox" className="rounded accent-purple-500" checked={form.send_email} onChange={e => set('send_email', e.target.checked)} />
                <span className="text-xs text-slate-300">Enviar e-mail</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/20 disabled:opacity-50 transition">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {form.send_email ? 'Enviar convite' : 'Criar convite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
