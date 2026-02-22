import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function ForgotPasswordPage() {
  const { register, handleSubmit } = useForm();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSent(true);
    } catch {
      toast.error('Erro ao processar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 max-w-md w-full">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">QV</span>
          </div>
          <span className="font-bold text-navy-900">Quanto Vale</span>
        </div>

        {sent ? (
          <div className="text-center py-8">
            <h2 className="text-xl font-bold text-navy-900 mb-2">E-mail enviado!</h2>
            <p className="text-slate-500 mb-6">Se o e-mail existir em nossa base, enviaremos instruções para redefinir sua senha.</p>
            <Link to="/login" className="text-brand-600 font-semibold">Voltar ao login</Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-navy-900 mb-2">Esqueceu a senha?</h2>
            <p className="text-slate-500 mb-8">Informe seu e-mail para receber o link de redefinição.</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
                <input
                  {...register('email', { required: true })}
                  type="email"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent outline-none transition"
                  placeholder="seu@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar link'}
              </button>
            </form>
            <p className="text-center text-sm text-slate-500 mt-6">
              <Link to="/login" className="text-brand-600 font-semibold">Voltar ao login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
