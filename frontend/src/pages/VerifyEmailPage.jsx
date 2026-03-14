import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, XCircle, Loader2, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import api from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

const LINK_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // 2 min before first resend allowed

function formatHMS(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
}

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const token = searchParams.get('token');
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // Countdown state
  const [expiresIn, setExpiresIn] = useState(LINK_TTL_MS);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds after clicking resend

  // Email from localStorage
  const storedEmail = (() => { try { return localStorage.getItem('qv_verify_email') || ''; } catch { return ''; } })();
  const sentAt = (() => { try { return parseInt(localStorage.getItem('qv_verify_sent_at') || '0', 10); } catch { return 0; } })();

  // Tick every second when on idle state
  useEffect(() => {
    if (token || status !== 'idle') return;
    if (!sentAt) return;

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, sentAt + LINK_TTL_MS - now);
      setExpiresIn(left);
      setCanResend(now - sentAt >= RESEND_COOLDOWN_MS);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [token, status, sentAt]);

  // Post-resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    if (!storedEmail || resending || resendCooldown > 0) return;
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: storedEmail });
      toast.success('Email resent! Also check spam.');
      // Update sentAt so countdown resets
      try { localStorage.setItem('qv_verify_sent_at', String(Date.now())); } catch {}
      setResendCooldown(120); // 2-min cooldown after clicking resend
      setCanResend(false);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 429) {
        toast.error('Limit reached. Wait before resending again.');
        setResendCooldown(120);
      } else {
        toast.error(detail || 'Error resending email.');
      }
    } finally {
      setResending(false);
    }
  }, [storedEmail, resending, resendCooldown]);

  useEffect(() => {
    if (!token) {
      // No token = user just registered, show "check your email" screen
      setStatus('idle');
      return;
    }
    setStatus('loading');
    api.post(`/auth/verify-email?token=${token}`)
      .then(() => {
        // Clean up verify metadata
        try { localStorage.removeItem('qv_verify_sent_at'); localStorage.removeItem('qv_verify_email'); } catch {}
        const redirect = sessionStorage.getItem('qv_post_verify_redirect');
        if (redirect) {
          sessionStorage.removeItem('qv_post_verify_redirect');
          setStatus('success');
          // Brief delay so user sees success state before redirect
          setTimeout(() => navigate(redirect), 1500);
        } else {
          setStatus('success');
        }
      })
      .catch(() => setStatus('error'));
  }, [token, navigate]);

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className={`rounded-2xl border p-12 max-w-md w-full text-center transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        {/* No token — "Check your email" state */}
        {status === 'idle' && (
          <>
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Verifique seu e-mail
            </h1>
            <p className={`mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              We sent a confirmation link to{storedEmail ? <strong className="ml-1">{storedEmail}</strong> : ' seu e-mail'}. Clique nele para ativar sua conta.
            </p>

            {/* Expiry countdown */}
            {sentAt > 0 && (
              <div className={`flex items-center justify-center gap-2 mb-5 rounded-xl px-4 py-2.5 text-sm font-medium ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                Link expira em <span className={`font-mono tabular-nums ${expiresIn < 60 * 60 * 1000 ? 'text-red-500' : isDark ? 'text-white' : 'text-slate-900'}`}>{formatHMS(expiresIn)}</span>
              </div>
            )}

            {/* Spam warning — destaque âmbar */}
            <div className={`flex items-start gap-3 rounded-xl p-4 mb-6 text-left border ${
              isDark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
              <div>
                <p className="text-sm font-semibold mb-0.5">Não recebeu o e-mail?</p>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}>
                  Verifique a pasta de <strong>Spam</strong> ou <strong>Lixo Eletrônico</strong> — nossos e-mails transacionais às vezes são filtrados. Wait até 2 minutos antes de tentar novamente.
                </p>
              </div>
            </div>

            {/* Resend button — appears after 2 min */}
            {sentAt > 0 && (
              <button
                onClick={handleResend}
                disabled={!canResend || resending || resendCooldown > 0}
                className={`mb-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition ${
                  canResend && !resending && resendCooldown <= 0
                    ? isDark
                      ? 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10'
                      : 'border-emerald-400 text-emerald-700 hover:bg-emerald-50'
                    : isDark
                      ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                      : 'border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {resending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Reenviando...</>
                  : resendCooldown > 0
                    ? <><Clock className="w-4 h-4" /> Wait {resendCooldown}s</>
                  : !canResend
                    ? <><Clock className="w-4 h-4" /> Disponível em instantes...</>
                    : <><RefreshCw className="w-4 h-4" /> Reenviar e-mail</>
                }
              </button>
            )}

            <Link
              to="/login"
              className={`text-sm font-semibold transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'}`}
            >
              Já confirmei, ir para login →
            </Link>
          </>
        )}

        {/* Loading — verifying token */}
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
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
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-600/25"
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
              The verification link is invalid or has already been used.
            </p>
            <Link
              to="/login"
              className={`text-sm font-semibold transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'}`}
            >
              Ir para login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
