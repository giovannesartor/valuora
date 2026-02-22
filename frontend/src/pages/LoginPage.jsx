import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Login realizado!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-navy-900 items-center justify-center p-12">
        <div className="max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <span className="text-white font-extrabold text-lg">QV</span>
            </div>
            <span className="text-white font-bold text-xl">Quanto Vale</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Descubra o valor real do seu negócio.
          </h1>
          <p className="text-slate-400 text-lg">
            Valuation profissional baseado em DCF com ajuste setorial real.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">QV</span>
            </div>
            <span className="font-bold text-navy-900">Quanto Vale</span>
          </div>

          <h2 className="text-2xl font-bold text-navy-900 mb-2">Entrar</h2>
          <p className="text-slate-500 mb-8">Acesse sua conta para continuar.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
              <input
                {...register('email', { required: 'E-mail obrigatório' })}
                type="email"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition"
                placeholder="seu@email.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
              <input
                {...register('password', { required: 'Senha obrigatória' })}
                type="password"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition"
                placeholder="••••••••"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="text-right">
              <Link to="/esqueci-senha" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                Esqueceu a senha?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-8">
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-brand-600 font-semibold hover:text-brand-700">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
