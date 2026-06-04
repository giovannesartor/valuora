export default function PartnerGuidedAnalysisPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-8">
      <div className="max-w-lg w-full text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          Partner Feature
        </div>
        <h1 className="text-3xl font-bold">Guided Analysis</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          This feature allows partners to create a valuation on behalf of a client and send them an invite link to review and pay.
          Full workflow coming soon — use the <strong>Clients</strong> tab to manage client analyses in the meantime.
        </p>
        <p className="text-slate-500 text-xs">
          Guided Analysis — Coming Soon
        </p>
      </div>
    </div>
  );
}
