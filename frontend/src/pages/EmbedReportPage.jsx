import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  TrendingUp, Shield, AlertCircle, Loader2, ExternalLink,
  BarChart2, Target, Zap, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';

/**
 * Embed Report Viewer — lightweight, iframe-friendly report page.
 *
 * URL: /embed/report/:id?token=<bearer_token>
 *       &theme=light|dark
 *       &primary_color=7c3aed   (hex without #)
 *       &logo_url=https://…
 *
 * Fetches GET /api/v1/valuations/:id/report with the bearer token.
 * Renders the full valuation data without top-nav or sidebar.
 *
 * postMessage events emitted (when in iframe):
 *   { source: 'quantovale', type: 'report_loaded', id }
 *   { source: 'quantovale', type: 'report_error', id, error }
 */

function fmt(n, decimals = 0) {
  if (n == null) return '–';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtBRL(n) {
  if (n == null) return '–';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `R$ ${fmt(n / 1e9, 2)} bi`;
  if (abs >= 1e6) return `R$ ${fmt(n / 1e6, 2)} mi`;
  if (abs >= 1e3) return `R$ ${fmt(n / 1e3, 1)} mil`;
  return `R$ ${fmt(n, 2)}`;
}

function sanitiseHex(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/^#/, '').trim();
  return /^[0-9a-fA-F]{3,6}$/.test(cleaned) ? cleaned : null;
}

function Pill({ color, label }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

function RiskBadge({ score }) {
  if (score == null) return <Pill color="#6b7280" label="–" />;
  if (score >= 7) return <Pill color="#16a34a" label={`Baixo risco · ${score}`} />;
  if (score >= 4) return <Pill color="#d97706" label={`Risco médio · ${score}`} />;
  return <Pill color="#dc2626" label={`Alto risco · ${score}`} />;
}

function Collapsible({ title, icon: Icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors text-left"
      >
        <div className="flex items-center gap-2 font-medium text-sm">
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}

export default function EmbedReportPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('access_token');
  const embedTheme = searchParams.get('theme') || 'light';
  const primaryHex = sanitiseHex(searchParams.get('primary_color')) || '059669';
  const primaryColor = `#${primaryHex}`;
  const logoUrl = searchParams.get('logo_url') || null;
  const apiBase = searchParams.get('api_base') || 'https://api.quantovale.online/api/v1';

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isIframe = window !== window.parent;
  const postToParent = (type, data) => {
    if (isIframe) window.parent.postMessage({ source: 'quantovale', type, ...data }, '*');
  };

  useEffect(() => {
    if (!id || !token) {
      setError('Parâmetros obrigatórios ausentes: id e token.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${apiBase}/valuations/${id}/report`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setReport(data);
        postToParent('report_loaded', { id });
      } catch (e) {
        setError(e.message || 'Erro ao carregar relatório.');
        postToParent('report_error', { id, error: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token, apiBase]);

  const isDark = embedTheme === 'dark';
  const bg = isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900';
  const muted = isDark ? 'text-gray-400' : 'text-gray-500';
  const border = isDark ? 'border-gray-700' : 'border-gray-200';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-gray-50';

  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: primaryColor }} />
          <p className={`text-sm ${muted}`}>Carregando relatório…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center p-6`}>
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="w-10 h-10 mx-auto text-red-500" />
          <h2 className="font-bold text-lg">Erro ao carregar relatório</h2>
          <p className={`text-sm ${muted}`}>{error}</p>
        </div>
      </div>
    );
  }

  const {
    company_name, equity_value, valuation_min, valuation_max, valuation_average,
    risk_score, maturity_index, percentile, dcf_value, multiples_value,
    assumptions, projections, benchmark, ai_analysis,
    report_pdf_url, report_generated_at,
  } = report;

  return (
    <div className={`min-h-screen ${bg} p-4 sm:p-6 lg:p-8`}>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-9 max-w-[140px] object-contain" />
            ) : (
              <TrendingUp className="w-7 h-7 shrink-0" style={{ color: primaryColor }} />
            )}
            <div>
              <h1 className="text-xl font-bold leading-tight">{company_name || 'Relatório de Valuation'}</h1>
              {report_generated_at && (
                <p className={`text-xs ${muted}`}>
                  Gerado em {new Date(report_generated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
          {report_pdf_url && (
            <a
              href={report_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          )}
        </div>

        {/* ── Main Value Banner ── */}
        <div
          className="rounded-2xl p-6 text-white text-center"
          style={{ background: `linear-gradient(135deg, ${primaryColor}dd, ${primaryColor})` }}
        >
          <p className="text-sm font-medium opacity-80 mb-1">Valor Estimado da Empresa</p>
          <p className="text-4xl sm:text-5xl font-bold tracking-tight">{fmtBRL(equity_value)}</p>
          <p className="text-sm opacity-80 mt-1">
            Intervalo: {fmtBRL(valuation_min)} – {fmtBRL(valuation_max)}
          </p>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Valuation Médio', value: fmtBRL(valuation_average), icon: BarChart2 },
            { label: 'Risco', value: <RiskBadge score={risk_score} />, icon: Shield },
            { label: 'Maturidade', value: maturity_index != null ? `${fmt(maturity_index * 100, 0)}%` : '–', icon: Target },
            { label: 'Percentil', value: percentile != null ? `P${fmt(percentile, 0)}` : '–', icon: Zap },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className={`${cardBg} rounded-xl p-3 border ${border}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                <p className={`text-xs font-medium ${muted}`}>{label}</p>
              </div>
              <div className="text-sm font-bold">{value}</div>
            </div>
          ))}
        </div>

        {/* ── Methodology ── */}
        {(dcf_value != null || multiples_value != null) && (
          <div className={`grid grid-cols-2 gap-3`}>
            {dcf_value != null && (
              <div className={`${cardBg} rounded-xl p-4 border ${border}`}>
                <p className={`text-xs ${muted} mb-1`}>DCF (Fluxo Descontado)</p>
                <p className="text-lg font-bold">{fmtBRL(dcf_value)}</p>
              </div>
            )}
            {multiples_value != null && (
              <div className={`${cardBg} rounded-xl p-4 border ${border}`}>
                <p className={`text-xs ${muted} mb-1`}>Múltiplos de Mercado</p>
                <p className="text-lg font-bold">{fmtBRL(multiples_value)}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Assumptions ── */}
        {assumptions && Object.keys(assumptions).length > 0 && (
          <Collapsible title="Premissas da Análise" icon={Target} defaultOpen={true}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(assumptions).map(([k, v]) => (
                <div key={k}>
                  <dt className={`text-xs ${muted} capitalize`}>{k.replace(/_/g, ' ')}</dt>
                  <dd className="text-sm font-medium">{typeof v === 'number' ? fmt(v, 2) : String(v ?? '–')}</dd>
                </div>
              ))}
            </dl>
          </Collapsible>
        )}

        {/* ── Projections ── */}
        {projections && projections.length > 0 && (
          <Collapsible title="Projeções" icon={BarChart2} defaultOpen={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`${muted} text-xs`}>
                    {Object.keys(projections[0]).map(k => (
                      <th key={k} className="text-left py-1 pr-4 font-medium capitalize">{k.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projections.map((row, i) => (
                    <tr key={i} className={`border-t ${border}`}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="py-1.5 pr-4">
                          {typeof val === 'number' ? fmt(val, 0) : String(val ?? '–')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Collapsible>
        )}

        {/* ── Benchmark ── */}
        {benchmark && Object.keys(benchmark).length > 0 && (
          <Collapsible title="Benchmark Setorial" icon={Zap} defaultOpen={false}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(benchmark).map(([k, v]) => (
                <div key={k}>
                  <dt className={`text-xs ${muted} capitalize`}>{k.replace(/_/g, ' ')}</dt>
                  <dd className="text-sm font-medium">{typeof v === 'number' ? fmt(v, 2) : String(v ?? '–')}</dd>
                </div>
              ))}
            </dl>
          </Collapsible>
        )}

        {/* ── AI Analysis ── */}
        {ai_analysis && (
          <Collapsible title="Análise Inteligente" icon={FileText} defaultOpen={false}>
            <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
              {typeof ai_analysis === 'string'
                ? ai_analysis.split('\n').filter(Boolean).map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed mb-2 last:mb-0">{p}</p>
                  ))
                : <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(ai_analysis, null, 2)}</pre>
              }
            </div>
          </Collapsible>
        )}

        {/* ── Footer ── */}
        <div className={`text-center text-xs ${muted} pt-2 pb-4 flex items-center justify-center gap-1.5`}>
          <Shield className="w-3 h-3" />
          <span>Relatório gerado pela plataforma{' '}
            <a href="https://quantovale.online" target="_blank" rel="noopener noreferrer"
               className="hover:underline font-medium" style={{ color: primaryColor }}>
              Valuora
            </a>
          </span>
        </div>

      </div>
    </div>
  );
}
