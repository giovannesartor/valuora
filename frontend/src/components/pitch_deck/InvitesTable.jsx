import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Send, Trash2, CheckCircle, XCircle, Eye, RotateCcw, Clock } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const STATUS_LABEL = {
  pending:   { label: 'Pendente',    color: 'text-amber-400  bg-amber-400/10  border-amber-400/20' },
  sent:      { label: 'Enviado',     color: 'text-blue-400   bg-blue-400/10   border-blue-400/20'  },
  opened:    { label: 'Aberto',      color: 'text-purple-400 bg-purple-400/10 border-purple-400/20'},
  submitted: { label: 'Preenchido',  color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'},
  reviewed:  { label: 'Revisado',    color: 'text-teal-400   bg-teal-400/10   border-teal-400/20'  },
  converted: { label: 'Convertido',  color: 'text-green-500  bg-green-500/10  border-green-500/20' },
  rejected:  { label: 'Rejeitado',   color: 'text-red-400    bg-red-400/10    border-red-400/20'   },
  expired:   { label: 'Expirado',    color: 'text-slate-400  bg-slate-400/10  border-slate-400/20' },
};

function Badge({ status }) {
  const s = STATUS_LABEL[status] || { label: status, color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.color}`}>
      {s.label}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InvitesTable({ isDark, onConverted }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail]   = useState(null); // selected invite for detail panel

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/pitch-deck/invites');
      setInvites(data.invites ?? data ?? []);
    } catch {
      toast.error('Erro ao carregar convites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleResend(id) {
    try {
      await api.post(`/pitch-deck/invites/${id}/resend`);
      toast.success('E-mail reenviado!');
      load();
    } catch { toast.error('Erro ao reenviar.'); }
  }

  async function handleConvert(id) {
    try {
      await api.post(`/pitch-deck/invites/${id}/convert`);
      toast.success('Pitch deck criado com sucesso!');
      setDetail(null);
      load();
      onConverted?.();
    } catch (e) { toast.error(e?.response?.data?.detail ?? 'Erro ao converter.'); }
  }

  async function handleReject(id) {
    if (!confirm('Rejeitar este convite?')) return;
    try {
      await api.post(`/pitch-deck/invites/${id}/reject`);
      toast.success('Convite rejeitado.');
      load();
    } catch { toast.error('Erro ao rejeitar.'); }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir convite permanentemente?')) return;
    try {
      await api.delete(`/pitch-deck/invites/${id}`);
      toast.success('Convite excluído.');
      if (detail?.id === id) setDetail(null);
      load();
    } catch { toast.error('Erro ao excluir.'); }
  }

  const base = isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900';
  const row  = isDark ? 'hover:bg-slate-800/60 border-slate-800' : 'hover:bg-slate-50 border-slate-100';
  const th   = isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-200';

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!invites.length) return (
    <div className={`rounded-xl border p-10 text-center ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
      <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">Nenhum convite ainda.</p>
      <p className="text-sm mt-1">Clique em "Enviar convite" para começar.</p>
    </div>
  );

  return (
    <div className={`rounded-xl border overflow-hidden ${base}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
        <span className="text-sm font-medium">{invites.length} convite(s)</span>
        <button onClick={load} className="text-slate-400 hover:text-purple-400 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b text-xs uppercase tracking-wide ${th}`}>
              {['Cliente', 'Empresa', 'Status', 'Score', 'Criado', 'Expira', 'Ações'].map(h => (
                <th key={h} className={`px-4 py-2 text-left font-semibold border-b ${th}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invites.map(inv => (
              <tr key={inv.id} className={`border-b transition ${row}`}>
                <td className="px-4 py-3 font-medium truncate max-w-[160px]">
                  {inv.client_name || <span className="italic opacity-50">—</span>}
                  {inv.client_email && <div className="text-xs opacity-50">{inv.client_email}</div>}
                </td>
                <td className="px-4 py-3 truncate max-w-[140px]">{inv.company_hint || '—'}</td>
                <td className="px-4 py-3"><Badge status={inv.status} /></td>
                <td className="px-4 py-3">
                  {inv.quality_score != null
                    ? <span className={`font-bold ${inv.quality_score >= 70 ? 'text-emerald-400' : inv.quality_score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{inv.quality_score}</span>
                    : <span className="opacity-40">—</span>}
                </td>
                <td className="px-4 py-3 text-xs opacity-70">{fmtDate(inv.created_at)}</td>
                <td className="px-4 py-3 text-xs opacity-70">
                  {inv.expires_at
                    ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(inv.expires_at)}</span>
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button title="Ver detalhes" onClick={() => setDetail(inv)} className="p-1 rounded hover:text-purple-400 transition"><Eye className="w-4 h-4" /></button>
                    {inv.status === 'submitted' && (
                      <button title="Converter em Pitch Deck" onClick={() => handleConvert(inv.id)} className="p-1 rounded hover:text-emerald-400 transition"><CheckCircle className="w-4 h-4" /></button>
                    )}
                    {['pending', 'sent', 'opened'].includes(inv.status) && (
                      <button title="Reenviar e-mail" onClick={() => handleResend(inv.id)} className="p-1 rounded hover:text-blue-400 transition"><Send className="w-4 h-4" /></button>
                    )}
                    {!['converted', 'rejected'].includes(inv.status) && (
                      <button title="Rejeitar" onClick={() => handleReject(inv.id)} className="p-1 rounded hover:text-amber-400 transition"><XCircle className="w-4 h-4" /></button>
                    )}
                    <button title="Excluir" onClick={() => handleDelete(inv.id)} className="p-1 rounded hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail side panel */}
      {detail && (
        <div className={`border-t p-4 ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Dados preenchidos — {detail.client_name || detail.client_email || 'Convite'}</h3>
            <button onClick={() => setDetail(null)} className="text-xs text-slate-400 hover:text-white">Fechar</button>
          </div>
          {detail.submission_data
            ? <pre className={`text-xs rounded-lg p-3 overflow-auto max-h-64 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-200'}`}>{JSON.stringify(detail.submission_data, null, 2)}</pre>
            : <p className="text-sm opacity-50 italic">Cliente ainda não preencheu.</p>}
          {detail.status === 'submitted' && (
            <button onClick={() => handleConvert(detail.id)} className="mt-3 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
              <CheckCircle className="w-4 h-4" /> Converter em Pitch Deck
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Inbox({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" /></svg>;
}
