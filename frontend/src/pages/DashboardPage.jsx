import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, TrendingUp, LogOut } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../lib/api';

export default function DashboardPage() {
  const { user, fetchUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
    api.get('/analyses/')
      .then((res) => setAnalyses(res.data))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatBRL = (v) => {
    if (!v) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">QV</span>
            </div>
            <span className="font-bold text-navy-900">Quanto Vale</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{user?.full_name}</span>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">
              Olá, {user?.full_name?.split(' ')[0] || 'Usuário'}
            </h1>
            <p className="text-slate-500 mt-1">Gerencie suas análises de valuation.</p>
          </div>
          <Link
            to="/nova-analise"
            className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition"
          >
            <Plus className="w-4 h-4" />
            Nova análise
          </Link>
        </div>

        {/* Analyses */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Carregando...</div>
        ) : analyses.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-slate-300" />
            </div>
            <h3 className="font-semibold text-navy-900 mb-2">Nenhuma análise ainda</h3>
            <p className="text-slate-500 text-sm mb-6">Crie sua primeira análise de valuation.</p>
            <Link
              to="/nova-analise"
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition"
            >
              <Plus className="w-4 h-4" />
              Criar análise
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analyses.map((a) => (
              <Link
                key={a.id}
                to={`/analise/${a.id}`}
                className="group bg-white border border-slate-200 rounded-2xl p-6 hover:border-brand-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-600" />
                    <span className="text-xs font-medium text-brand-600 uppercase tracking-wide">
                      {a.sector}
                    </span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    a.status === 'completed' ? 'bg-green-50 text-green-700' :
                    a.status === 'processing' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {a.status === 'completed' ? 'Concluída' : a.status === 'processing' ? 'Processando' : 'Rascunho'}
                  </span>
                </div>

                <h3 className="font-semibold text-navy-900 mb-1 group-hover:text-brand-600 transition">
                  {a.company_name}
                </h3>

                {a.equity_value && (
                  <p className="text-2xl font-bold text-navy-900 mt-3">
                    {formatBRL(a.equity_value)}
                  </p>
                )}

                <p className="text-xs text-slate-400 mt-3">
                  {new Date(a.created_at).toLocaleDateString('pt-BR')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
