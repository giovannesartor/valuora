// ─── Horizontal glow divider ──────────────────────────────
export default function GlowDivider({ isDark }) {
  return (
    <div className="relative h-px w-full max-w-5xl mx-auto">
      <div className={`absolute inset-0 ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/80'}`} />
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-1/3 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
    </div>
  );
}
