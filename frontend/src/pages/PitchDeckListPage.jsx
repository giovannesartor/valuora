import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Clock, CheckCircle, Loader2, Eye, Download,
  Trash2, AlertCircle, DollarSign, Sparkles, Rocket,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import api from '../lib/api';
import toast from 'react-hot-toast';

const STATUS_MAP = {
  draft: { label: 'Rascunho', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: Clock },
  pending_payment: { label: 'Aguardando pagamento', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: DollarSign },
  processing: { label: 'Generating PDF...', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Loader2 },
  completed: { label: 'Completo', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
  error: { label: 'Erro', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertCircle },
};

export default function PitchDeckListPage() {
  usePageTitle('Pitch Decks');
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDecks();
  }, []);

  async function fetchDecks() {
    try {
      const res = await api.get('/pitch-deck/');
      setDecks(res.data);
    } catch (err) {
      toast.error('Error loading pitch decks.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Excluir "${name}"?`)) return;
    try {
      await api.delete(`/pitch-deck/${id}`);
      toast.success('Pitch deck excluído.');
      setDecks(prev => prev.filter(d => d.id !== id));
    } catch {
      toast.error('Erro ao excluir.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Pitch Decks</h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Crie e gerencie seus pitch decks para investidores.
          </p>
        </div>
        <button
          onClick={() => navigate('/pitch-deck/new')}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-600/30 hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          Novo Pitch Deck
        </button>
      </div>

      {/* Empty state */}
      {decks.length === 0 ? (
        <div className={`text-center py-20 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
          <FileText className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          <h3 className={`font-semibold text-lg mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Nenhum pitch deck ainda</h3>
          <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Crie seu primeiro pitch deck profissional para investidores.
          </p>
          <button
            onClick={() => navigate('/pitch-deck/new')}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all"
          >
            <Plus className="w-4 h-4" />
            Criar Pitch Deck
          </button>
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-sm mx-auto text-center">
            {[{ Icon: Sparkles, text: 'IA aprimora cada seção' }, { Icon: FileText, text: 'PDF profissional' }, { Icon: Rocket, text: 'Pronto para investidores' }].map(({ Icon, text }, i) => (
              <div key={i}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                  <Icon className="w-4 h-4 text-purple-500" />
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {decks.map((deck) => {
            const status = STATUS_MAP[deck.status] || STATUS_MAP.draft;
            const StatusIcon = status.icon;
            return (
              <div
                key={deck.id}
                className={`rounded-xl border p-5 flex items-center gap-4 transition-all hover:shadow-md cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-purple-200'
                }`}
                onClick={() => navigate(`/pitch-deck/${deck.id}`)}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                  <FileText className="w-6 h-6 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{deck.company_name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    {deck.sector && (
                      <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{deck.sector}</span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                      <StatusIcon className={`w-3 h-3 ${deck.status === 'processing' ? 'animate-spin' : ''}`} />
                      {status.label}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {new Date(deck.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {deck.status === 'completed' && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await api.get(`/pitch-deck/${deck.id}/download`, { responseType: 'blob' });
                          const url = window.URL.createObjectURL(new Blob([res.data]));
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `pitch-deck-${deck.company_name || deck.id}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
                        } catch {
                          toast.error('Error downloading PDF.');
                        }
                      }}
                      className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-emerald-400' : 'hover:bg-slate-100 text-slate-400 hover:text-emerald-600'}`}
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(deck.id, deck.company_name)}
                    className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-500 hover:text-red-400' : 'hover:bg-slate-100 text-slate-400 hover:text-red-500'}`}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
