import { useTheme } from '../context/ThemeContext';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Reusable styled confirmation dialog (replaces native confirm()).
 *
 * Props:
 *  - open: boolean
 *  - title: string
 *  - message: string | JSX
 *  - confirmLabel: string (default "Confirmar")
 *  - cancelLabel: string (default "Cancel")
 *  - variant: 'danger' | 'warning' | 'default'
 *  - loading: boolean
 *  - onConfirm: () => void
 *  - onCancel: () => void
 */
export default function ConfirmDialog({
  open,
  title = 'Confirm action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const { isDark } = useTheme();

  if (!open) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      iconBg: 'bg-red-500/10',
      btn: 'bg-red-600 hover:bg-red-500 text-white',
    },
    warning: {
      icon: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
      btn: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
    default: {
      icon: 'text-emerald-500',
      iconBg: 'bg-emerald-500/10',
      btn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    },
  };

  const v = variantStyles[variant] || variantStyles.default;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <button
          onClick={onCancel}
          className={`absolute top-4 right-4 p-1 rounded-lg transition ${isDark ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl ${v.iconBg} flex items-center justify-center shrink-0`}>
            <AlertTriangle className={`w-5 h-5 ${v.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-lg mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{message}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 ${v.btn}`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
