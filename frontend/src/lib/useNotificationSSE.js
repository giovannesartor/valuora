import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle, AlertTriangle, Info, FileText } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const ICONS = {
  analysis_completed: CheckCircle,
  payment_confirmed: CheckCircle,
  pitchdeck_completed: FileText,
  pitchdeck_error: AlertTriangle,
};

const COLORS = {
  analysis_completed: 'text-emerald-500',
  payment_confirmed: 'text-emerald-500',
  pitchdeck_completed: 'text-blue-500',
  pitchdeck_error: 'text-red-500',
};

export default function useNotificationSSE() {
  const esRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const url = `${API_URL}/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('notification', (e) => {
      try {
        const data = JSON.parse(e.data);
        const Icon = ICONS[data.type] || Info;
        const color = COLORS[data.type] || 'text-slate-400';

        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-sm w-full bg-white dark:bg-slate-800 shadow-xl rounded-xl pointer-events-auto flex items-start gap-3 p-4 border border-slate-200 dark:border-slate-700`}
            >
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{data.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{data.text}</p>
              </div>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            </div>
          ),
          { duration: 6000 }
        );
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('connected', () => {
      // Connection established; no action needed
    });

    es.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);
}
