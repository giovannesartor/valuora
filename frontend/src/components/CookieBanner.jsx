import { useState, useEffect } from 'react';
import { Cookie, X, ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const STORAGE_KEY = 'valuora_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, at: Date.now() }));
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: false, at: Date.now() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-x-0 z-[9999] border-t shadow-2xl transition-all duration-300 bottom-14 sm:bottom-0 ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5 sm:mt-0" />

        <p className={`text-sm flex-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          We use cookies and similar technologies to improve your experience, analyze traffic, and personalize content, in compliance with our{' '}
          <strong>Privacy Policy</strong>.{' '}
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-500 underline inline-flex items-center gap-0.5 hover:text-emerald-400"
          >
            Learn more <ExternalLink className="w-3 h-3" />
          </a>
        </p>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={decline}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition border ${
              isDark
                ? 'border-slate-700 text-slate-400 hover:bg-slate-800'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition"
          >
            Accept cookies
          </button>
        </div>
      </div>
    </div>
  );
}
