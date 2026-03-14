import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, BarChart3, Clock, X, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import formatBRL from '../lib/formatBRL';

const fmtBRL = (v) => formatBRL(v, { abbreviate: true });

export default function GlobalSearchModal({ open, onClose }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const timeoutRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounce search
  const doSearch = useCallback((q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    api.get(`/analyses/?search=${encodeURIComponent(q)}&page_size=8&sort=date_desc`)
      .then(res => {
        setResults(res.data.items || []);
        setSelectedIndex(0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(timeoutRef.current);
  }, [query, doSearch]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && results[selectedIndex]) {
        navigate(`/analysis/${results[selectedIndex].id}`);
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, selectedIndex, navigate, onClose]);

  if (!open) return null;

  const statusIcon = (status) => {
    if (status === 'completed') return <BarChart3 className="w-3.5 h-3.5 text-green-500" />;
    if (status === 'processing') return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
    return <FileText className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={`relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className={`flex items-center gap-3 px-4 py-3.5 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <Search className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search analyses by company, sector..."
            className={`flex-1 bg-transparent outline-none text-sm ${isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'}`}
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin flex-shrink-0" />
          )}
          {!loading && query && (
            <button onClick={() => setQuery('')} className={`flex-shrink-0 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className={`hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${isDark ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="max-h-80 overflow-y-auto py-1.5">
            {results.map((a, i) => (
              <li key={a.id}>
                <button
                  onClick={() => { navigate(`/analysis/${a.id}`); onClose(); }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                    i === selectedIndex
                      ? isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
                      : isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    {statusIcon(a.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{a.company_name}</p>
                    <div className="flex items-center gap-2">
                      {a.sector && <span className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{a.sector}</span>}
                      {a.equity_value && (
                        <span className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmtBRL(a.equity_value)}</span>
                      )}
                    </div>
                  </div>
                  {i === selectedIndex && <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {query && !loading && results.length === 0 && (
          <div className={`px-4 py-8 text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            No analysis found for "{query}"
          </div>
        )}

        {/* Hints */}
        {!query && (
          <div className={`px-4 py-4 text-center text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Type to search · <kbd className={`px-1 py-0.5 rounded text-[10px] ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>↑↓</kbd> navigate · <kbd className={`px-1 py-0.5 rounded text-[10px] ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>Enter</kbd> open
          </div>
        )}
      </div>
    </div>
  );
}
