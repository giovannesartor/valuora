import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { register, handleSubmit } = useForm();
  const [loading, setLoading] = useState(false);
  const token = searchParams.get('token');

  const onSubmit = async (data) => {
    if (data.new_password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: data.new_password });
      toast.success('Senha redefinida com sucesso!');
      navigate('/login');
    } catch {
      toast.error('Token inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 transition-colors ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`rounded-2xl shadow-sm border p-10 max-w-md w-full transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-8">
          <img src="/favicon.svg?v=2" alt="QV" className="w-8 h-8" loading="lazy" />
          <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Quanto Vale</span>
        </div>

        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Nova senha</h2>
        <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Defina sua nova senha.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nova senha</label>
            <input
              {...register('new_password', { required: true })}
              type="password"
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900'}`}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Redefinir senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
