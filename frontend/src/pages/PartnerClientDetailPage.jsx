import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Phone, Building2,
  ExternalLink, Edit3, Save, X, FileText, Calendar,
  CheckCircle, Clock, BarChart2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

const STATUS_MAP = {
  pre_filled:  { label: 'Pre-filled',   color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  completed:   { label: 'Completed',         color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  report_sent: { label: 'Report sent', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
};

export default function PartnerClientDetailPage() {
  const { id } = useParams();
  const { isDark } = useTheme();
  const [client, setClient]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue]     = useState('');
  const [savingNotes, setSavingNotes]   = useState(false);

  const loadClient = () => {
    setLoading(true);
    api.get(`/partners/clients/${id}`)
      .then(({ data }) => {
        setClient(data);
        setNotesValue(data.notes || '');
      })
      .catch(() => toast.error('Error loading client.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadClient(); }, [id]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.put(`/partners/clients/${id}`, {
        client_name:    client.client_name,
        client_email:   client.client_email,
        client_company: client.client_company,
        client_phone:   client.client_phone,
        notes:          notesValue,
      });
      setClient(c => ({ ...c, notes: notesValue }));
      setEditingNotes(false);
      toast.success('Notes saved!');
    } catch {
      toast.error('Error saving notes.');
    } finally { setSavingNotes(false); }
  };

  if (loading) return (
    <div className="space-y-4 p-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className={`h-24 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
      ))}
    </div>
  );

  if (!client) return (
    <div className="p-6 text-center">
      <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Client not found.</p>
      <Link to="/partner/clients" className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-500 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
    </div>
  );

  const status = STATUS_MAP[client.data_status] || { label: client.data_status, color: 'text-slate-400', bg: 'bg-slate-500/10' };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        to="/partner/clients"
        className={`inline-flex items-center gap-1.5 text-sm mb-6 transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to clients
      </Link>

      {/* Header */}
      <div className={`border rounded-2xl p-6 mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              {client.client_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{client.client_name}</h1>
              <span className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color} ${status.bg}`}>
                {client.data_status === 'report_sent' && <CheckCircle className="w-3 h-3" />}
                {status.label}
              </span>
            </div>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Registered on {new Date(client.created_at).toLocaleDateString('en-US')}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Contact Info */}
        <div className={`border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Contact information</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{client.client_email}</span>
            </div>
            {client.client_phone && (
              <div className="flex items-center gap-3">
                <Phone className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{client.client_phone}</span>
              </div>
            )}
            {client.client_company && (
              <div className="flex items-center gap-3">
                <Building2 className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{client.client_company}</span>
              </div>
            )}
            {client.plan && (
              <div className="flex items-center gap-3">
                <BarChart2 className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Plan: {client.plan.charAt(0).toUpperCase() + client.plan.slice(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Analysis link */}
        <div className={`border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Linked analysis</h2>
          {client.analysis_id ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Analysis created</span>
              </div>
              {client.company_name && (
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Company: <strong>{client.company_name}</strong></p>
              )}
              <Link
                to={`/analysis/${client.analysis_id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium hover:from-emerald-500 hover:to-teal-500 transition"
              >
                <ExternalLink className="w-4 h-4" />
                View analysis
              </Link>
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center py-6 gap-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <Clock className="w-8 h-8 opacity-50" />
              <p className="text-sm">Analysis not yet created</p>
              <p className="text-xs opacity-70">The client needs to fill in the data</p>
            </div>
          )}
        </div>
      </div>

      {/* Notes (P12 editable) */}
      <div className={`border rounded-2xl p-5 mt-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Internal notes</h2>
          </div>
          {!editingNotes ? (
            <button
              onClick={() => setEditingNotes(true)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingNotes(false); setNotesValue(client.notes || ''); }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {savingNotes ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
        {editingNotes ? (
          <textarea
            value={notesValue}
            onChange={e => setNotesValue(e.target.value)}
            rows={5}
            autoFocus
            className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition resize-none ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
            placeholder="Add your notes about this client..."
          />
        ) : (
          <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {client.notes || <span className="opacity-50 italic">Sem notas. Clique em editar para adicionar.</span>}
          </p>
        )}
      </div>

      {/* Timeline */}
      <div className={`border rounded-2xl p-5 mt-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Linha do tempo</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isDark ? 'bg-emerald-500' : 'bg-emerald-500'}`} />
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Client registered</p>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(client.created_at).toLocaleString('en-US')}</p>
            </div>
          </div>
          {client.analysis_id && (
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isDark ? 'bg-blue-500' : 'bg-blue-500'}`} />
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Linked analysis</p>
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ID #{client.analysis_id}</p>
              </div>
            </div>
          )}
          {client.data_status === 'report_sent' && (
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isDark ? 'bg-teal-500' : 'bg-teal-500'}`} />
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Report sent</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
