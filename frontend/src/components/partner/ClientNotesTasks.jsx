import { useState, useEffect } from 'react';
import {
  FileText, Plus, Trash2, Phone, Video, RotateCcw, Send,
  CheckSquare, Square, Calendar, Clock, AlertCircle, Check, X,
} from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../lib/i18n';

const NOTE_TYPES = [
  { value: 'general', icon: FileText, key: 'crm_notes_type_general' },
  { value: 'call', icon: Phone, key: 'crm_notes_type_call' },
  { value: 'meeting', icon: Video, key: 'crm_notes_type_meeting' },
  { value: 'follow_up', icon: RotateCcw, key: 'crm_notes_type_follow_up' },
];

const NOTE_TYPE_COLORS = {
  general: 'text-slate-400',
  call: 'text-blue-400',
  meeting: 'text-purple-400',
  follow_up: 'text-amber-400',
};

export default function ClientNotesTasks({ clientId }) {
  const { isDark } = useTheme();
  const { t } = useI18n();

  // Notes state
  const [notes, setNotes] = useState([]);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [savingNote, setSavingNote] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [savingTask, setSavingTask] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    loadNotes();
    loadTasks();
  }, [clientId]);

  const loadNotes = () => {
    api.get(`/partners/clients/${clientId}/notes`)
      .then(({ data }) => setNotes(data))
      .catch(() => {})
      .finally(() => setLoadingNotes(false));
  };

  const loadTasks = () => {
    api.get(`/partners/clients/${clientId}/tasks`)
      .then(({ data }) => setTasks(data))
      .catch(() => {})
      .finally(() => setLoadingTasks(false));
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setSavingNote(true);
    try {
      const { data } = await api.post(`/partners/clients/${clientId}/notes`, {
        content: noteContent.trim(),
        note_type: noteType,
      });
      setNotes([data, ...notes]);
      setNoteContent('');
      toast.success(t('crm_notes_saved'));
    } catch {
      toast.error('Error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await api.delete(`/partners/clients/${clientId}/notes/${noteId}`);
      setNotes(notes.filter(n => n.id !== noteId));
      toast.success(t('crm_notes_deleted'));
    } catch {
      toast.error('Error');
    }
  };

  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;
    setSavingTask(true);
    try {
      const { data } = await api.post(`/partners/clients/${clientId}/tasks`, {
        title: taskTitle.trim(),
        due_date: taskDueDate ? new Date(taskDueDate).toISOString() : null,
      });
      setTasks([data, ...tasks]);
      setTaskTitle('');
      setTaskDueDate('');
      toast.success(t('crm_tasks_saved'));
    } catch {
      toast.error('Error');
    } finally {
      setSavingTask(false);
    }
  };

  const handleToggleTask = async (task) => {
    try {
      const { data } = await api.patch(`/partners/clients/${clientId}/tasks/${task.id}`, {
        is_completed: !task.is_completed,
      });
      setTasks(tasks.map(t => t.id === task.id ? data : t));
      toast.success(t('crm_tasks_updated'));
    } catch {
      toast.error('Error');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await api.delete(`/partners/clients/${clientId}/tasks/${taskId}`);
      setTasks(tasks.filter(t => t.id !== taskId));
      toast.success(t('crm_tasks_deleted'));
    } catch {
      toast.error('Error');
    }
  };

  const card = `border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;
  const inputCls = `w-full rounded-xl px-4 py-2.5 text-sm border transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`;

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };
  const isDueToday = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate).toDateString() === new Date().toDateString();
  };

  const pendingTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  return (
    <div className="space-y-4">
      {/* ── NOTES ── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('crm_notes_title')}</h3>
        </div>

        {/* Add note form */}
        <div className="flex gap-2 mb-3">
          <div className="flex gap-1">
            {NOTE_TYPES.map((nt) => {
              const Icon = nt.icon;
              return (
                <button
                  key={nt.value}
                  onClick={() => setNoteType(nt.value)}
                  title={t(nt.key)}
                  className={`p-2 rounded-lg transition ${noteType === nt.value
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isDark ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder={t('crm_notes_placeholder')}
            rows={2}
            className={`${inputCls} resize-none`}
          />
          <button
            onClick={handleAddNote}
            disabled={!noteContent.trim() || savingNote}
            className="flex-shrink-0 px-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Notes list */}
        {loadingNotes ? (
          <div className={`h-20 rounded-xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        ) : notes.length === 0 ? (
          <p className={`text-xs italic text-center py-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('crm_notes_empty')}</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {notes.map((note) => {
              const typeInfo = NOTE_TYPES.find(nt => nt.value === note.note_type) || NOTE_TYPES[0];
              const TypeIcon = typeInfo.icon;
              return (
                <div key={note.id} className={`group flex items-start gap-3 px-3 py-2.5 rounded-xl transition ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                  <TypeIcon className={`w-3.5 h-3.5 mt-1 flex-shrink-0 ${NOTE_TYPE_COLORS[note.note_type]}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{note.content}</p>
                    <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {new Date(note.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── TASKS ── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <CheckSquare className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('crm_tasks_title')}</h3>
        </div>

        {/* Add task */}
        <div className="flex gap-2 mb-4">
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder={t('crm_tasks_placeholder')}
            className={inputCls}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          />
          <input
            type="date"
            value={taskDueDate}
            onChange={(e) => setTaskDueDate(e.target.value)}
            className={`${inputCls} w-40`}
          />
          <button
            onClick={handleAddTask}
            disabled={!taskTitle.trim() || savingTask}
            className="flex-shrink-0 px-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {loadingTasks ? (
          <div className={`h-20 rounded-xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        ) : (
          <>
            {/* Pending tasks */}
            {pendingTasks.length === 0 && completedTasks.length === 0 ? (
              <p className={`text-xs italic text-center py-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('crm_tasks_empty')}</p>
            ) : (
              <div className="space-y-1.5">
                {pendingTasks.map((task) => (
                  <div key={task.id} className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                    <button onClick={() => handleToggleTask(task)} className="flex-shrink-0">
                      <Square className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{task.title}</p>
                      {task.due_date && (
                        <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${
                          isOverdue(task.due_date) ? 'text-red-400' :
                          isDueToday(task.due_date) ? 'text-amber-400' :
                          isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {isOverdue(task.due_date) ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                          {isOverdue(task.due_date) ? t('crm_tasks_overdue') : isDueToday(task.due_date) ? t('crm_tasks_due_today') : new Date(task.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Completed tasks */}
            {completedTasks.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className={`text-xs font-medium ${isDark ? 'text-slate-500 hover:text-slate-400' : 'text-slate-400 hover:text-slate-500'} transition`}
                >
                  {t('crm_tasks_completed')} ({completedTasks.length})
                </button>
                {showCompleted && (
                  <div className="space-y-1.5 mt-2">
                    {completedTasks.map((task) => (
                      <div key={task.id} className={`group flex items-center gap-3 px-3 py-2 rounded-xl opacity-60 ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                        <button onClick={() => handleToggleTask(task)} className="flex-shrink-0">
                          <CheckSquare className={`w-4 h-4 text-emerald-500`} />
                        </button>
                        <span className={`text-sm line-through ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{task.title}</span>
                        <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition ml-auto">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
