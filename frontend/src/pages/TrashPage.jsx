import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trash2, RotateCcw, AlertTriangle, ArrowLeft, Clock,
  Building2, DollarSign, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { useTheme } from '../context/ThemeContext';

const formatBRL = (v) => {
  if (!v) return '—';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
  return `R$ ${v.toFixed(2)}`;
};

export default function TrashPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [permanentConfirm, setPermanentConfirm] = useState({ open: false, id: null, name: '' });
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/analyses/trash?page=${page}&page_size=${PAGE_SIZE}`);
      setItems(res.data.items);
      setTotalPages(res.data.total_pages);
      setTotalCount(res.data.total);
    } catch {
      toast.error('Erro ao carregar lixeira.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadTrash(); }, [loadTrash]);

  const handleRestore = async (id) => {
    setRestoring(id);
    try {
      await api.post(`/analyses/${id}/restore`);
      toast.success('Análise restaurada!');
      setItems(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao restaurar.');
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = (id, name) => {
    setPermanentConfirm({ open: true, id, name: name || 'esta análise' });
  };

  const confirmPermanentDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/analyses/${permanentConfirm.id}/permanent`);
      toast.success('Análise excluída permanentemente.');
      setPermanentConfirm({ open: false, id: null, name: '' });
      setItems(prev => prev.filter(a => a.id !== permanentConfirm.id));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao excluir.');
    } finally {
      setDeleting(false);
    }
  };

  const daysUntilDeletion = (deletedAt) => {
    if (!deletedAt) return 30;
    const deleted = new Date(deletedAt);
    const expiry = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Lixeira
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Análises excluídas são mantidas por 30 dias antes de serem removidas permanentemente.
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className={`text-center py-20 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
          <Trash2 className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Lixeira vazia
          </h3>
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhuma análise na lixeira.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Warning banner */}
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              As análises abaixo serão excluídas permanentemente após 30 dias.
              Você pode restaurá-las ou excluí-las manualmente a qualquer momento.
            </p>
          </div>

          {/* Items */}
          {items.map((a) => {
            const days = daysUntilDeletion(a.deleted_at);
            const urgent = days <= 7;

            return (
              <div
                key={a.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition ${
                  isDark
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-slate-800' : 'bg-slate-100'
                }`}>
                  <Building2 className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {a.company_name}
                  </h3>
                  <div className={`flex items-center gap-3 mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span className="capitalize">{a.sector}</span>
                    {a.equity_value && (
                      <>
                        <span>•</span>
                        <span className="font-medium">{formatBRL(a.equity_value)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Days remaining */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 ${
                  urgent
                    ? isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
                    : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                  {days} {days === 1 ? 'dia' : 'dias'}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(a.id)}
                    disabled={restoring === a.id}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                      isDark
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    } disabled:opacity-50`}
                  >
                    {restoring === a.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    Restaurar
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(a.id, a.company_name)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                      isDark
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {totalCount} {totalCount === 1 ? 'item' : 'itens'} na lixeira
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`p-2 rounded-lg transition disabled:opacity-30 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`p-2 rounded-lg transition disabled:opacity-30 ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Permanent delete confirmation */}
      <ConfirmDialog
        open={permanentConfirm.open}
        title="Excluir permanentemente?"
        message={`"${permanentConfirm.name}" será excluída para sempre. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir permanentemente"
        confirmColor="red"
        loading={deleting}
        onConfirm={confirmPermanentDelete}
        onCancel={() => setPermanentConfirm({ open: false, id: null, name: '' })}
      />
    </div>
  );
}
