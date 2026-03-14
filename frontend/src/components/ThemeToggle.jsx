import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
        isDark
          ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      } ${className}`}
      aria-label={isDark ? 'Enable light mode' : 'Enable dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
