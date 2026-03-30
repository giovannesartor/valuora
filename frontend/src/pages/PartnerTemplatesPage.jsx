import { useEffect, useState } from 'react';
import { FileText, Plus, Trash2, Edit3, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../lib/i18n';
import ConfirmDialog from '../components/ConfirmDialog';

const CATEGORIES = ['proposal', 'followup', 'onboarding', 'report', 'general'];

export default function PartnerTemplatesPage() {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', content: '', category: 'general' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/partners/templates');
      setTemplates(data);
    } catch { toast.error('Failed to load templates'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) return toast.error('Name and content are required');
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/partners/templates/${editingId}`, form);
        toast.success('Template updated');
      } else {
        await api.post('/partners/templates', form);
        toast.success('Template created');
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', content: '', category: 'general' });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleEdit = (tpl) => {
    setForm({ name: tpl.name, content: tpl.content, category: tpl.category || 'general' });
    setEditingId(tpl.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/partners/templates/${deleteConfirm.id}`);
      toast.success('Template deleted');
      setDeleteConfirm({ open: false, id: null });
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const card = `border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Proposal Templates</h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Reusable message templates for proposals, follow-ups, and client communication
          </p>
        </div>
        <button
          onClick={() => { setForm({ name: '', content: '', category: 'general' }); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className={`${card} mb-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {editingId ? 'Edit Template' : 'New Template'}
            </h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className={`p-1 rounded ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Template name"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/40 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            />
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              rows={6}
              placeholder="Template content... Use {name} for client name placeholder"
              className={`w-full rounded-xl border px-4 py-3 text-sm resize-none outline-none transition focus:ring-2 focus:ring-emerald-500/40 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className={`h-20 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />)}
        </div>
      ) : templates.length === 0 ? (
        <div className={`${card} text-center py-12`}>
          <FileText className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
          <p className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No templates yet</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Create your first template to speed up client communication</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(tpl => (
            <div key={tpl.id} className={`${card} group`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{tpl.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {tpl.category || 'general'}
                    </span>
                  </div>
                  <p className={`text-xs line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{tpl.content}</p>
                </div>
                <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => handleEdit(tpl)} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(tpl.content); toast.success('Copied!'); }} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteConfirm({ open: true, id: tpl.id })} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Template"
        message="Are you sure? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </div>
  );
}
