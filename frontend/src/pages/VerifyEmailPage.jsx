import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const token = searchParams.get('token');
  const { isDark } = useTheme();

  useEffect(() => {
    if (!token) {
      // No token = user just registered, show "check your email" screen
      setStatus('idle');
      return;
    }
    setStatus('loading');
    api.post(`/auth/verify-email?token=${token}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className={`rounded-2xl border p-12 max-w-md w-full text-center transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        {/* No token — "Check your email" state */}
        {status === 'idle' && (
          <>
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Verifique seu e-mail
            </h1>
            <p className={`mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Enviamos um link de confirmação para o seu e-mail.
            </p>
            <p className={`text-sm mb-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Clique no link do e-mail para ativar sua conta. Verifique também a pasta de spam.
            </p>
            <div className={`rounded-xl p-4 mb-6 ${isDark ? 'bg-slate-800/60' : 'bg-blue-50'}`}>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Não recebeu? Aguarde alguns minutos ou verifique sua caixa de spam.
              </p>
            </div>
            <Link
              to="/login"
              className={`text-sm font-semibold transition ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}
            >
              Já confirmei, ir para login →
            </Link>
          </>
        )}

        {/* Loading — verifying token */}
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <h1 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Verificando...</h1>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Confirmando seu e-mail.</p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              E-mail confirmado!
            </h1>
            <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Sua conta está ativa. Você já pode fazer login e começar seu valuation.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-blue-500 hover:to-cyan-500 transition shadow-lg shadow-blue-600/25"
            >
              Fazer login
            </Link>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <XCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Link inválido
            </h1>
            <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              O link de verificação é inválido ou já foi utilizado.
            </p>
            <Link
              to="/login"
              className={`text-sm font-semibold transition ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}
            >
              Ir para login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
