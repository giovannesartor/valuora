import { useEffect, useState } from 'react';
import { Tag, Plus, Trash2, Edit2, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import formatBRL from '../lib/formatBRL';
import { useTheme } from '../context/ThemeContext';
import ConfirmDialog from '../components/ConfirmDialog';

const EMPTY_FORM = {
  code: '',
  description: '',
  discount_pct: '',
  max_uses: '',
  expires_at: '',
  is_active: true,
};

export default function AdminCouponsPage() {
  const { isDark } = useTheme();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // coupon id or null
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });

  const loadCoupons = () => {
    setLoading(true);
    api.get('/admin/coupons')
      .then(r => setCoupons(r.data))
      .catch(() => toast.error('Erro ao carregar cupons.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCoupons(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (coupon) => {
    setEditing(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discount_pct: (coupon.discount_pct * 100).toFixed(0),
      max_uses: coupon.max_uses ?? '',
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 16) : '',
      is_active: coupon.is_active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) return toast.error('Código obrigatório.');
    const pct = parseFloat(form.discount_pct);
    if (!pct || pct <= 0 || pct >= 100) return toast.error('Desconto deve estar entre 1% e 99%.');
    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description || null,
      discount_pct: pct / 100,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active: form.is_active,
    };
    try {
      if (editing) {
        await api.patch(`/admin/coupons/${editing}`, payload);
        toast.success('Cupom atualizado!');
      } else {
        await api.post('/admin/coupons', payload);
        toast.success('Cupom criado!');
      }
      setShowForm(false);
      loadCoupons();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setDeleteConfirm({ open: true, id });
  };

  const confirmDelete = async () => {
    const id = deleteConfirm.id;
    setDeleteConfirm({ open: false, id: null });
    try {
      await api.delete(`/admin/coupons/${id}`);
      toast.success('Cupom excluído.');
      loadCoupons();
    } catch {
      toast.error('Erro ao excluir.');
    }
  };

  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm';
  const input = `w-full px-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition ${
    isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  }`;

  return (
    <main className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Cupons de Desconto</h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{coupons.length} cupom(ns) cadastrado(s)</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-600/25"
          >
            <Plus className="w-4 h-4" />
            Novo Cupom
          </button>
        </div>

        {/* Create / Edit form */}
        {showForm && (
          <div className={`rounded-2xl border p-6 mb-6 ${card}`}>
            <h3 className={`font-semibold mb-5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{editing ? 'Editar Cupom' : 'Novo Cupom'}</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Código *</label>
                <input className={input} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ex: PRIMEIRA20" />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Desconto (%) *</label>
                <input className={input} type="number" min="1" max="99" value={form.discount_pct} onChange={e => setForm({ ...form, discount_pct: e.target.value })} placeholder="10" />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Descrição</label>
                <input className={input} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Uso interno" />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Máx. usos (vazio = ilimitado)</label>
                <input className={input} type="number" min="1" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} placeholder="100" />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Expiração (vazio = sem expiração)</label>
                <input className={input} type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <button onClick={() => setForm({ ...form, is_active: !form.is_active })} className="transition">
                  {form.is_active
                    ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                    : <ToggleLeft className={`w-8 h-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  }
                </button>
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{form.is_active ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className={`rounded-2xl border overflow-hidden ${card}`}>
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="p-12 text-center">
              <Tag className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
              <p className={`${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum cupom cadastrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    {['Código', 'Desconto', 'Usos', 'Expiração', 'Status', 'Ações'].map(h => (
                      <th key={h} className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400 bg-slate-800/50' : 'text-slate-500 bg-slate-50'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className={`border-b last:border-0 ${isDark ? 'border-slate-800 hover:bg-slate-800/40' : 'border-slate-100 hover:bg-slate-50'}`}>
                      <td className="px-4 py-3">
                        <code className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>{c.code}</code>
                        {c.description && <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{c.description}</p>}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{(c.discount_pct * 100).toFixed(0)}%</td>
                      <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}
                      </td>
                      <td className={`px-4 py-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${c.is_active ? 'bg-emerald-500/10 text-emerald-500' : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                          {c.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-emerald-400 transition">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-400 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Excluir cupom"
        message="Tem certeza que deseja excluir este cupom? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </main>
  );
}
