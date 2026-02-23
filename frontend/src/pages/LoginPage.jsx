import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import useAuthStore from '../store/authStore';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const { isDark } = useTheme();
  const redirectTo = location.state?.from || '/dashboard';

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Login realizado!');
      // If user is partner-only, redirect to partner dashboard
      const state = useAuthStore.getState();
      if (state.isPartner && !state.isAdmin && !state.isSuperAdmin) {
        navigate('/parceiro/dashboard');
      } else {
        navigate(redirectTo);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-emerald-600 to-teal-600 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-white/10 rounded-full blur-[80px]" />
        <div className="relative max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <img src="/favicon.svg?v=2" alt="QV" className="w-10 h-10" />
            <span className="text-white font-bold text-xl">Quanto Vale</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Descubra o valor real do seu negócio.
          </h1>
          <p className="text-emerald-100 text-lg">
            Valuation profissional baseado em DCF com ajuste setorial real.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link to="/" className={`flex items-center gap-1.5 text-sm font-medium transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src="/favicon.svg?v=2" alt="QV" className="w-8 h-8" />
            <span className={`font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>Quanto Vale</span>
          </div>

          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-navy-900'}`}>Entrar</h2>
          <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Acesse sua conta para continuar.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>E-mail</label>
              <input
                {...register('email', { required: 'E-mail obrigatório' })}
                type="email"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="seu@email.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Senha</label>
              <input
                {...register('password', { required: 'Senha obrigatória' })}
                type="password"
                autoComplete="current-password"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="••••••••"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="text-right">
              <Link to="/esqueci-senha" className="text-sm text-emerald-500 hover:text-emerald-400 font-medium">
                Esqueceu a senha?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/25"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className={`text-center text-sm mt-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-emerald-500 font-semibold hover:text-emerald-400">
              Criar conta
            </Link>
          </p>

          <div className={`flex items-center justify-center gap-3 mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            <Link to="/termos-de-uso" className="text-xs hover:text-emerald-500 transition">Termos de Uso</Link>
            <span className="text-xs">·</span>
            <Link to="/politica-de-privacidade" className="text-xs hover:text-emerald-500 transition">Privacidade</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
