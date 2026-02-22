import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../lib/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    api.post(`/auth/verify-email?token=${token}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-navy-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-extrabold text-2xl">QV</span>
        </div>

        {status === 'loading' && (
          <>
            <h1 className="text-xl font-bold text-navy-900 mb-2">Verificando...</h1>
            <p className="text-slate-500">Confirmando seu e-mail.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <h1 className="text-xl font-bold text-navy-900 mb-2">E-mail confirmado!</h1>
            <p className="text-slate-500 mb-6">Sua conta está ativa. Você já pode fazer login.</p>
            <Link to="/login" className="inline-flex bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-700 transition">
              Fazer login
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-xl font-bold text-red-600 mb-2">Link inválido</h1>
            <p className="text-slate-500 mb-6">O link de verificação é inválido ou já foi utilizado.</p>
            <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700">
              Ir para login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
