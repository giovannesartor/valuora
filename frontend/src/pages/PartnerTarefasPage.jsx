import { useState, useEffect } from 'react';
import {
  ListTodo, Plus, Check, Trash2, Calendar, User, Clock,
  Loader2, Filter, ChevronDown, X, Edit3, StickyNote,
  MessageSquare, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import { useTranslation } from 'react-i18next';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente', color: 'bg-amber-500', textColor: 'text-amber-500' },
  { value: 'done', label: 'Concluída', color: 'bg-emerald-500', textColor: 'text-emerald-500' },
  { value: 'cancelled', label: 'Cancelada', color: 'bg-red-500', textColor: 'text-red-500' },
];

export default function PartnerTarefasPage() {
  const { t } = useTranslation();
  usePageTitle(t('ptp_page_title'));
  const { isDark } = useTheme();
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', client_id: '' });

  // Notes state
  const [activeClientNotes, setActiveClientNotes] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => { loadData(); }, [filter]);

  const loadData = async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const [tasksRes, clientsRes] = await Promise.all([
        api.get(`/partners/tasks${params}`),
        api.get('/partners/clients?page_size=100'),
      ]);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setClients(clientsRes.data.items || []);
    } catch (err) {
      toast.error(t('ptp_load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error(t('ptp_title_required')); return; }
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        due_date: form.due_date || null,
        client_id: form.client_id || null,
      };
      await api.post('/partners/tasks', payload);
      toast.success(t('ptp_created'));
      setShowForm(false);
      setForm({ title: '', description: '', due_date: '', client_id: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('ptp_create_error'));
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await api.patch(`/partners/tasks/${taskId}`, { status: newStatus });
      toast.success(newStatus === 'done' ? t('ptp_completed') : t('ptp_status_updated'));
      loadData();
    } catch {
      toast.error(t('ptp_update_error'));
    }
  };

  const handleDelete = async (taskId) => {
    try {
      await api.delete(`/partners/tasks/${taskId}`);
      toast.success(t('ptp_deleted'));
      loadData();
    } catch {
      toast.error(t('ptp_delete_error'));
    }
  };

  // Notes functions
  const openNotes = async (clientId) => {
    setActiveClientNotes(clientId);
    setLoadingNotes(true);
    try {
      const res = await api.get(`/partners/clients/${clientId}/notes`);
      setNotes(res.data);
    } catch {
      toast.error(t('ptp_notes_load_error'));
    } finally {
      setLoadingNotes(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !activeClientNotes) return;
    try {
      await api.post(`/partners/clients/${activeClientNotes}/notes`, { content: newNote });
      setNewNote('');
      openNotes(activeClientNotes);
      toast.success('Anotação adicionada');
    } catch {
      toast.error(t('ptp_note_add_error'));
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await api.delete(`/partners/clients/${activeClientNotes}/notes/${noteId}`);
      openNotes(activeClientNotes);
    } catch {
      toast.error(t('ptp_note_delete_error'));
    }
  };

  const card = `rounded-2xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`;
  const overdueTasks = tasks.filter(t => t.status === 'pending' && t.due_date && new Date(t.due_date) < new Date());
  const todayTasks = tasks.filter(t => {
    if (t.status !== 'pending' || !t.due_date) return false;
    const d = new Date(t.due_date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const activeClientName = clients.find(c => c.id === activeClientNotes)?.client_name;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <ListTodo className="w-7 h-7 inline-block mr-2 text-emerald-500" />
            Tarefas &amp; Anotações
          </h1>
          <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Organize o relacionamento com seus clientes — tarefas, lembretes e anotações.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingTask(null); setForm({ title: '', description: '', due_date: '', client_id: '' }); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition"
        >
          <Plus className="w-4 h-4" /> Nova tarefa
        </button>
      </div>

      {/* Quick stats */}
      {(overdueTasks.length > 0 || todayTasks.length > 0) && (
        <div className="flex gap-3">
          {overdueTasks.length > 0 && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
            }`}>
              <AlertCircle className="w-4 h-4" />
              {overdueTasks.length} tarefa{overdueTasks.length > 1 ? 's' : ''} atrasada{overdueTasks.length > 1 ? 's' : ''}
            </div>
          )}
          {todayTasks.length > 0 && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'
            }`}>
              <Clock className="w-4 h-4" />
              {todayTasks.length} para hoje
            </div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'pending', label: 'Pendentes' },
          { key: 'done', label: 'Concluídas' },
          { key: 'cancelled', label: 'Canceladas' },
          { key: 'all', label: 'Todas' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
              filter === f.key
                ? 'bg-emerald-500 text-white'
                : isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* New task form */}
      {showForm && (
        <div className={`${card} p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Nova tarefa
            </h3>
            <button onClick={() => setShowForm(false)}>
              <X className={`w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </button>
          </div>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t('ptp_task_placeholder')}
            className={`w-full px-4 py-3 rounded-xl border text-sm ${
              isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
          />
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Descrição (opcional)"
            rows={2}
            className={`w-full px-4 py-3 rounded-xl border text-sm ${
              isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Prazo</label>
              <input
                type="datetime-local"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border text-sm ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
              />
            </div>
            <div>
              <label className={`text-xs font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cliente (opcional)</label>
              <select
                value={form.client_id}
                onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border text-sm ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
              >
                <option value="">Sem cliente vinculado</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.client_name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition"
          >
            Criar tarefa
          </button>
        </div>
      )}

      {/* Tasks list */}
      {tasks.length === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <ListTodo className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
          <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
            {filter === 'pending' ? 'Nenhuma tarefa pendente' : 'Nenhuma tarefa encontrada'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const statusConf = STATUS_OPTIONS.find(s => s.value === task.status) || STATUS_OPTIONS[0];
            const isOverdue = task.status === 'pending' && task.due_date && new Date(task.due_date) < new Date();
            const dueDate = task.due_date ? new Date(task.due_date) : null;

            return (
              <div key={task.id} className={`${card} p-4 group`}>
                <div className="flex items-start gap-3">
                  {/* Status toggle */}
                  <button
                    onClick={() => handleUpdateStatus(task.id, task.status === 'pending' ? 'done' : 'pending')}
                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
                      task.status === 'done'
                        ? 'bg-emerald-500 border-emerald-500'
                        : isDark ? 'border-slate-600 hover:border-emerald-500' : 'border-slate-300 hover:border-emerald-500'
                    }`}
                  >
                    {task.status === 'done' && <Check className="w-3 h-3 text-white" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      task.status === 'done'
                        ? 'line-through ' + (isDark ? 'text-slate-600' : 'text-slate-400')
                        : isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {task.client_name && (
                        <button
                          onClick={() => openNotes(task.client_id)}
                          className={`flex items-center gap-1 text-xs ${isDark ? 'text-slate-400 hover:text-emerald-400' : 'text-slate-500 hover:text-emerald-600'} transition`}
                        >
                          <User className="w-3 h-3" /> {task.client_name}
                          <StickyNote className="w-3 h-3 ml-1" />
                        </button>
                      )}
                      {dueDate && (
                        <span className={`flex items-center gap-1 text-xs ${
                          isOverdue ? 'text-red-500 font-medium' : isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          <Calendar className="w-3 h-3" />
                          {dueDate.toLocaleDateString('pt-BR')} {dueDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {isOverdue && ' (atrasada)'}
                        </span>
                      )}
                      {task.auto_generated && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                        }`}>
                          Auto
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(task.id, 'cancelled')}
                        title="Cancelar"
                        className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(task.id)}
                      title="Excluir"
                      className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-red-500/10 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Client notes panel */}
      {activeClientNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <StickyNote className="w-5 h-5 inline mr-2 text-emerald-500" />
                Anotações — {activeClientName || 'Cliente'}
              </h3>
              <button onClick={() => setActiveClientNotes(null)}>
                <X className={`w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              </button>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {loadingNotes ? (
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
              ) : notes.length === 0 ? (
                <p className={`text-center text-sm ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  Nenhuma anotação ainda
                </p>
              ) : (
                notes.map(note => (
                  <div key={note.id} className={`rounded-xl p-3 ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'} group`}>
                    <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {note.content}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                        {new Date(note.created_at).toLocaleString('pt-BR')}
                      </span>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 transition text-red-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add note */}
            <div className={`p-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNote()}
                  placeholder="Nova anotação..."
                  className={`flex-1 px-4 py-2.5 rounded-xl border text-sm ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                />
                <button
                  onClick={addNote}
                  disabled={!newNote.trim()}
                  className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
