import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const registerUser = useAuthStore((s) => s.register);
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    if (data.password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await registerUser(data);
      toast.success('Conta criada! Verifique seu e-mail para confirmar.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao criar conta.');
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
            Comece agora.
          </h1>
          <p className="text-slate-400 text-lg">
            Crie sua conta e descubra o valor da sua empresa em minutos.
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

          <h2 className="text-2xl font-bold text-navy-900 mb-2">Criar conta</h2>
          <p className="text-slate-500 mb-8">Preencha seus dados para começar.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome completo</label>
              <input
                {...register('full_name', { required: 'Nome obrigatório' })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition"
                placeholder="Seu nome completo"
              />
              {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
            </div>

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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefone (opcional)</label>
              <input
                {...register('phone')}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Empresa (opcional)</label>
              <input
                {...register('company_name')}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition"
                placeholder="Nome da sua empresa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
              <input
                {...register('password', { required: 'Senha obrigatória', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })}
                type="password"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition"
                placeholder="Mínimo 8 caracteres"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition disabled:opacity-50 mt-2"
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-8">
            Já tem conta?{' '}
            <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
