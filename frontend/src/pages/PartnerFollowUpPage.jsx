import { useState, useEffect, useMemo } from 'react';
import { Users, Bell, Clock, Search, Filter, ChevronDown, Mail, Phone, MessageSquare, Loader2, Calendar } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  due_today: { label: 'Due Today', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  upcoming: { label: 'Upcoming', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

export default function PartnerFollowUpPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('next_contact');

  useEffect(() => {
    fetchFollowUps();
  }, []);

  const fetchFollowUps = async () => {
    try {
      const { data } = await api.get('/partner/follow-ups');
      setClients(data);
    } catch {
      toast.error('Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  };

  const markContacted = async (clientId) => {
    try {
      await api.post(`/partner/follow-ups/${clientId}/contacted`);
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, status: 'completed', last_contact: new Date().toISOString() } : c)),
      );
      toast.success('Marked as contacted');
    } catch {
      toast.error('Failed to update');
    }
  };

  const getStatus = (client) => {
    if (client.status === 'completed') return 'completed';
    if (!client.next_contact) return 'upcoming';
    const next = new Date(client.next_contact);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (next < today) return 'overdue';
    if (next < tomorrow) return 'due_today';
    return 'upcoming';
  };

  const filtered = useMemo(() => {
    let result = clients.map((c) => ({ ...c, _status: getStatus(c) }));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      result = result.filter((c) => c._status === statusFilter);
    }
    result.sort((a, b) => {
      if (sortBy === 'next_contact') {
        const aDate = a.next_contact ? new Date(a.next_contact) : new Date('9999-12-31');
        const bDate = b.next_contact ? new Date(b.next_contact) : new Date('9999-12-31');
        return aDate - bDate;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
    return result;
  }, [clients, search, statusFilter, sortBy]);

  const stats = useMemo(() => {
    const all = clients.map((c) => ({ ...c, _status: getStatus(c) }));
    return {
      overdue: all.filter((c) => c._status === 'overdue').length,
      due_today: all.filter((c) => c._status === 'due_today').length,
      upcoming: all.filter((c) => c._status === 'upcoming').length,
      completed: all.filter((c) => c._status === 'completed').length,
    };
  }, [clients]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Bell className="w-7 h-7 text-emerald-500" />
          Follow-Ups
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Stay on top of client communications and scheduled contact points.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(stats).map(([key, count]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            className={`rounded-xl border p-3 text-left transition-colors ${
              statusFilter === key
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
            }`}
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">{STATUS_CONFIG[key].label}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{count}</p>
          </button>
        ))}
      </div>

      {/* Search / Sort */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500"
        >
          <option value="next_contact">Sort by date</option>
          <option value="name">Sort by name</option>
        </select>
      </div>

      {/* Follow-up list */}
      <div className="space-y-2">
        {filtered.map((client) => {
          const statusCfg = STATUS_CONFIG[client._status];
          return (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-bold text-sm">
                {(client.name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-slate-900 dark:text-white">{client.name || 'Unknown'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>
                {client.email && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{client.email}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  {client.next_contact && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Next: {new Date(client.next_contact).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {client.last_contact && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last: {new Date(client.last_contact).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick-action buttons */}
              <div className="flex items-center gap-1">
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="p-2 text-slate-400 hover:text-emerald-500 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    title="Send email"
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                )}
                {client.phone && (
                  <a
                    href={`tel:${client.phone}`}
                    className="p-2 text-slate-400 hover:text-emerald-500 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    title="Call"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                {client._status !== 'completed' && (
                  <button
                    onClick={() => markContacted(client.id)}
                    className="ml-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                  >
                    Mark Contacted
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            {search ? 'No matches found.' : 'No follow-ups scheduled.'}
          </div>
        )}
      </div>
    </div>
  );
}
