import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function NotFoundPage() {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen flex items-center justify-center px-6 transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="text-center max-w-lg">
        {/* 404 Number */}
        <div className="relative mb-8">
          <h1 className="text-[120px] sm:text-[160px] font-black leading-none bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent select-none">
            404
          </h1>
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 blur-3xl rounded-full" />
        </div>

        {/* Message */}
        <h2 className={`text-2xl sm:text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Página não encontrada
        </h2>
        <p className={`text-base mb-10 max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          A página que você está procurando não existe ou foi movida. Verifique o endereço ou volte ao início.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-600/25"
          >
            <Home className="w-4 h-4" />
            Ir ao Dashboard
          </Link>
          <Link
            to="/"
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition border ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Página Inicial
          </Link>
        </div>
      </div>
    </div>
  );
}
