import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Briefcase, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function PartnerLoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { isDark } = useTheme();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      // Check if the user is actually a partner
      const isPartner = useAuthStore.getState().isPartner;
      if (!isPartner) {
        useAuthStore.getState().logout();
        toast.error('Esta conta não é de um parceiro. Use o login normal.');
        return;
      }
      toast.success('Login realizado!');
      navigate('/parceiro/dashboard');
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
            <Briefcase className="w-10 h-10 text-white" />
            <span className="text-white font-bold text-xl">Modo Parceiro</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Acesse seu painel de parceiro.
          </h1>
          <p className="text-emerald-100 text-lg">
            Gerencie clientes, acompanhe comissões e compartilhe seu link de indicação.
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
            <Briefcase className={`w-8 h-8 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <span className={`font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>Modo Parceiro</span>
          </div>

          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-navy-900'}`}>Login do Parceiro</h2>
          <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Acesse seu painel para gerenciar indicações.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>E-mail</label>
              <input
                {...register('email', { required: 'E-mail obrigatório' })}
                type="email"
                autoComplete="email"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="seu@email.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Senha</label>
              <div className="relative">
                <input
                  {...register('password', { required: 'Senha obrigatória' })}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`w-full px-4 py-3 pr-12 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
              {loading ? 'Entrando...' : 'Entrar como parceiro'}
            </button>
          </form>

          <p className={`text-center text-sm mt-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Não é parceiro ainda?{' '}
            <Link to="/parceiro/cadastro" className="text-emerald-500 font-semibold hover:text-emerald-400">
              Criar conta de parceiro
            </Link>
          </p>

          <div className={`flex items-center justify-center gap-3 mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            <Link to="/login" className="text-xs hover:text-emerald-500 transition">Login normal</Link>
            <span className="text-xs">·</span>
            <Link to="/termos-de-uso" className="text-xs hover:text-emerald-500 transition">Termos de Uso</Link>
            <span className="text-xs">·</span>
            <Link to="/politica-de-privacidade" className="text-xs hover:text-emerald-500 transition">Privacidade</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
