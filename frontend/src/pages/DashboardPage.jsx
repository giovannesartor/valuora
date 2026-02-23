import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, TrendingUp, LogOut, Shield } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function DashboardPage() {
  const { user, fetchUser, logout, isAdmin, isSuperAdmin } = useAuthStore();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();

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
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="QV" className="w-8 h-8" />
            <span className={`font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>Quanto Vale</span>
          </div>
          <div className="flex items-center gap-4">
            {(isAdmin || isSuperAdmin) && (
              <Link to="/admin" className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition">
                <Shield className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
            <ThemeToggle />
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{user?.full_name}</span>
            <button onClick={handleLogout} className={`transition ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-500'}`}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>
              Olá, {user?.full_name?.split(' ')[0] || 'Usuário'}
            </h1>
            <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Gerencie suas análises de valuation.</p>
          </div>
          <Link
            to="/nova-analise"
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-blue-500 hover:to-cyan-500 transition shadow-lg shadow-blue-600/25"
          >
            <Plus className="w-4 h-4" />
            Nova análise
          </Link>
        </div>

        {loading ? (
          <div className={`text-center py-20 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Carregando...</div>
        ) : analyses.length === 0 ? (
          <div className="text-center py-20">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <FileText className={`w-7 h-7 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            </div>
            <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-navy-900'}`}>Nenhuma análise ainda</h3>
            <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Crie sua primeira análise de valuation.</p>
            <Link
              to="/nova-analise"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:from-blue-500 hover:to-cyan-500 transition shadow-lg shadow-blue-600/25"
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
                className={`group border rounded-2xl p-6 transition-all ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-md'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium text-blue-500 uppercase tracking-wide">
                      {a.sector}
                    </span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    a.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                    a.status === 'processing' ? 'bg-yellow-500/10 text-yellow-400' :
                    isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'
                  }`}>
                    {a.status === 'completed' ? 'Concluída' : a.status === 'processing' ? 'Processando' : 'Rascunho'}
                  </span>
                </div>

                <h3 className={`font-semibold mb-1 group-hover:text-blue-500 transition ${isDark ? 'text-white' : 'text-navy-900'}`}>
                  {a.company_name}
                </h3>

                {a.equity_value && (
                  <p className={`text-2xl font-bold mt-3 ${isDark ? 'text-white' : 'text-navy-900'}`}>
                    {formatBRL(a.equity_value)}
                  </p>
                )}

                <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
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
