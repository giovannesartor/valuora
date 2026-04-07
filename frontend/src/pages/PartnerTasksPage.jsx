import { useState, useEffect } from 'react';
import { CheckSquare, Plus, Loader2, Calendar, Clock, Trash2, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';

export default function PartnerTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', client_id: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data } = await api.get('/partner/tasks');
      setTasks(data);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);
    try {
      const { data } = await api.post('/partner/tasks', {
        title: form.title,
        description: form.description || null,
        due_date: form.due_date || null,
        client_id: form.client_id || null,
      });
      setTasks((prev) => [data, ...prev]);
      setForm({ title: '', description: '', due_date: '', client_id: '' });
      setShowForm(false);
      toast.success('Task created');
    } catch {
      toast.error('Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (taskId, isComplete) => {
    try {
      await api.patch(`/partner/tasks/${taskId}`, { completed: !isComplete });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed: !isComplete } : t)),
      );
    } catch {
      toast.error('Failed to update task');
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/partner/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success('Task removed');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const filtered = tasks.filter((t) => {
    if (filter === 'pending') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <CheckSquare className="w-7 h-7 text-emerald-500" />
            Tasks
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Track follow-ups, reminders, and action items for your clients.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
        {['pending', 'completed', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === f
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && ` (${tasks.filter((t) => !t.completed).length})`}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Task title..."
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500"
              required
              autoFocus
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex gap-3">
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex-1" />
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-2">
        {filtered.map((task) => (
          <div
            key={task.id}
            className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-start gap-3 transition-opacity ${
              task.completed ? 'opacity-60' : ''
            }`}
          >
            <button
              onClick={() => toggleComplete(task.id, task.completed)}
              className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                task.completed
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
              }`}
            >
              {task.completed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-sm ${task.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                {task.title}
              </p>
              {task.description && (
                <p className="text-xs text-slate-500 mt-1">{task.description}</p>
              )}
              {task.due_date && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-1.5">
                  <Calendar className="w-3 h-3" />
                  {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
            <button
              onClick={() => deleteTask(task.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            {filter === 'pending' ? 'No pending tasks. Great job!' : 'No tasks found.'}
          </div>
        )}
      </div>
    </div>
  );
}
