import { useState, useEffect } from 'react';
import { Briefcase, Users, Calendar, CheckCircle2, Clock, Loader2, Plus, Search } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function PartnerConsultingPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data } = await api.get('/partner/consulting/clients');
        setClients(data);
      } catch {
        toast.error('Failed to load consulting clients');
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, []);

  const filtered = clients.filter((c) => {
    const matchesSearch = !search || c.company_name?.toLowerCase().includes(search.toLowerCase()) || c.contact_name?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Briefcase className="w-7 h-7 text-emerald-500" />
            Consulting Pipeline
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage your consulting engagements and client relationships.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {['all', 'active', 'pending', 'completed'].map((f) => (
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
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients', value: clients.length, icon: Users },
          { label: 'Active', value: clients.filter((c) => c.status === 'active').length, icon: Calendar },
          { label: 'Completed', value: clients.filter((c) => c.status === 'completed').length, icon: CheckCircle2 },
          { label: 'Pending', value: clients.filter((c) => c.status === 'pending').length, icon: Clock },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Client Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client) => (
          <Link
            key={client.id}
            to={`/partner/clients/${client.id}`}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 dark:text-white">{client.company_name || client.contact_name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                client.status === 'active'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : client.status === 'completed'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              }`}>
                {client.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{client.contact_email || client.email}</p>
            {client.total_analyses > 0 && (
              <p className="text-xs text-slate-400 mt-2">{client.total_analyses} analyses</p>
            )}
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No clients match your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
