// ─── Shared dashboard utilities ────────────────────────
// Extracted from DashboardPage to be reusable across all dashboards

export const relativeTime = (dateStr) => {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('pt-BR');
};

export const STATUS_MAP = {
  completed: { label: 'Concluída', color: 'green' },
  processing: { label: 'Processando', color: 'yellow' },
  draft: { label: 'Rascunho', color: 'slate' },
};

export const SECTOR_COLORS = [
  '#059669', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316',
  '#84cc16', '#a855f7', '#0ea5e9', '#e11d48', '#22d3ee',
  '#facc15', '#4ade80',
];

/**
 * Reusable polling hook factory.
 * Returns a cleanup function for use in useEffect.
 */
export function createPoller(fn, intervalMs = 60000) {
  fn();
  const timer = setInterval(fn, intervalMs);
  return () => clearInterval(timer);
}
