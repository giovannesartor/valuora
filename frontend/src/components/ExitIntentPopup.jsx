import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { X, Gift, ArrowRight, Copy, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ExitIntentPopup() {
  const { isDark } = useTheme();
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleMouseLeave = useCallback((e) => {
    if (e.clientY <= 0 && !sessionStorage.getItem('qv_exit_shown')) {
      setShow(true);
      sessionStorage.setItem('qv_exit_shown', '1');
    }
  }, []);

  useEffect(() => {
    // Only show after 45 seconds on the page (gives time to read)
    if (sessionStorage.getItem('qv_exit_shown')) return;

    const timer = setTimeout(() => {
      document.addEventListener('mouseout', handleMouseLeave);
    }, 45000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseout', handleMouseLeave);
    };
  }, [handleMouseLeave]);

  const handleCopy = () => {
    navigator.clipboard.writeText('PRIMEIRA');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]"
        onClick={() => setShow(false)}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl animate-[scaleIn_0.3s_ease-out] ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Close */}
        <button
          onClick={() => setShow(false)}
          className={`absolute top-4 right-4 p-1 rounded-lg transition ${isDark ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header gradient */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-2xl px-8 py-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-2xl mb-4">
            <Gift className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-white text-xl font-bold mb-1">Espere! Temos uma oferta</h3>
          <p className="text-emerald-100 text-sm">Exclusiva para sua primeira avaliação</p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <p className={`text-center text-base mb-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Ganhe <span className="font-bold text-emerald-500 text-lg">10% de desconto</span> no seu primeiro valuation profissional.
          </p>

          {/* Coupon code */}
          <div className={`flex items-center justify-between rounded-xl border-2 border-dashed px-5 py-4 mb-6 ${isDark ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-yellow-400 bg-yellow-50'}`}>
            <div>
              <p className={`text-xs mb-1 ${isDark ? 'text-yellow-400/80' : 'text-yellow-700'}`}>Use o código:</p>
              <span className={`text-2xl font-extrabold tracking-widest ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>PRIMEIRA</span>
            </div>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          <Link
            to="/cadastro"
            onClick={() => setShow(false)}
            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-600/25"
          >
            Iniciar valuation com desconto
            <ArrowRight className="w-4 h-4" />
          </Link>

          <button
            onClick={() => setShow(false)}
            className={`w-full text-center mt-3 text-xs transition ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Não, obrigado
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
