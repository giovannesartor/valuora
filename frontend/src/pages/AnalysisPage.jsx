import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Gauge, TrendingUp, Shield, BarChart3, Sparkles, AlertTriangle, Info, ChevronDown, ChevronUp, Lock, Target, Users, Zap, Activity, Percent, HeartPulse, Download, CheckCircle, HelpCircle, ArrowRight, Layers, Calculator, Building2, Copy, Archive, Edit3, MoreVertical, Trash2, Share2, ShieldCheck, CreditCard, GitBranch, Dice6, Crown, Crosshair, History, ImageDown, Maximize2, Minimize2, FileText, Database, Bell, TableProperties, Printer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import toast from 'react-hot-toast';
import api from '../lib/api';
import formatBRL from '../lib/formatBRL';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import ConfirmDialog from '../components/ConfirmDialog';

const QUAL_DIMENSION_LABELS = {
  equipe: 'Team',
  governanca: 'Governance',
  mercado: 'Market',
  clientes: 'Clients',
  produto: 'Product',
  operacao: 'Operations',
  tracao: 'Traction',
  // Legacy (mantido para retrocompatibilidade)
  financeiro: 'Financial',
  diferenciacao: 'Differentiation',
  escalabilidade: 'Scalability',
};

/* ─── Reusable section wrapper ─── */
function Section({ title, description, icon: Icon, children, isDark, className = '' }) {
  return (
    <section className={`mb-8 ${className}`}>
      <div className="flex items-start gap-3 mb-4">
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <Icon className="w-4 h-4 text-emerald-600" />
          </div>
        )}
        <div>
          <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
          {description && <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ─── Info tooltip ─── */
function InfoTip({ text, isDark }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <HelpCircle
        className={`w-3.5 h-3.5 cursor-help ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      />
      {show && (
        <span className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-lg text-xs leading-relaxed z-50 shadow-xl ${isDark ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'}`}>
          {text}
        </span>
      )}
    </span>
  );
}

/* ─── Analysis Notes — persisted in DB ─── */
function AnalysisNotes({ analysisId, initialNotes, isDark }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  function handleChange(e) {
    setText(e.target.value);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/analyses/${analysisId}/notes`, { notes: text });
      setSaved(true);
    } catch {
      // fallback: save to localStorage
      try { localStorage.setItem(`qv:notes:${analysisId}`, text); } catch {}
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setText('');
    setSaved(false);
  }

  return (
    <section className="mb-8">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-3 w-full text-left group`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Notes &amp; Comentários</h3>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {open ? 'Click to close' : text ? `${text.slice(0, 60)}${text.length > 60 ? '…' : ''}` : 'Add personal notes about this analysis'}
          </p>
        </div>
        <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className={`mt-4 rounded-2xl border p-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <textarea
            value={text}
            onChange={handleChange}
            rows={6}
            placeholder="Write your notes, insights, or next steps about this analysis..."
            className={`w-full rounded-xl border px-4 py-3 text-sm resize-none outline-none transition focus:ring-2 focus:ring-emerald-500/40 ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
          <div className="flex items-center justify-between mt-3">
            <span className={`text-xs ${saved ? (isDark ? 'text-slate-600' : 'text-slate-400') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>
              {saved ? 'Saved on server' : 'Unsaved changes'}
            </span>
            <div className="flex gap-2">
              {text && (
                <button
                  onClick={handleClear}
                  className={`text-xs px-3 py-1.5 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-500 hover:text-red-500 hover:bg-red-50'}`}
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saved || saving}
                className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


/* ─── Custom Tooltip for Recharts ─── */
function CustomTooltip({ active, payload, label, isDark }) {
  if (!active || !payload || !payload.length) return null;
  
  return (
    <div className={`p-3 rounded-xl shadow-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      {label && <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: entry.color }} />
          <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <span className="font-medium">{entry.name}:</span> {typeof entry.value === 'number' && entry.value >= 1000000 
              ? `R$ ${(entry.value / 1000000).toFixed(2)}M` 
              : typeof entry.value === 'number' && entry.value >= 1000
              ? `R$ ${(entry.value / 1000).toFixed(1)}K`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Painel de Dados Extraídos (usado na página de resultado) ─── */
function ExtractedDatePanel({ analysis, isDark }) {
  const [open, setOpen] = useState(false);
  const ed      = analysis.extracted_data || {};
  const sources = ed._sources || {};
  const files   = analysis.uploaded_files || [];

  const fmt = (val, type) => {
    if (val === null || val === undefined) return '—';
    if (type === 'currency') {
      const n = Number(val);
      if (isNaN(n)) return '—';
      if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`;
      if (n >= 1_000)     return `R$ ${(n / 1_000).toFixed(1)}K`;
      return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
    }
    if (type === 'percent') {
      const n = Number(val);
      if (isNaN(n)) return '—';
      const pct = n > 1 ? n : n * 100;
      return `${pct.toFixed(2)}%`;
    }
    return String(val);
  };

  const rows = [
    { key: 'revenue',            label: 'Net Revenue',      type: 'currency' },
    { key: 'net_income',         label: 'Net Income',        type: 'currency' },
    { key: 'ebit',               label: 'EBIT',                 type: 'currency' },
    { key: 'gross_profit',       label: 'Gross Profit',          type: 'currency' },
    { key: 'cogs',               label: 'COGS',            type: 'currency' },
    { key: 'operating_expenses', label: 'Operating Expenses',type: 'currency' },
    { key: 'total_assets',       label: 'Total Assets',          type: 'currency' },
    { key: 'total_liabilities',  label: 'Total Debt',         type: 'currency' },
    { key: 'equity',             label: 'Net Equity',   type: 'currency' },
    { key: 'cash',               label: 'Cash',                type: 'currency' },
    { key: 'net_margin',         label: 'Net Margin',       type: 'percent'  },
    { key: 'growth_rate',        label: 'Growth Rate',  type: 'percent'  },
    { key: 'years_available',    label: 'Years of data',        type: 'text'     },
  ].filter(r => ed[r.key] !== null && ed[r.key] !== undefined);

  return (
    <div className={`border rounded-2xl mb-4 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between p-6 ${isDark ? 'text-white' : 'text-slate-900'}`}
      >
        <div className="flex items-center gap-3">
          <Datebase className="w-5 h-5 text-emerald-500" />
          <div className="text-left">
            <h3 className="font-semibold">Extracted Document Date</h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {rows.length} campo{rows.length !== 1 ? 's' : ''} extraído{rows.length !== 1 ? 's' : ''} automatically by AI
              {files.length > 0 && ` · ${files.length} arquivo${files.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {open && (
        <div className="px-6 pb-6">
          {/* Source dos documentos */}
          {files.length > 0 && (
            <div className={`flex flex-wrap gap-2 mb-5 pb-5 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <span className={`text-xs font-medium mr-1 self-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Documents:</span>
              {files.map((f, i) => (
                <span key={i} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <FileText className="w-3 h-3 text-emerald-500" />
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* Tabela de dados */}
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <th className={`py-2 px-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Field</th>
                <th className={`py-2 px-3 text-right text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Extracted value</th>
                <th className={`py-2 px-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, label, type }) => (
                <tr key={key} className={`border-b transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/40' : 'border-slate-50 hover:bg-slate-50'}`}>
                  <td className={`py-2 px-3 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</td>
                  <td className={`py-2 px-3 text-right tabular-nums font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    {fmt(ed[key], type)}
                  </td>
                  <td className={`py-2 px-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {sources[key] ? (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="truncate max-w-[140px]" title={sources[key]}>{sources[key]}</span>
                      </span>
                    ) : <span>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {ed.notes && (
            <p className={`mt-3 text-xs italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              📝 {ed.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── What-if Panel (pure-JS DCF) ─── */
function WhatIfPanel({ analysis, result, isDark }) {
  const [open, setOpen] = useState(false);
  const baseRevenue  = Number(analysis.revenue) || 0;
  const baseKe       = (result.parameters?.ke || 0.15) * 100;
  const baseMargin   = (Number(analysis.net_margin) || 0.10) * 100;
  const baseGrowth   = (Number(analysis.growth_rate) || 0.10) * 100;
  const baseYears    = analysis.valuation_result?.fcf_projections?.length || 10;

  const [margin, setMargin]   = useState(baseMargin.toFixed(1));
  const [growth, setGrowth]   = useState(baseGrowth.toFixed(1));
  const [ke, setKe]           = useState(baseKe.toFixed(1));

  // Simple DCF: sum of FCFE + terminal value
  const calcEquity = () => {
    const m = parseFloat(margin) / 100 || 0;
    const g = parseFloat(growth) / 100 || 0;
    const k = parseFloat(ke) / 100 || 0.15;
    const taxRate = 0.27;
    let pv = 0;
    let rev = baseRevenue;
    for (let t = 1; t <= baseYears; t++) {
      rev *= (1 + g);
      const fcf = rev * m * (1 - taxRate);
      pv += fcf / Math.pow(1 + k, t);
    }
    const gTerm = Math.min(g * 0.5, 0.035);
    const termFcf = rev * (1 + gTerm) * m * (1 - taxRate);
    const tv = k > gTerm ? termFcf / (k - gTerm) : 0;
    pv += tv / Math.pow(1 + k, baseYears);
    return pv;
  };

  const wifEquity = calcEquity();
  const baseEquity = Number(analysis.equity_value) || 1;
  const delta = ((wifEquity - baseEquity) / baseEquity) * 100;
  const fmtVal = (v) => {
    if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
    return `R$ ${v.toFixed(0)}`;
  };

  return (
    <div className={`border rounded-2xl mb-4 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between p-5 ${isDark ? 'text-white' : 'text-slate-900'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
            <Calculator className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">What-if Simulator</p>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Test alternative scenarios instantly</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-slate-400" /> : <ChevronDown className="w-4 h-4 flex-shrink-0 text-slate-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5">
          {/* Result badge */}
          <div className={`flex items-center justify-between p-4 rounded-xl mb-4 ${isDark ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-violet-50 border border-violet-100'}`}>
            <div>
              <p className={`text-[10px] uppercase tracking-wider font-semibold mb-0.5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>Simulated value</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>{fmtVal(wifEquity)}</p>
            </div>
            <div className={`text-right`}>
              <p className={`text-[10px] uppercase tracking-wider font-semibold mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>vs. current</p>
              <p className={`text-lg font-bold ${delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Net margin', value: margin, setValue: setMargin, unit: '%', min: 1, max: 60, step: 0.5 },
              { label: 'Annual growth', value: growth, setValue: setGrowth, unit: '%', min: 0, max: 100, step: 0.5 },
              { label: 'Cost of equity (Ke)', value: ke, setValue: setKe, unit: '%', min: 5, max: 50, step: 0.5 },
            ].map(({ label, value, setValue, unit, min, max, step }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}</label>
                  <span className={`text-xs font-bold tabular-nums ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{parseFloat(value).toFixed(1)}{unit}</span>
                </div>
                <input
                  type="range"
                  min={min} max={max} step={step}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  className="w-full accent-violet-500"
                />
              </div>
            ))}
          </div>
          <p className={`text-[10px] mt-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            * Simplified estimate (linear DCF). Actual results use the full engine with multiples, DLOM, qualitative factors, and IBGE adjustments.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── V1: Waterfall interactive tooltip ─────────────────── */
const WATERFALL_EXPLANATIONS = {
  'FCFE (PV)':          'Sum of cash flows to equity holders discounted to present value (DCF).',
  'Terminal Value':     'Residual value of the company beyond the projection period (perpetuity).',
  'Enterprise Value':   'Total business value before liquidity and control discounts.',
  'DLOM':               'Discount for Lack of Marketability — penalty for being a privately held company.',
  'Qualitative Adj.':   'Adjustment by qualitative score: governance, team, market, product, and traction.',
  'Survival Adj.':      'Adjustment by survival probability based on SEBRAE/IBGE data.',
  'Equity Value':       'Final estimated net equity value after all adjustments.',
  'Equity (Final)':     'Final value weighted between Gordon Growth and Exit Multiple methods.',
  'Subtotal':           "Accumulated value after this phase's adjustments.",
};

function WaterfallTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  const explanation = Object.entries(WATERFALL_EXPLANATIONS).find(([k]) =>
    (d.label || label || '').toLowerCase().includes(k.toLowerCase())
  )?.[1] || 'Component of the Equity Value calculation.';
  return (
    <div className={`rounded-xl border p-3 shadow-xl max-w-[220px] text-xs ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
      <p className="font-semibold mb-1">{d.label || label}</p>
      <p className={`font-bold text-sm ${payload[0]?.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(payload[0]?.value)}
      </p>
      <p className={`mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{explanation}</p>
    </div>
  );
}

/* ─── P1: useInView — Intersection Observer lazy-mount ─── */
function useInView(options = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (inView) return; // once visible, stay mounted
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '200px 0px', ...options }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.current]);
  return [ref, inView];
}

/* ─── P1: LazySection — only renders children when scrolled into view ─── */
function LazySection({ children, minHeight = 160 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '300px 0px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []); // eslint-disable-line
  return (
    <div ref={ref}>
      {inView ? children : <div style={{ minHeight }} />}
    </div>
  );
}

export default function AnalysisPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  usePageTitle(analysis?.company_name || 'Analysis');
  const [paying, setPaying] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [couponError, setCouponError] = useState('');
  const [showFCFTable, setShowFCFTable] = useState(false);
  const [showPnlTable, setShowPnlTable] = useState(false);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showDlomDetails, setShowDlomDetails] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // U3: version history
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions]         = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  // U8: PNG export
  const [exportingPng, setExportingPng] = useState(false);
  const analysisContentRef = useRef(null);
  // U9: presentation / fullscreen mode
  const [presentationMode, setPresentationMode] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [sharePasswordEnabled, setSharePasswordEnabled] = useState(false);
  const [sharePasswordSaving, setSharePasswordSaving] = useState(false);
  // Alert threshold modal
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(10); // percent (5–50)
  const [alertSaving, setAlertSaving] = useState(false);
  // Excel export
  const [xlsxDownloading, setXlsxDownloading] = useState(false);
  const [genProgress, setGenProgress] = useState(null); // { step, message, pct, done, error }
  // F6: NPS post-analysis
  const [showNps, setShowNps] = useState(false);
  const [npsScore, setNpsScore] = useState(null);
  const [npsComment, setNpsComment] = useState('');
  const [npsSent, setNpsSent] = useState(false);
  const npsShownRef = useRef(false);
  const genEsRef = useRef(null);
  // New feature states
  const [maComparables, setMaComparables] = useState(null);
  const [maLoading, setMaLoading] = useState(false);
  const [valuationHistory, setValuationHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  // V7+V2: count-up animation
  const [countUpValue, setCountUpValue] = useState(0);
  // F5: version diff
  const [selectedVersionDiff, setSelectedVersionDiff] = useState(null);
  const { isDark } = useTheme();
  const pollingAbortRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingAbortRef.current = true;
      if (genEsRef.current) { clearInterval(genEsRef.current); genEsRef.current = null; }
    };
  }, []);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/analyses/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-quantovale-${analysis?.company_name || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error downloading PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDuplicate = async () => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const { data: newAnalysis } = await api.post(`/analyses/${id}/duplicate`);
      toast.success('Analysis duplicada com sucesso!');
      navigate(`/analise/${newAnalysis.id}`);
      setShowActionMenu(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error duplicating analysis.');
    } finally {
      setDuplicating(false);
    }
  };

  const handleArchive = async () => {
    if (archiving) return;
    setArchiving(true);
    try {
      await api.patch(`/analyses/${id}`, { deleted_at: new Date().toISOString() });
      toast.success('Analysis arquivada!');
      navigate('/dashboard');
      setShowActionMenu(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error archiving analysis.');
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(true);
    setShowActionMenu(false);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/analyses/${id}`);
      toast.success('Analysis excluída!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error deleting analysis.');
    }
  };

  // U3: load version history
  const handleOpenVersions = async () => {
    setShowVersions(true);
    setVersionsLoading(true);
    try {
      const { data } = await api.get(`/analyses/${id}/versions`);
      setVersions(data || []);
    } catch {
      toast.error('Error loading history.');
    } finally {
      setVersionsLoading(false);
    }
  };

  // U8: export PNG using html2canvas
  const handleExportPng = async () => {
    if (!analysisContentRef.current) return;
    setExportingPng(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(analysisContentRef.current, { scale: 2, useCORS: true, backgroundColor: isDark ? '#0f172a' : '#ffffff' });
      const link = document.createElement('a');
      link.download = `valuation-${analysis?.company_name || id}.png`;
      link.href = canvas.toDateURL('image/png');
      link.click();
      toast.success('Image exported!');
    } catch {
      toast.error('Error exporting image. Try again.');
    } finally {
      setExportingPng(false);
    }
  };

  // U9: presentation mode — Escape to exit
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && presentationMode) setPresentationMode(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presentationMode]);

  const handleEdit = () => {
    navigate(`/analise/${id}/editar`);
    setShowActionMenu(false);
  };

  // F4: Export valuation data as CSV
  const handleExportCSV = () => {
    const rows = [];
    rows.push(['=== VALUORA — VALUATION DATA ===']);
    rows.push(['Company', analysis.company_name]);
    rows.push(['Sector', analysis.sector]);
    rows.push(['Equity Value (R$)', analysis.equity_value || 0]);
    rows.push(['Date', new Date(analysis.created_at).toLocaleDateString('pt-BR')]);
    rows.push([]);
    rows.push(['=== DCF PARAMETERS ===']);
    rows.push(['WACC (%)', ((result.parameters?.wacc || 0) * 100).toFixed(2)]);
    rows.push(['Cost of Equity Ke (%)', ((result.parameters?.ke || 0) * 100).toFixed(2)]);
    rows.push(['Beta', (result.parameters?.beta || 0).toFixed(3)]);
    rows.push(['Selic (%)', ((result.parameters?.selic || 0) * 100).toFixed(2)]);
    rows.push(['CRP (%)', ((result.parameters?.crp || 0) * 100).toFixed(2)]);
    rows.push(['Risk Score', (analysis.risk_score || 0).toFixed(1)]);
    rows.push([]);
    if (projections.length) {
      rows.push(['=== CASH FLOW PROJECTIONS (FCFE) ===']);
      rows.push(['Year', 'Revenue (R$)', 'Net Margin (%)', 'FCFE (R$)', 'PV of FCFE (R$)']);
      projections.forEach(p => {
        rows.push([p.year, p.revenue?.toFixed(0) || 0, ((p.margin || 0) * 100).toFixed(1), p.fcf?.toFixed(0) || 0, p.pv?.toFixed(0) || 0]);
      });
    }
    const csv = rows.map(r => (Array.isArray(r) ? r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',') : '')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valuation-${analysis.company_name?.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${analysis.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Date exported as CSV!');
  };

  const handleShare = async () => {
    if (shareLink) {
      setShowShareModal(true);
      return;
    }
    setShareLoading(true);
    try {
      const res = await api.post(`/analyses/${id}/share`);
      const link = `${window.location.origin}/compartilhado/${res.data.share_token}`;
      setShareLink(link);
      setShowShareModal(true);
    } catch {
      toast.error('Error generating link.');
    } finally {
      setShareLoading(false);
    }
  };

  const handleSharePassword = async () => {
    setSharePasswordSaving(true);
    try {
      await api.post(`/analyses/${id}/share`, {
        password: sharePasswordEnabled ? sharePassword : '',
      });
      toast.success(sharePasswordEnabled ? 'Share password saved!' : 'Password protection removed.');
    } catch {
      toast.error('Error saving password.');
    } finally {
      setSharePasswordSaving(false);
    }
  };

  const handleExportXLSX = async () => {
    setXlsxDownloading(true);
    try {
      const response = await api.get(`/analyses/${id}/export/xlsx`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `valuation-${analysis?.company_name?.replace(/\s+/g, '-').toLowerCase() || id}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel exported successfully!');
    } catch {
      toast.error('Error exporting Excel.');
    } finally {
      setXlsxDownloading(false);
    }
  };

  const handleSaveAlert = async () => {
    setAlertSaving(true);
    try {
      await api.put(`/analyses/${id}/alert`, { threshold_pct: alertThreshold / 100 });
      toast.success(`Alert set: notify when value changes ≥ ${alertThreshold}%`);
      setShowAlertModal(false);
    } catch {
      toast.error('Error saving alert.');
    } finally {
      setAlertSaving(false);
    }
  };

  const handleClearAlert = async () => {
    setAlertSaving(true);
    try {
      await api.put(`/analyses/${id}/alert`, { threshold_pct: null });
      toast.success('Alert removed.');
      setShowAlertModal(false);
    } catch {
      toast.error('Error removing alert.');
    } finally {
      setAlertSaving(false);
    }
  };

  useEffect(() => {
    api.get(`/analyses/${id}`)
      .then((res) => {
        setAnalysis(res.data);
        if (res.data.reanalysis_alert_pct) {
          setAlertThreshold(Math.round(res.data.reanalysis_alert_pct * 100));
        }
        if (res.data.share_token) {
          setShareLink(`${window.location.origin}/compartilhado/${res.data.share_token}`);
        }
      })
      .catch(() => {
        toast.error('Analysis não encontrada.');
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  // F6: NPS trigger — 30s after viewing a paid completed analysis
  useEffect(() => {
    if (!analysis || !analysis.plan || npsShownRef.current) return;
    const npsKey = `qv:nps:shown:${analysis.id}`;
    if (localStorage.getItem(npsKey)) return;
    const timer = setTimeout(() => {
      setShowNps(true);
      npsShownRef.current = true;
    }, 30000);
    return () => clearTimeout(timer);
  }, [analysis]);

  // V7+V2: count-up animation on equity value load
  useEffect(() => {
    const target = Number(analysis?.equity_value || 0);
    if (target === 0) { setCountUpValue(0); return; }
    if (!analysis?.plan) { setCountUpValue(target); return; }
    const duration = 1200;
    const startTime = performance.now();
    let rafId;
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCountUpValue(Math.round(target * eased));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.id]);

  const fmtBRL = (v) => formatBRL(v, { abbreviate: true });

  const _startGenProgressStream = (analysisId) => {
    // Close any existing stream
    if (genEsRef.current) { clearInterval(genEsRef.current); genEsRef.current = null; }
    setGenProgress({ step: 1, message: 'Starting report generation…', pct: 5, done: false, error: null });

    const MAX_POLLS = 150; // 150 × 2s = 5 min
    let polls = 0;

    const tick = async () => {
      polls += 1;
      if (polls > MAX_POLLS) {
        clearInterval(genEsRef.current);
        genEsRef.current = null;
        toast.error('Time limit exceeded. Refresh the page to check the report status.');
        setGenProgress(null);
        return;
      }
      try {
        const { data } = await api.get(`/analyses/${analysisId}/generation-status`);
        setGenProgress(data);
        if (data.done || data.error) {
          clearInterval(genEsRef.current);
          genEsRef.current = null;
          if (data.error) {
            toast.error('Error generating the report. Try again or contact support.');
            setTimeout(() => setGenProgress(null), 3000);
          } else {
            setTimeout(async () => {
              const { data: updated } = await api.get(`/analyses/${analysisId}`);
              setAnalysis(updated);
              setGenProgress(null);
            }, 1200);
          }
        }
      } catch { /* ignore */ }
    };

    genEsRef.current = setInterval(tick, 2000);
    tick(); // immediate first check
  };

  const handlePayment = async (plan) => {
    setPaying(true);
    setCouponError('');
    try {
      const { data: paymentDate } = await api.post('/payments/', { analysis_id: id, plan, coupon: coupon.trim() || undefined });

      // Admin bypass = instant payment (status is already PAID)
      if (paymentDate.status === 'paid') {
        toast.success('Payment confirmed! Report being generated...');
        window.gtag?.('event', 'ads_conversion_purchase', { plan });
        _startGenProgressStream(id);
      } else if (paymentDate.asaas_invoice_url) {
        // Regular user: redirect to Asaas payment page
        toast.success('Redirecting to payment...');
        window.open(paymentDate.asaas_invoice_url, '_blank');
        // Start polling for payment confirmation
        _pollPaymentStatus(paymentDate.id);
      } else {
        toast.error('Error: Payment URL not available.');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Payment error.';
      if (detail.toLowerCase().includes('cupom')) setCouponError(detail);
      else toast.error(detail);
    } finally {
      setPaying(false);
    }
  };

  const _pollPaymentStatus = async (paymentId) => {
    pollingAbortRef.current = false;
    const pollIntervals = [1000, 2000, 5000, 10000]; // Exponential backoff: 1s, 2s, 5s, 10s
    let attempt = 0;
    const maxAttempts = 60; // poll for up to 5 minutes
    
    const poll = async () => {
      if (pollingAbortRef.current || attempt >= maxAttempts) return;
      
      try {
        const { data: statusDate } = await api.get(`/payments/${paymentId}/status`);
        if (statusDate.status === 'paid') {
          toast.success('Payment confirmed! Report being generated...');
          window.gtag?.('event', 'ads_conversion_purchase', { plan: analysis?.plan || 'unknown' });
          _startGenProgressStream(id);
          return;
        }
      } catch {
        // ignore polling errors
      }
      
      attempt++;
      const interval = pollIntervals[Math.min(attempt - 1, pollIntervals.length - 1)];
      await new Promise(r => setTimeout(r, interval));
      
      if (!pollingAbortRef.current) {
        poll();
      }
    };
    
    poll();
  };

  // P2: memoize heavy chart data — must be declared before any early return (Rules of Hooks)
  const projections = analysis?.valuation_result?.fcf_projections || [];
  const chartDate = useMemo(() => projections.map((p) => ({
    name: `Year ${p.year}`,
    receita: p.revenue,
    fcfe: p.fcf,
  })), [projections]);

  // V5: Skeleton loader
  if (loading) return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`border-b h-16 ${isDark ? 'bg-slate-900 border-slate-800 animate-pulse' : 'bg-white border-slate-200 animate-pulse'}`}>
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center gap-4">
          <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
          <div className={`w-10 h-10 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
          <div className={`w-40 h-4 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-4">
        <div className={`rounded-2xl h-52 ${isDark ? 'bg-emerald-900/30' : 'bg-emerald-100'} animate-pulse`} />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`rounded-2xl h-24 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} animate-pulse`} />
          ))}
        </div>
        <div className={`rounded-2xl h-72 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} animate-pulse`} />
        <div className={`rounded-2xl h-44 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} animate-pulse`} />
        <div className={`rounded-2xl h-56 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} animate-pulse`} />
      </div>
    </div>
  );
  if (!analysis) return null;

  const isPaid = !!analysis.plan;

  const result = analysis.valuation_result || {};
  // projections is declared above (before early returns) to satisfy Rules of Hooks
  const pnlProjections = result.pnl_projections || [];
  const range = result.valuation_range || {};
  const multVal = result.multiples_valuation || {};
  const sensitivity = result.sensitivity_table || {};
  const waterfall = result.waterfall || [];
  const tvInfo = result.terminal_value_gordon || result.terminal_value_info || {};
  const tvExit = result.terminal_value_exit || {};
  const tvPct = result.tv_percentage || 0;
  const dlom = result.dlom || {};
  const survival = result.survival || {};
  const qual = result.qualitative || {};
  const investRound = result.investment_round || {};
  const eqGordon = result.equity_value_gordon || 0;
  const eqExit = result.equity_value_exit_multiple || 0;
  const evGordon = result.enterprise_value_gordon || 0;
  const evExit = result.enterprise_value_exit || 0;
  const betaU = result.beta_unlevered || 0;
  const dcfWeight = result.dcf_weight || 0.5;
  const multWeight = result.multiples_weight || 0;
  const monteCarlo = result.monte_carlo || {};
  const peers = result.peers || {};
  const controlPremium = result.control_premium || {};
  const tvFade = result.tv_fade || {};
  const taxInfo = result.tax_info || {};
  // New features
  const lboAnalysis = result.lbo_analysis || {};
  const ddm = result.ddm || {};
  const investorReadiness = result.investor_readiness || {};
  const historicalTrend = result.historical_trend || null;

  // ── Completeness score ─────────────────────────────────
  const completenessScore = (() => {
    const checks = [
      !!analysis.company_name,
      !!analysis.cnpj,
      !!analysis.logo_path,
      !!analysis.sector,
      !!(analysis.extracted_data && Object.keys(analysis.extracted_data).filter(k => !k.startsWith('_') && analysis.extracted_data[k] !== null).length > 3),
      !!(analysis.qualitative_answers && Object.keys(analysis.qualitative_answers).length >= 5),
      !!(analysis.ai_analysis && analysis.ai_analysis.length > 50),
      !!analysis.equity_value,
      !!(analysis.valuation_result && analysis.valuation_result.fcf_projections?.length > 0),
      !!(analysis.notes && analysis.notes.length > 0),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  })();

  const qualRadarDate = qual.dimensions ? Object.entries(qual.dimensions).map(([key, val]) => ({
    dimension: QUAL_DIMENSION_LABELS[key] || key,
    score: val,
    fullMark: 5,
  })) : [];

  // M&A comparables loader
  const loadMaComparables = async () => {
    setMaLoading(true);
    try {
      const res = await api.get(`/analyses/${id}/ma-comparables`);
      setMaComparables(res.data);
    } catch { toast.error('Failed to load M&A comparables'); }
    finally { setMaLoading(false); }
  };
  // Valuation history loader
  const loadValuationHistory = async () => {
    if (!analysis?.company_name) return;
    setHistoryLoading(true);
    try {
      const res = await api.get(`/analyses/valuation-history?company_name=${encodeURIComponent(analysis.company_name)}`);
      setValuationHistory(res.data);
    } catch {}
    finally { setHistoryLoading(false); }
  };

  const waterfallColors = { positive: '#22c55e', negative: '#ef4444', subtotal: '#059669', total: '#8b5cf6' };

  return (
    <>
      {/* Generation progress modal — also shows error state */}
      {genProgress && !genProgress.done && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`rounded-2xl border p-8 w-full max-w-sm mx-4 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            {genProgress.error ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  </div>
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Generation error</p>
                </div>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>An error occurred while generating the report. Our team has been notified. Try again in a few minutes.</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-500 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                  <div>
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Generating report</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {Math.round(genProgress.pct || 0)}% completed
                      {genProgress.eta_seconds != null && genProgress.eta_seconds > 0 && (
                        <span> · aprox. {genProgress.eta_seconds >= 60 ? `${Math.ceil(genProgress.eta_seconds / 60)} min` : `${genProgress.eta_seconds}s`} remaining</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className={`h-2 rounded-full mb-4 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${genProgress.pct || 5}%` }}
                  />
                </div>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{genProgress.message}</p>
              </>
            )}
          </div>
        </div>
      )}

      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <button onClick={() => navigate('/dashboard')} className={`transition-colors duration-200 flex-shrink-0 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            {analysis.logo_path && (
              <img
                src={`${(import.meta.env.VITE_API_URL || '/api/v1').replace('/api/v1', '')}/uploads/${analysis.logo_path}`}
                alt="Logo"
                className="w-9 h-9 rounded-lg object-contain shrink-0"
                loading="lazy"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{analysis.company_name}</h1>
                <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                  completenessScore >= 80
                    ? (isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700')
                    : completenessScore >= 50
                    ? (isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-amber-200 bg-amber-50 text-amber-700')
                    : (isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-700')
                }`} title="Company profile completeness score">
                  {completenessScore}%
                </span>
              </div>
              <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{analysis.sector?.charAt(0).toUpperCase() + analysis.sector?.slice(1)} • {result.parameters?.projection_years || 10} years</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Action buttons */}
            <div className="hidden sm:flex items-center gap-2">
              {isPaid && (
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}
                  title="Share analysis"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{shareLoading ? 'Generating…' : shareLink ? 'Copied!' : 'Share'}</span>
                </button>
              )}
              <button
                onClick={handleDuplicate}
                disabled={duplicating}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                title="Duplicate analysis"
              >
                {duplicating ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Copy className="w-4 h-4" />}
                <span>{duplicating ? 'Duplicating...' : 'Duplicate'}</span>
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                title="Archive analysis"
              >
                {archiving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Archive className="w-4 h-4" />}
                <span>{archiving ? 'Archiving...' : 'Archive'}</span>
              </button>
              <button
                onClick={handleEdit}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                title="Edit analysis"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit</span>
              </button>
              {isPaid && (
                <Link
                  to={`/simulador/${id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}
                  title="Simulate scenarios"
                >
                  <Calculator className="w-4 h-4" />
                  <span>Simulate</span>
                </Link>
              )}
              {/* U3: Version history */}
              <button
                onClick={handleOpenVersions}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                title="Version history"
              >
                <History className="w-4 h-4" />
                <span>History</span>
              </button>
              {/* U8: Export as PNG */}
              <button
                onClick={handleExportPng}
                disabled={exportingPng}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                title="Export as image"
              >
                {exportingPng ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <ImageDown className="w-4 h-4" />}
                <span>{exportingPng ? 'Exporting...' : 'Image'}</span>
              </button>
              {/* U9: Presentation mode */}
              <button
                onClick={() => setPresentationMode(m => !m)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                title={presentationMode ? 'Exit presentation mode' : 'Presentation mode'}
              >
                {presentationMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span>{presentationMode ? 'Log Out' : 'Present'}</span>
              </button>
              {/* F4: Export CSV */}
              {isPaid && (
                <button
                  onClick={handleExportCSV}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                  title="Export data as CSV"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV</span>
                </button>
              )}
            </div>

            {/* Mobile action menu */}
            <div className="relative sm:hidden">
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className={`p-2 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showActionMenu && (
                <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl border shadow-xl z-50 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <button
                    onClick={handleDuplicate}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <Copy className="w-4 h-4" />
                    <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Duplicate</span>
                  </button>
                  {isPaid && (
                    <button
                      onClick={() => { handleShare(); setShowActionMenu(false); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    >
                      <Share2 className="w-4 h-4 text-emerald-500" />
                      <span className={`text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Share</span>
                    </button>
                  )}
                  <button
                    onClick={handleArchive}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <Archive className="w-4 h-4" />
                    <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Archive</span>
                  </button>
                  <button
                    onClick={handleEdit}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Edit</span>
                  </button>
                  {isPaid && (
                    <Link
                      to={`/simulador/${id}`}
                      onClick={() => setShowActionMenu(false)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    >
                      <Calculator className="w-4 h-4 text-emerald-500" />
                      <span className={`text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Simulate scenarios</span>
                    </Link>
                  )}
                  <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Delete</span>
                  </button>
                </div>
              )}
            </div>

            {isPaid && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAlertModal(true)}
                  title="Configure re-analysis alert"
                  className={`p-2 rounded-xl border transition ${analysis?.reanalysis_alert_pct ? 'border-amber-400 text-amber-500 bg-amber-400/10' : isDark ? 'border-slate-700 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}
                >
                  <Bell className="w-4 h-4" />
                </button>
                <button
                  onClick={handleExportXLSX}
                  disabled={xlsxDownloading}
                  title="Export to Excel"
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 disabled:opacity-50 border ${isDark ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                >
                  <TableProperties className={`w-4 h-4 ${xlsxDownloading ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline">{xlsxDownloading ? '...' : 'Excel'}</span>
                </button>
                {/* V6: Print button */}
                <button
                  onClick={() => window.print()}
                  title="Print report"
                  className={`no-print hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 border ${isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="flex items-center gap-2 bg-emerald-600 hover:brightness-110 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                >
                  <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
                  <span className="hidden sm:inline">{downloading ? 'Downloading...' : 'Download PDF'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Upsell sticky bar (unpaid) ─────────────────── */}
      {!isPaid && (
        <div className="sticky top-0 z-30 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <Crown className="w-4 h-4 text-emerald-200 shrink-0" />
            <p className="text-white text-sm font-medium truncate">
              <strong>Your valuation is ready!</strong>{' '}
              <span className="hidden sm:inline">Unlock benchmarks, full DCF, projected P&L, and AI analysis.</span>
            </p>
          </div>
          <a
            href="#payment-section"
            className="flex-shrink-0 flex items-center gap-1.5 bg-white text-emerald-700 text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-50 transition shadow-sm whitespace-nowrap"
          >
            View plans <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* U9: Presentation mode wrapper */}
      <div className={presentationMode ? `fixed inset-0 z-40 overflow-y-auto ${isDark ? 'bg-slate-950' : 'bg-white'}` : ''}>
        {presentationMode && (
          <div className={`sticky top-0 z-50 border-b flex items-center justify-between px-6 py-3 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{analysis.company_name} — Presentation Mode</span>
            <button onClick={() => setPresentationMode(false)} className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
              <Minimize2 className="w-4 h-4" /> Exit
            </button>
          </div>
        )}
        <main ref={analysisContentRef} className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-0">

        {/* ═══════════════════════════════════════════════════
            1. HERO — Valor Final + Faixa
        ═══════════════════════════════════════════════════ */}
        <div className="bg-emerald-700 rounded-2xl p-6 md:p-10 mb-6 relative overflow-hidden">
          {/* decorative circles */}
          <div className="absolute -right-16 -top-16 w-56 h-56 bg-white/5 rounded-full" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full" />

          <div className="relative z-10 text-center">
            <p className="text-emerald-100 text-xs uppercase tracking-widest mb-1 font-medium">Estimated equity value</p>
            <p className="text-emerald-200 text-[11px] mb-4">Método DCF (Fluxo de Cash Descontado) + Múltiplos de Market</p>

            {isPaid ? (
              <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-1 tracking-tight">
                {fmtBRL(countUpValue > 0 ? countUpValue : analysis.equity_value)}
              </h2>
            ) : (
              <div className="relative mb-1">
                <h2 className="text-4xl md:text-6xl font-extrabold text-white blur-lg select-none" aria-hidden="true">
                  {fmtBRL(analysis.equity_value)}
                </h2>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/10">
                    <Lock className="w-5 h-5 text-white" />
                    <span className="text-white font-semibold text-sm">Unlock the exact value</span>
                  </div>
                </div>
              </div>
            )}

            {/* Equity = 0 explanation */}
            {isPaid && analysis.equity_value <= 0 && (
              <p className="text-emerald-200 text-xs max-w-md mx-auto mb-3">
                The value resulted in R$ 0 because the company's financial data (margins, revenue, debt) did not generate sufficient positive cash flow to sustain market value.
              </p>
            )}

            {/* Range bar */}
            <div className="max-w-sm mx-auto mt-5">
              <div className="flex justify-between text-[10px] text-emerald-200/80 mb-1 font-medium uppercase tracking-wider">
                <span>Conservative</span>
                <span>Base</span>
                <span>Optimistic</span>
              </div>
              <div className="relative h-2.5 bg-white/15 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/60 z-10 rounded" />
                <div className="h-full bg-gradient-to-r from-red-400 via-emerald-300 to-green-400 rounded-full" />
              </div>
              <div className={`flex justify-between text-xs mt-1.5 font-semibold ${!isPaid ? 'blur-sm select-none' : ''}`}>
                <span className="text-red-200">{fmtBRL(range.low)}</span>
                <span className="text-white">{fmtBRL(range.mid)}</span>
                <span className="text-green-200">{fmtBRL(range.high)}</span>
              </div>
              {range.spread_pct && (
                <p className="text-emerald-200/70 text-[10px] mt-1.5">Range of ±{range.spread_pct}% adjusted to risk level</p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            ALERTAS (TV, engine warnings)
        ═══════════════════════════════════════════════════ */}
        {tvPct > 75 && (
          <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              <strong>{tvPct.toFixed(0)}%</strong> of the value comes from Terminal Value (future growth). Evaluate with caution — young companies often have this profile.
            </p>
          </div>
        )}
        {tvInfo.warnings && tvInfo.warnings.length > 0 && (
          <div className={`flex items-start gap-3 p-4 rounded-xl mb-4 ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              {tvInfo.warnings.map((w, i) => (
                <p key={i} className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* ═══ F3: Smart metric alerts ═══ */}
        {isPaid && (dlom.dlom_pct || 0) > 0.30 && (
          <div className={`flex items-center gap-3 p-3.5 rounded-xl mb-3 ${isDark ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'}`}>
            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <p className={`text-sm ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
              <strong>High DLOM ({(dlom.dlom_pct * 100).toFixed(0)}%)</strong> — discount above 30% indicates low liquidity and/or high company risk. Consider improving governance and financial metrics.
            </p>
          </div>
        )}
        {isPaid && (result.wacc || 0) > 0.25 && (
          <div className={`flex items-center gap-3 p-3.5 rounded-xl mb-3 ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>
              <strong>High Ke ({((result.wacc || 0) * 100).toFixed(1)}%)</strong> — cost of capital above 25% significantly compresses the valuation. Review the company's risk profile.
            </p>
          </div>
        )}
        {isPaid && tvPct > 80 && (
          <div className={`flex items-center gap-3 p-3.5 rounded-xl mb-3 ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
              <strong>Terminal Value accounts for {tvPct.toFixed(0)}% of the value</strong> — very high concentration in the future. The valuation depends critically on long-term assumptions.
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            2. INDICADORES-CHAVE — Overview rápido
        ═══════════════════════════════════════════════════ */}
        <Section
          title="Key Indicators"
          description="Financial metrics used in the valuation calculation"
          icon={Activity}
          isDark={isDark}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Ke', value: `${((result.wacc || 0) * 100).toFixed(1)}%`, icon: TrendingUp, free: true, tip: 'Cost of equity (Valuora v6) — 5-factor beta + dynamic CRP.' },
              { label: 'Risk Score', value: `${(analysis.risk_score || 0).toFixed(1)}/100`, icon: Shield, free: true, tip: 'The higher, the riskier the company. Considers maturity, sector, and financial data.' },
              { label: 'Maturity', value: `${(analysis.maturity_index || 0).toFixed(1)}/100`, icon: Gauge, free: false, tip: 'Business consolidation level based on operating time, revenue, and structure.' },
              { label: 'DLOM', value: dlom.dlom_pct ? `${(dlom.dlom_pct * 100).toFixed(0)}%` : '—', icon: Percent, free: false, tip: 'Discount for Lack of Marketability — the only post-DCF discount applied for being a privately held company.' },
              { label: 'Tax Regime', value: taxInfo.regime ? taxInfo.regime.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : '—', icon: Building2, free: false, tip: `Effective rate: ${taxInfo.effective_tax_rate ? (taxInfo.effective_tax_rate * 100).toFixed(1) + '%' : '—'} (vs. nominal 34%). Automatically detected by revenue.` },
              { label: 'Qualitative', value: qual.score !== undefined ? `${qual.score}/100` : '—', icon: Target, free: false, tip: 'Qualitative assessment of team, governance, market, clients, product, operations, and traction.' },
            ].map((m, i) => (
              <div key={i} className={`relative border rounded-2xl p-4 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="w-4 h-4 text-emerald-500" />
                  <span className={`text-[10px] md:text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.label}</span>
                  <InfoTip text={m.tip} isDark={isDark} />
                </div>
                <p className={`text-xl md:text-2xl font-semibold tabular-nums ${!isPaid && !m.free ? 'blur-md select-none' : ''} ${isDark ? 'text-white' : 'text-slate-900'}`}>{m.value}</p>
                {!isPaid && !m.free && (
                  <div className="absolute inset-0 rounded-2xl flex items-center justify-center">
                    <Lock className={`w-4 h-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* F1: Score decomposition — visual stacked bar */}
          {isPaid && (dlom.dlom_pct || qual.adjustment || survival.survival_rate) && (
            <div className={`mt-4 rounded-xl border p-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[10px] uppercase font-semibold tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Discount Decomposition</p>
              <div className="space-y-2">
                {[
                  { label: 'DLOM (illiquidity)', pct: (dlom.dlom_pct || 0) * 100, color: 'bg-orange-500' },
                  { label: 'Ajuste Qualitative', pct: Math.abs((qual.adjustment || 0) * 100), positive: (qual.adjustment || 0) >= 0, color: (qual.adjustment || 0) >= 0 ? 'bg-emerald-500' : 'bg-red-500' },
                  { label: 'Survival (TV impact)', pct: ((1 - (survival.survival_rate || 1)) * 100), color: 'bg-amber-500' },
                ].filter(d => d.pct > 0).map((d) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className={`text-xs w-44 flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.label}</span>
                    <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                      <div className={`h-full rounded-full ${d.color}`} style={{ width: `${Math.min(d.pct * 2, 100)}%` }} />
                    </div>
                    <span className={`text-xs font-medium w-12 text-right tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {d.positive !== false ? '' : '-'}{d.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
              <p className={`text-[10px] mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Bars proportional to each factor's impact on the final value.</p>
            </div>
          )}
        </Section>

        {/* DCF Gordon vs Exit Multiple vs Múltiplos */}
        {isPaid ? (
          <>

          {/* ═══════════════════════════════════════════════════
              3. COMO CHEGAMOS NESSE VALOR — Métodos
          ═══════════════════════════════════════════════════ */}
          <Section
            title="How we arrived at this value"
            description="Three independent methods are combined for greater accuracy"
            icon={Calculator}
            isDark={isDark}
          >
            {/* Step indicator */}
            <div className={`flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-wider mb-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 inline-flex items-center justify-center text-[10px]">1</span> DCF</span>
              <ArrowRight className="w-3 h-3" />
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-500 inline-flex items-center justify-center text-[10px]">2</span> Múltiplos</span>
              <ArrowRight className="w-3 h-3" />
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-500 inline-flex items-center justify-center text-[10px]">3</span> Adjustments</span>
              <ArrowRight className="w-3 h-3" />
              <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 inline-flex items-center justify-center text-[10px]">4</span> Final</span>
            </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* DCF Gordon */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>DCF Gordon Growth</h4>
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Perpetuity with constant growth</p>
            <p className={`text-2xl font-semibold tabular-nums mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtBRL(eqGordon)}</p>
            <div className={`text-xs space-y-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <div className="flex justify-between"><span>DCF Equity:</span><span className="font-medium">{fmtBRL(evGordon)}</span></div>
              <div className="flex justify-between"><span>Terminal Value:</span><span className="font-medium">{fmtBRL(tvInfo.terminal_value)}</span></div>
              <div className="flex justify-between"><span>g perpétuo:</span><span className="font-medium">{((tvInfo.perpetuity_growth || 0.035) * 100).toFixed(1)}%</span></div>
              <div className="flex justify-between"><span>Gordon weight:</span><span className="font-medium">{(dcfWeight * 100).toFixed(0)}%</span></div>
            </div>
          </div>

          {/* DCF Exit Multiple */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>DCF Exit Multiple</h4>
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Hypothetical sale at the end of the projection</p>
            <p className={`text-2xl font-semibold tabular-nums mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtBRL(eqExit)}</p>
            <div className={`text-xs space-y-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <div className="flex justify-between"><span>DCF Equity:</span><span className="font-medium">{fmtBRL(evExit)}</span></div>
              <div className="flex justify-between"><span>Terminal Value:</span><span className="font-medium">{fmtBRL(tvExit.terminal_value)}</span></div>
              <div className="flex justify-between"><span>Exit multiple:</span><span className="font-medium">{(tvExit.exit_multiple || 0).toFixed(1)}× EBITDA</span></div>
              <div className="flex justify-between"><span>Exit weight:</span><span className="font-medium">{((1 - dcfWeight) * 100).toFixed(0)}%</span></div>
            </div>
          </div>

          {/* Múltiplos */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Múltiplos Sectoriais (informativos)</h4>
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Comparison with sector companies</p>
            <p className={`text-2xl font-semibold tabular-nums mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtBRL(multVal.equity_avg_multiples)}</p>
            <div className={`text-xs space-y-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <div className="flex justify-between"><span>EV/Revenue ({(multVal.multiples_used?.ev_revenue || 0).toFixed(1)}×):</span><span className="font-medium">{fmtBRL(multVal.ev_by_revenue)}</span></div>
              <div className="flex justify-between"><span>EV/EBITDA ({(multVal.multiples_used?.ev_ebitda || 0).toFixed(1)}×):</span><span className="font-medium">{fmtBRL(multVal.ev_by_ebitda)}</span></div>
              <div className="flex justify-between"><span>Total weight:</span><span className="font-medium">Informational</span></div>
              <p className="text-emerald-500 text-[10px] mt-1">Fonte: {multVal.multiples_used?.source || 'Damodaran'}</p>
            </div>
          </div>
        </div>

        {/* Triangulation summary */}
        <div className={`border rounded-2xl p-5 mb-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Composition result</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className={`text-xs mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pre-adjustment equity (Gordon {(dcfWeight * 100).toFixed(0)}% + Exit {((1 - dcfWeight) * 100).toFixed(0)}%)</p>
              <p className={`text-2xl font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtBRL(result.equity_value_dcf)}</p>
            </div>
            <div className="flex items-center gap-5 flex-wrap">
              {[
                { label: 'Beta (U)', value: betaU.toFixed(2) },
                { label: 'Beta (5f)', value: (result.cost_of_equity_detail?.beta_5factor || result.beta_levered || 0).toFixed(2) },
                { label: 'Ke', value: `${((result.wacc || 0) * 100).toFixed(1)}%` },
                { label: 'CRP', value: `${((result.cost_of_equity_detail?.country_risk_premium || 0) * 100).toFixed(1)}%` },
                { label: 'Selic', value: `${((result.parameters?.selic_rate || 0) * 100).toFixed(2)}%` },
                { label: 'ETR', value: `${((result.parameters?.effective_tax_rate || 0.34) * 100).toFixed(1)}%` },
                { label: 'TV Fade', value: tvFade.fade_impact_pct !== undefined ? `${tvFade.fade_impact_pct > 0 ? '+' : ''}${tvFade.fade_impact_pct.toFixed(1)}pp` : '—' },
                { label: 'TV no DCF', value: `${tvPct.toFixed(0)}%` },
              ].map((item, i) => (
                <div key={i} className="text-center min-w-[48px]">
                  <p className={`text-[9px] uppercase font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</p>
                  <p className={`text-sm font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          {/* IBGE data quality indicator */}
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-dashed border-slate-700/40">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              result.ibge_sector_data?.ibge_data_quality === 'alta'  ? 'bg-emerald-500' :
              result.ibge_sector_data?.ibge_data_quality === 'media' ? 'bg-yellow-400' :
              result.ibge_sector_data?.ibge_data_quality === 'baixa' ? 'bg-orange-400' :
              'bg-slate-500'
            }`} />
            <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {result.ibge_sector_data?.ibge_data_label || 'IBGE/SIDRA: awaiting sector data'}
              {result.parameters?.recurring_revenue_pct > 0 && (
                <span className="ml-3 text-purple-400">
                  · Recurring revenue {Math.round((result.parameters.recurring_revenue_pct) * 100)}% — premium applied to exit multiple
                </span>
              )}
            </p>
          </div>
        </div>
        </Section>

        {/* ═══════════════════════════════════════════════════
            4. AJUSTES DE DESCONTO — DLOM, Quali
        ═══════════════════════════════════════════════════ */}
        <Section
          title="Adjustments e Descontos Aplicados"
          description="Discounts that transform the theoretical value into a realistic market value"
          icon={Layers}
          isDark={isDark}
        >
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* DLOM */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-500" />
                <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>DLOM</h4>
              </div>
              {dlom.dlom_pct && (
                <button onClick={() => setShowDlomDetails(!showDlomDetails)} className="text-emerald-500 text-[10px] hover:underline">
                  {showDlomDetails ? 'Hide' : 'Details'}
                </button>
              )}
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Discount for Lack of Marketability</p>
            <p className={`text-2xl font-semibold tabular-nums mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {dlom.dlom_pct ? `${(dlom.dlom_pct * 100).toFixed(1)}%` : '—'}
            </p>
            <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Discount for being a private company (no stock exchange liquidity)</p>
            {showDlomDetails && dlom.dlom_pct && (
              <div className={`text-xs space-y-1 pt-3 mt-3 border-t ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <div className="flex justify-between"><span>Base:</span><span>{(dlom.base_discount * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>Size adjustment:</span><span>{dlom.size_adjustment > 0 ? '+' : ''}{(dlom.size_adjustment * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>Maturity adjustment:</span><span>{dlom.maturity_adjustment > 0 ? '+' : ''}{(dlom.maturity_adjustment * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>Sector adjustment:</span><span>{dlom.sector_adjustment > 0 ? '+' : ''}{(dlom.sector_adjustment * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>Sector liquidity:</span><span className="capitalize">{dlom.sector_liquidity}</span></div>
              </div>
            )}
          </div>

          {/* Survival */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <HeartPulse className="w-4 h-4 text-emerald-500" />
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Survival (embedded in TV)</h4>
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Horizon: {survival.horizon || '—'} • SEBRAE/IBGE Data</p>
            <p className={`text-2xl font-semibold tabular-nums mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {survival.survival_rate ? `${(survival.survival_rate * 100).toFixed(0)}%` : '—'}
            </p>
            <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Embedded in Terminal Value (not a separate discount)</p>
            {survival.survival_rate && (
              <div className={`text-xs space-y-1.5 pt-3 mt-3 border-t ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <div className="flex justify-between"><span>Sector base rate:</span><span>{((survival.base_rate || 0) * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span>Maturity bonus:</span><span>+{((survival.age_bonus || 0) * 100).toFixed(0)}%</span></div>
                <div className="mt-2 h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500" style={{ width: `${(survival.survival_rate || 0) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Qualitative */}
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-emerald-500" />
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Score Qualitative</h4>
            </div>
            <p className={`text-[10px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Governance, mercado, clientes, diferenciação, escala</p>
            <p className={`text-2xl font-semibold tabular-nums mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {qual.score !== undefined ? `${qual.score}` : '—'}<span className="text-base font-normal opacity-40">/100</span>
            </p>
            <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Adjustment: {qual.adjustment ? `${qual.adjustment > 0 ? '+' : ''}${(qual.adjustment * 100).toFixed(1)}% in value` : 'Neutral (0%)'}
            </p>
            {qual.has_data && qualRadarDate.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <ResponsiveContainer width="100%" height={130}>
                  <RadarChart data={qualRadarDate} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 8, fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Radar name="Score" dataKey="score" stroke="#059669" fill="#059669" fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            {!qual.has_data && (
              <p className={`text-[10px] italic mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>No qualitative data was provided</p>
            )}
          </div>
        </div>
        </Section>

        {/* ═══════════════════════════════════════════════════
            5. WATERFALL — Composição do Equity
        ═══════════════════════════════════════════════════ */}
        {waterfall.length > 0 && (
          <Section
            title="Equity Value Composition"
            description="See how each step of the calculation builds (or reduces) the final value"
            icon={BarChart3}
            isDark={isDark}
          >
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={waterfall} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => fmtBRL(v)} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} width={140} />
                <Tooltip content={(props) => <WaterfallTooltip {...props} isDark={isDark} />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {waterfall.map((entry, idx) => (
                    <Cell key={idx} fill={waterfallColors[entry.type] || '#059669'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          </Section>
        )}

        {/* ═══════════════════════════════════════════════════
            6. PROJEÇÕES — Gráficos de Revenue e FCF
        ═══════════════════════════════════════════════════ */}
        {chartDate.length > 0 && (
          <Section
            title="Financial Projections"
            description={`Revenue and FCFE projected for ${result.parameters?.projection_years || 10} years`}
            icon={TrendingUp}
            isDark={isDark}
          >
          <div className="grid md:grid-cols-2 gap-4 mb-2">
            <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h4 className={`font-semibold text-sm mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Projected Revenue</h4>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartDate}>
                  <defs>
                    <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#047857" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#047857" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => fmtBRL(v)} />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                  <Area type="monotone" dataKey="receita" stroke="#047857" fill="url(#gradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h4 className={`font-semibold text-sm mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>FCFE (Free Cash Flow to Equity)</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartDate}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => fmtBRL(v)} />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                  <Bar dataKey="fcfe" radius={[4, 4, 0, 0]}>
                    {chartDate.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fcfe >= 0 ? '#047857' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          </Section>
        )}

        {/* ═══════════════════════════════════════════════════
            7. TABELAS DETALHADAS (colapsáveis)
        ═══════════════════════════════════════════════════ */}

        {/* Dados Extraídos pelo Documento (colapsável) */}
        {analysis.extracted_data && Object.keys(analysis.extracted_data).some(k => !k.startsWith('_') && analysis.extracted_data[k] !== null) && (
          <ExtractedDatePanel analysis={analysis} isDark={isDark} />
        )}

        {/* FCF Detail Table (collapsible) */}
        {projections.length > 0 && (
          <>
          {/* ─── What-if Panel ─── */}
          <WhatIfPanel
            analysis={analysis}
            result={result}
            isDark={isDark}
          />

          <div className={`border rounded-2xl mb-4 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <button
              onClick={() => setShowFCFTable(!showFCFTable)}
              className={`w-full flex items-center justify-between p-6 ${isDark ? 'text-white' : 'text-slate-900'}`}
            >
              <h3 className="font-semibold">Detailed Projected FCFE Table</h3>
              {showFCFTable ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showFCFTable && (
              <div className="px-6 pb-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      {['Year', 'Revenue', 'Growth', 'EBIT', 'Net Income', 'D&A', 'CapEx', 'ΔNWC', 'FCFE'].map(h => (
                        <th key={h} className={`py-2 px-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map((p) => (
                      <tr key={p.year} className={`border-b transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                        <td className={`py-2 px-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.year}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.revenue)}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{((p.growth_rate || 0) * 100).toFixed(1)}%</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.ebit)}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.nopat)}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.depreciation)}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.capex)}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.delta_nwc)}</td>
                        <td className={`py-2 px-3 font-semibold ${p.fcf >= 0 ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>{fmtBRL(p.fcf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </>
        )}

        {/* P&L Projected Table (collapsible) */}
        {pnlProjections.length > 0 && (
          <div className={`border rounded-2xl mb-4 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <button
              onClick={() => setShowPnlTable(!showPnlTable)}
              className={`w-full flex items-center justify-between p-6 ${isDark ? 'text-white' : 'text-slate-900'}`}
            >
              <h3 className="font-semibold">Projected P&L (Income Statement)</h3>
              {showPnlTable ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showPnlTable && (
              <div className="px-6 pb-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      {['Year', 'Revenue', 'COGS', 'Gross Profit', 'Gross Margin', 'OpEx', 'EBITDA', 'EBITDA Margin', 'D&A', 'EBIT', 'Taxes', 'Net Income'].map(h => (
                        <th key={h} className={`py-2 px-2 text-left text-[10px] font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pnlProjections.map((p) => (
                      <tr key={p.year} className={`border-b transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                        <td className={`py-2 px-2 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.year}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.revenue)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.cogs)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.gross_profit)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{((p.gross_margin || 0) * 100).toFixed(1)}%</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.opex)}</td>
                        <td className={`py-2 px-2 font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmtBRL(p.ebitda)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{((p.ebitda_margin || 0) * 100).toFixed(1)}%</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.depreciation)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.ebit)}</td>
                        <td className={`py-2 px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtBRL(p.taxes)}</td>
                        <td className={`py-2 px-2 font-semibold ${(p.net_income || 0) >= 0 ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>{fmtBRL(p.net_income)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sensitivity Table (collapsible) */}
        {sensitivity.equity_matrix && (
          <div className={`border rounded-2xl mb-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <button
              onClick={() => setShowSensitivity(!showSensitivity)}
              className={`w-full flex items-center justify-between p-6 ${isDark ? 'text-white' : 'text-slate-900'}`}
            >
              <h3 className="font-semibold">Sensitivity Table (Ke × Growth)</h3>
              {showSensitivity ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showSensitivity && (
              <div className="px-6 pb-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={`py-2 px-3 text-left text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ke \ Growth</th>
                      {sensitivity.growth_values?.map((g, i) => (
                        <th key={i} className={`py-2 px-3 text-center text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{g}%</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivity.equity_matrix?.map((row, ri) => (
                      <tr key={ri} className={`border-b transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                        <td className={`py-2 px-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{sensitivity.wacc_values?.[ri]}%</td>
                        {row.map((val, ci) => {
                          const isCenter = ri === 2 && ci === 2;
                          const centerVal = sensitivity.equity_matrix?.[2]?.[2] || 1;
                          const ratio = val / centerVal;
                          let heatBg = '';
                          if (!isCenter) {
                            if (ratio >= 1.3) heatBg = isDark ? 'bg-emerald-900/60' : 'bg-emerald-100';
                            else if (ratio >= 1.1) heatBg = isDark ? 'bg-emerald-900/30' : 'bg-emerald-50';
                            else if (ratio <= 0.7) heatBg = isDark ? 'bg-red-900/60' : 'bg-red-100';
                            else if (ratio <= 0.9) heatBg = isDark ? 'bg-red-900/30' : 'bg-red-50';
                          }
                          const textColor = ratio >= 1.1 ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : ratio <= 0.9 ? (isDark ? 'text-red-400' : 'text-red-700') : (isDark ? 'text-slate-300' : 'text-slate-600');
                          return (
                            <td key={ci} className={`py-2 px-3 text-center transition-colors ${heatBg} ${isCenter ? 'font-bold ring-2 ring-emerald-500/50 rounded' : ''} ${textColor}`}>
                              {fmtBRL(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  The highlighted value (center) is the base scenario. Rows = Ke, Columns = Growth rate.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            8. SIMULAÇÃO DE RODADA
        ═══════════════════════════════════════════════════ */}
        {investRound.pre_money_valuation > 0 && (
          <Section
            title="Investment Round Simulation"
            description="Estimate of how a fundraise would look based on the calculated valuation"
            icon={Zap}
            isDark={isDark}
          >
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Pre-money', value: fmtBRL(investRound.pre_money_valuation), tip: 'Company value before investment' },
                { label: 'Investment', value: fmtBRL(investRound.investment_amount), tip: 'Amount raised in the round' },
                { label: 'Post-money', value: fmtBRL(investRound.post_money_valuation), tip: 'Pre-money + investment' },
                { label: 'Dilution', value: `${(investRound.dilution_pct || 0).toFixed(1)}%`, tip: 'How much the founder gives up to the investor' },
              ].map((item, i) => (
                <div key={i} className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <p className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</p>
                    <InfoTip text={item.tip} isDark={isDark} />
                  </div>
                  <p className={`text-lg font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className={`flex items-center justify-between mt-4 pt-4 border-t text-xs ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
              <span>% Founder after round: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{(investRound.founder_equity_pct || 0).toFixed(1)}%</strong></span>
              <span>Price per 1%: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{fmtBRL(investRound.price_per_1pct)}</strong></span>
            </div>
          </div>
          </Section>
        )}

        {/* ═══ 9. MONTE CARLO ═══ */}
        <LazySection minHeight={280}>
        {monteCarlo.histogram && monteCarlo.histogram.length > 0 && (
          <Section
            title="Monte Carlo — Probabilistic Distribution"
            description={`${(monteCarlo.n_simulations || 2000).toLocaleString()} simulations with growth, margin, and Ke variation`}
            icon={Dice6}
            isDark={isDark}
          >
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-5">
              {[
                { label: 'P5', value: monteCarlo.p5 },
                { label: 'P10', value: monteCarlo.p10 },
                { label: 'P25', value: monteCarlo.p25 },
                { label: 'P50', value: monteCarlo.p50, highlight: true },
                { label: 'P75', value: monteCarlo.p75 },
                { label: 'P90', value: monteCarlo.p90 },
                { label: 'P95', value: monteCarlo.p95 },
              ].map((item, i) => (
                <div key={i} className={`text-center rounded-xl p-2 ${item.highlight ? (isDark ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50' : 'bg-emerald-50 ring-1 ring-emerald-200') : (isDark ? 'bg-slate-800/50' : 'bg-slate-50')}`}>
                  <p className={`text-[9px] uppercase font-semibold ${item.highlight ? 'text-emerald-500' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{item.label}</p>
                  <p className={`text-xs md:text-sm font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtBRL(item.value)}</p>
                </div>
              ))}
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monteCarlo.histogram.map((b, i) => ({ name: fmtBRL(b.range_start), value: b.count, pct: b.pct }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="name" tick={false} />
                  <YAxis tick={{ fontSize: 10, fill: isDark ? '#64748b' : '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: 12, fontSize: 12 }}
                    formatter={(v, name, props) => [`${v} simulations (${props.payload.pct}%)`, 'Freq.']}
                    labelFormatter={(l) => `Range: ${l}`}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {monteCarlo.histogram.map((_, i) => (
                      <Cell key={i} fill={isDark ? '#10b981' : '#059669'} fillOpacity={0.35 + (i / monteCarlo.histogram.length) * 0.65} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={`flex items-center justify-between mt-3 pt-3 border-t text-[10px] ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
              <span>Mean: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{fmtBRL(monteCarlo.mean)}</strong></span>
              <span>Standard Deviation: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{fmtBRL(monteCarlo.std_dev)}</strong></span>
              <span>Fonte: McKinsey / Goldman Sachs methodology</span>
            </div>
          </div>
          </Section>
        )}
        </LazySection>

        {/* ═══════════════════════════════════════════════════
            10. PEERS — Comparação com Pares
        ═══════════════════════════════════════════════════ */}
        {peers.dcf_vs_peers && (
          <Section
            title="Comparação com Pares do Sector"
            description="Cross-reference between DCF and sector multiples — market validation"
            icon={Crosshair}
            isDark={isDark}
          >
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              {/* EV/Revenue */}
              <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <p className={`text-[10px] uppercase font-semibold mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>EV / Revenue ({peers.ev_revenue?.multiple}x)</p>
                <p className={`text-lg font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtBRL(peers.ev_revenue?.value)}</p>
                <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>P25: {fmtBRL(peers.ev_revenue?.p25)} — P75: {fmtBRL(peers.ev_revenue?.p75)}</p>
              </div>
              {/* EV/EBITDA */}
              <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <p className={`text-[10px] uppercase font-semibold mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>EV / EBITDA ({peers.ev_ebitda?.multiple}x)</p>
                <p className={`text-lg font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtBRL(peers.ev_ebitda?.value)}</p>
                <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>P25: {fmtBRL(peers.ev_ebitda?.p25)} — P75: {fmtBRL(peers.ev_ebitda?.p75)}</p>
              </div>
              {/* DCF vs Peers */}
              <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <p className={`text-[10px] uppercase font-semibold mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>DCF vs Peer Median</p>
                <p className={`text-lg font-semibold tabular-nums ${peers.dcf_vs_peers.premium_discount_pct > 0 ? 'text-emerald-500' : peers.dcf_vs_peers.premium_discount_pct < -30 ? 'text-red-400' : (isDark ? 'text-white' : 'text-slate-900')}`}>
                  {peers.dcf_vs_peers.premium_discount_pct > 0 ? '+' : ''}{peers.dcf_vs_peers.premium_discount_pct?.toFixed(1)}%
                </p>
                <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Peer median: {fmtBRL(peers.dcf_vs_peers.peer_median)}</p>
              </div>
            </div>
            {/* V8: Inline sector comparison bars */}
            {(peers.ev_revenue?.p25 || peers.ev_ebitda?.p25) && (
              <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <p className={`text-[10px] uppercase font-semibold mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Posição vs Faixa Sectorial (P25 – P75)</p>
                {[
                  { label: 'EV / Revenue', value: peers.ev_revenue?.value, p25: peers.ev_revenue?.p25, p75: peers.ev_revenue?.p75, p50: peers.dcf_vs_peers?.peer_median },
                ].filter(d => d.p25 && d.p75 && d.value).map((d) => {
                  const range = d.p75 - d.p25;
                  const relPos = range > 0 ? Math.min(Math.max((d.value - d.p25) / range, 0), 1) : 0.5;
                  return (
                    <div key={d.label} className="mb-2">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{d.label}</span>
                        <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{fmtBRL(d.value)}</span>
                      </div>
                      <div className={`relative h-3 rounded-full overflow-visible ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-400/40 via-emerald-400/40 to-emerald-500/40" />
                        {/* Marker = our company position */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shadow-sm z-10 transition-all"
                          style={{ left: `${relPos * 100}%` }}
                          title={`Your company: ${fmtBRL(d.value)}`}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] mt-0.5">
                        <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>P25: {fmtBRL(d.p25)}</span>
                        <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>P75: {fmtBRL(d.p75)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Fonte: {peers.source}</p>
          </div>
          </Section>
        )}

        {/* ═══════════════════════════════════════════════════
            11. CONTROL PREMIUM — Desconto de Minoria
        ═══════════════════════════════════════════════════ */}
        {controlPremium.full_control_100pct > 0 && (
          <Section
            title="Control Premium / Minority Discount"
            description="How much the stake is worth based on the percentage of control acquired"
            icon={Crown}
            isDark={isDark}
          >
          <div className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: '100% (Full Control)', value: controlPremium.full_control_100pct, highlight: true },
                { label: '51% (Majority)', value: controlPremium.majority_51pct },
                { label: '33% (Significant)', value: controlPremium.significant_33pct },
                { label: '25% (Minority)', value: controlPremium.minority_25pct },
                { label: '10% (Minority)', value: controlPremium.minority_10pct },
                { label: '5% (Minority)', value: controlPremium.minority_5pct },
              ].map((item, i) => (
                <div key={i} className={`rounded-xl p-3 text-center ${item.highlight ? (isDark ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40' : 'bg-emerald-50 ring-1 ring-emerald-200') : (isDark ? 'bg-slate-800/50' : 'bg-slate-50')}`}>
                  <p className={`text-[10px] uppercase font-medium mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</p>
                  <p className={`text-sm md:text-base font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtBRL(item.value)}</p>
                </div>
              ))}
            </div>
            <p className={`text-[10px] mt-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{controlPremium.reference} — {controlPremium.note}</p>
          </div>
          </Section>
        )}

        {/* ═══ VAL F: INVESTOR READINESS RADAR ═══ */}
        <LazySection minHeight={260}>
        {investorReadiness.overall_score !== undefined && (
          <Section
            title="Investor Readiness Score"
            description="Multidimensional assessment of the company's attractiveness to investors"
            icon={Target}
            isDark={isDark}
          >
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={(investorReadiness.radar_data || []).map(d => ({ dimension: d.axis || d.label || d.dimension, score: d.score || d.value, fullMark: 10 }))}>
                    <PolarGrid stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <PolarAngleAxis dataKey="dimension" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                    <Radar name="Score" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col items-center gap-2 min-w-[120px]">
                <div className={`text-5xl font-bold ${investorReadiness.overall_score >= 70 ? 'text-emerald-500' : investorReadiness.overall_score >= 45 ? 'text-amber-500' : 'text-red-500'}`}>
                  {investorReadiness.overall_score}
                </div>
                <div className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Global Score (0–100)</div>
                <div className={`text-xs px-3 py-1 rounded-full font-semibold ${
                  investorReadiness.overall_score >= 70 ? 'bg-emerald-500/15 text-emerald-500' :
                  investorReadiness.overall_score >= 45 ? 'bg-amber-500/15 text-amber-600' :
                  'bg-red-500/15 text-red-500'
                }`}>
                  {investorReadiness.overall_score >= 70 ? 'Strong' : investorReadiness.overall_score >= 45 ? 'Moderate' : 'Weak'}
                </div>
                {investorReadiness.top_strengths?.length > 0 && (
                  <div className="mt-2 text-left w-full">
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pontos Strongs</p>
                    {investorReadiness.top_strengths.map((s, i) => (
                      <p key={i} className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{s}</p>
                    ))}
                  </div>
                )}
                {investorReadiness.top_gaps?.length > 0 && (
                  <div className="mt-2 text-left w-full">
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Gaps</p>
                    {investorReadiness.top_gaps.map((g, i) => (
                      <p key={i} className={`text-xs flex items-center gap-1 ${isDark ? 'text-red-400' : 'text-red-500'}`}><AlertTriangle className="w-3 h-3" />{g}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Section>
        )}
        </LazySection>

        {/* ═══ VAL C+G: LBO+DDM (lazy) ═══ */}
        <LazySection minHeight={200}>
        {/* ═══════════════════════════════════════════════════
            VAL C: LBO / PRIVATE EQUITY
        ═══════════════════════════════════════════════════ */}
        {lboAnalysis.applicable && (
          <Section
            title="Analysis LBO / Private Equity"
            description="Retorno simulado em um cenário de aquisição alavancada com saída em 5 years"
            icon={Building2}
            isDark={isDark}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Estimated IRR', value: `${(lboAnalysis.irr_pct || 0).toFixed(1)}%`, cls: lboAnalysis.irr_pct >= 20 ? 'text-emerald-500' : lboAnalysis.irr_pct >= 12 ? 'text-amber-500' : 'text-red-500' },
                { label: 'MOIC', value: `${(lboAnalysis.moic || 0).toFixed(2)}×`, cls: lboAnalysis.moic >= 2 ? 'text-emerald-500' : lboAnalysis.moic >= 1.5 ? 'text-amber-500' : 'text-red-500' },
                { label: 'Entry EV', value: fmtBRL(lboAnalysis.entry_ev), cls: isDark ? 'text-slate-200' : 'text-slate-800' },
                { label: 'Exit EV', value: fmtBRL(lboAnalysis.exit_ev), cls: isDark ? 'text-slate-200' : 'text-slate-800' },
              ].map(({ label, value, cls }) => (
                <div key={label} className={`rounded-xl p-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
                  <p className={`text-lg font-bold ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
            {lboAnalysis.assessment && (
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{lboAnalysis.assessment}</p>
            )}
          </Section>
        )}

        {/* ═══════════════════════════════════════════════════
            VAL G: DDM (GORDON GROWTH)
        ═══════════════════════════════════════════════════ */}
        {ddm.applicable && (
          <Section
            title="DDM Model (Dividends — Gordon Growth)"
            description="Intrinsic valuation by expected dividend flow"
            icon={Percent}
            isDark={isDark}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'DDM Value', value: fmtBRL(ddm.ddm_value) },
                { label: 'Dividend Payout', value: `${((ddm.payout_ratio || 0) * 100).toFixed(1)}%` },
                { label: 'Stable Growth', value: `${((ddm.terminal_growth || 0) * 100).toFixed(1)}%` },
                { label: 'Ke', value: `${((ddm.cost_of_equity || 0) * 100).toFixed(1)}%` },
                { label: 'D1 (Next Dividend)', value: fmtBRL(ddm.estimated_annual_dividends) },
                { label: 'Convergence', value: ddm.convergence_note || '—' },
              ].map(({ label, value }) => (
                <div key={label} className={`rounded-xl p-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
                  <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
                </div>
              ))}
            </div>
            {(ddm.convergence_note || ddm.divergence_from_dcf_pct !== undefined) && (
              <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {ddm.convergence_note}{ddm.divergence_from_dcf_pct !== undefined ? ` — Divergence vs DCF: ${ddm.divergence_from_dcf_pct > 0 ? '+' : ''}${ddm.divergence_from_dcf_pct}%` : ''}
              </p>
            )}
          </Section>
        )}
        </LazySection>

        {/* ═══════════════════════════════════════════════════
            VAL A: HISTORICAL TREND BANNER
        ═══════════════════════════════════════════════════ */}
        {historicalTrend && historicalTrend.years_analyzed >= 2 && (
          <div className={`rounded-2xl border p-5 mb-6 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1">
                <h4 className={`font-semibold text-sm mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Tendência Histórica de Revenue</h4>
                <div className="flex flex-wrap gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium bg-blue-500/10 text-blue-500`}>
                    CAGR {historicalTrend.years_analyzed}a: {(historicalTrend.cagr_pct || 0).toFixed(1)}%
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    Weighted Average: {fmtBRL(historicalTrend.weighted_avg_revenue)}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    historicalTrend.trend === 'accelerating' || historicalTrend.trend === 'growing' ? 'bg-emerald-500/10 text-emerald-500' :
                    historicalTrend.trend === 'stable' ? 'bg-amber-500/10 text-amber-600' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    Trend: {historicalTrend.trend || '—'}
                  </span>
                </div>
                <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Based on {historicalTrend.years_analyzed} years de dados históricos. Revenue mais recente usada como base do DCF.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            VAL H: M&A COMPARABLES
        ═══════════════════════════════════════════════════ */}
        <Section
          title="M&A Comparables"
          description="Recent sector transactions with reference multiples for benchmarking"
          icon={GitBranch}
          isDark={isDark}
        >
          {!maComparables && (
            <button
              onClick={loadMaComparables}
              disabled={maLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition disabled:opacity-60"
            >
              {maLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Datebase className="w-4 h-4" />}
              {maLoading ? 'Loading...' : 'Load AI-Powered Comparables'}
            </button>
          )}
          {maComparables && (
            <div>
              {maComparables.transactions?.length > 0 && (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                        {['Target', 'Year', 'EV/Revenue', 'EV/EBITDA', 'Note'].map(h => (
                          <th key={h} className={`py-2 px-3 text-left text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {maComparables.transactions.map((t, i) => (
                        <tr key={i} className={`border-b transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                          <td className={`py-2 px-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.company}</td>
                          <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t.year}</td>
                          <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t.ev_revenue_multiple?.toFixed(1)}×</td>
                          <td className={`py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t.ev_ebitda_multiple?.toFixed(1)}×</td>
                          <td className={`py-2 px-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.deal_size_note || t.acquirer_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(maComparables.sector_median_ev_revenue || maComparables.sector_median_ev_ebitda || maComparables.medians) && (
                <div className="flex flex-wrap gap-3 mb-2">
                  {(maComparables.sector_median_ev_revenue || (maComparables.medians?.ev_revenue)) && (
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      Mediana EV/Revenue: {(maComparables.sector_median_ev_revenue || maComparables.medians?.ev_revenue)?.toFixed(1)}×
                    </span>
                  )}
                  {(maComparables.sector_median_ev_ebitda || (maComparables.medians?.ev_ebitda)) && (
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      Median EV/EBITDA: {(maComparables.sector_median_ev_ebitda || maComparables.medians?.ev_ebitda)?.toFixed(1)}×
                    </span>
                  )}
                </div>
              )}
              {maComparables.commentary && (
                <p className={`text-sm mt-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{maComparables.commentary}</p>
              )}
            </div>
          )}
        </Section>

        {/* ═══════════════════════════════════════════════════
            VAL E: HISTORICAL VALUATION TRACKING
        ═══════════════════════════════════════════════════ */}
        {analysis?.company_name && (
          <Section
            title="History de Valuation"
            description="Equity value evolution in previous reports for the same company"
            icon={History}
            isDark={isDark}
          >
            {!valuationHistory && (
              <button
                onClick={loadValuationHistory}
                disabled={historyLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition disabled:opacity-60"
              >
                {historyLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <History className="w-4 h-4" />}
                {historyLoading ? 'Loading...' : 'Carregar History'}
              </button>
            )}
            {valuationHistory && (
              <div>
                {valuationHistory.history?.length > 1 ? (
                  <div>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={valuationHistory.history.map(h => ({ data: h.created_at?.slice(0,10), valor: h.equity_value }))}>
                        <defs>
                          <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="data" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                        <YAxis tickFormatter={v => `R$${(v/1e6).toFixed(1)}M`} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                        <Tooltip formatter={v => fmtBRL(v)} labelFormatter={l => `Date: ${l}`} contentStyle={{ background: isDark ? '#0f172a' : '#fff', border: '1px solid', borderColor: isDark ? '#334155' : '#e2e8f0', borderRadius: 8 }} />
                        <Area type="monotone" dataKey="valor" stroke="#10b981" fill="url(#histGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {valuationHistory.history.length} reports found for "{analysis.company_name}".
                    </p>
                  </div>
                ) : (
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {valuationHistory.history?.length === 1 ? 'Only 1 report found — no comparative history yet.' : 'No previous reports found.'}
                  </p>
                )}
              </div>
            )}
          </Section>
        )}

        {/* ═══════════════════════════════════════════════════
            12. ANÁLISE IA
        ═══════════════════════════════════════════════════ */}
        {analysis.ai_analysis && (
          <Section
            title="Analysis Estratégica por IA"
            description="Recommendations generated by artificial intelligence based on company data"
            icon={Sparkles}
            isDark={isDark}
          >
          <div className={`border rounded-2xl p-6 transition-colors ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`text-sm leading-relaxed whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {analysis.ai_analysis}
            </div>
          </div>
          </Section>
        )}

        {/* ═══════════════════════════════════════════════════
            10. SIMULADOR LINK
        ═══════════════════════════════════════════════════ */}
        <div className="mb-6">
          <Link
            to={`/simulador/${id}`}
            className={`flex items-center gap-4 border rounded-2xl p-5 transition group ${isDark ? 'bg-slate-900 border-slate-700 hover:border-emerald-600/40' : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'}`}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-600/20">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Interactive Simulator</h4>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ajuste Ke, growing e outros parâmetros para recalcular o valuation em tempo real</p>
            </div>
            <ArrowRight className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          </Link>
        </div>

        {/* ═══════════════════════════════════════════════════
            METODOLOGIA — Explicativo
        ═══════════════════════════════════════════════════ */}
        <div className={`rounded-2xl p-5 mb-6 ${isDark ? 'bg-slate-900/50 border border-slate-800' : 'bg-slate-50 border border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-emerald-500" />
            <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>How the methodology works</h4>
          </div>
          <div className={`text-xs leading-relaxed space-y-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <p><strong>1. DCF (Fluxo de Cash Descontado):</strong> Projects free cash flows to equity (FCFE) with sector CapEx, NWC, and D&A, discounted to present value using Mid-Year Convention and Ke (5-factor beta + dynamic CRP). Combines Gordon Growth (with competitive TV Fade) and Exit Multiple with maturity-defined weights.</p>
            <p><strong>2. Analysis de Pares:</strong> Compares company indicators (revenue, EBITDA) with sector multiples (source: Damodaran) as a cross-reference to DCF.</p>
            <p><strong>3. Composition:</strong> The final value combines Gordon ({(dcfWeight * 100).toFixed(0)}%) e Exit Multiple ({((1 - dcfWeight) * 100).toFixed(0)}%). Survival is embedded in the Terminal Value. ETR ({result.parameters?.tax_regime || 'auto'}) replaces the nominal 34% tax rate.</p>
            <p><strong>4. Adjustments:</strong> Applies DLOM (discount for being privately held) and qualitative adjustment (15 questions, 7 dimensions). Survival and founder risk are embedded in the model (TV and Ke).</p>
            <p><strong>5. Monte Carlo:</strong> 2.000 simulations com variação estocástica de growing (±30%), margem (±20%) e Ke (±15%) geram distribuição probabilística (P5–P95).</p>
            <p><strong>6. Control Premium:</strong> Minority discount applied based on stake — source: Mergerstat / Houlihan Lokey.</p>
          </div>
        </div>
          </>
        ) : (
          /* ─── Locked Premium Content Preview ─── */
          <div className={`relative rounded-2xl border-2 border-dashed p-8 md:p-12 mb-6 text-center ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-300 bg-slate-50'}`}>
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Full Report
            </h3>
            <p className={`max-w-md mx-auto mb-6 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Unlock detailed DCF, multiples, applied discounts, projected P&L, investment round simulation, AI analysis, interactive simulator, and much more.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-lg mx-auto">
              {[
                { icon: BarChart3, label: 'Dual DCF', desc: 'Gordon + Exit' },
                { icon: Target, label: 'Adjustments', desc: 'DLOM + Quali' },
                { icon: Sparkles, label: 'IA', desc: 'Analysis estratégica' },
                { icon: Gauge, label: 'Simulador', desc: 'Recalculate live' },
              ].map((item, i) => (
                <div key={i} className={`flex flex-col items-center gap-1 p-3 rounded-xl ${isDark ? 'bg-slate-800/60' : 'bg-white'}`}>
                  <item.icon className="w-5 h-5 text-emerald-500" />
                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.label}</span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.desc}</span>
                </div>
              ))}
            </div>
            <a href="#payment-section" className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3.5 rounded-xl font-semibold text-sm hover:from-emerald-500 hover:to-teal-500 transition shadow-xl shadow-emerald-600/20">
              <Lock className="w-4 h-4" />
              Unlock full report
            </a>
          </div>
        )}

        {/* Payment / Unlock */}
        {!analysis.plan && (
          <div id="payment-section" className={`border-2 rounded-2xl p-6 md:p-8 ${isDark ? 'border-emerald-500/30 bg-slate-900' : 'border-emerald-200 bg-white'}`}>
            <h3 className={`text-xl font-semibold mb-2 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>Unlock the full report</h3>
            <p className={`text-center mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Choose the ideal plan for your report. Each plan generates an exclusive PDF with differentiated content.</p>

            {/* Coupon field */}
            <div className="max-w-sm mx-auto mb-8">
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Discount coupon (optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponError(''); }}
                  placeholder="Ex: PRIMEIRA"
                  className={`flex-1 px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${
                    couponError
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
              {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  plan: 'essencial', name: 'Essential', price: 'R$1.297', pages: '~8 páginas',
                  desc: 'Valuation DCF completo',
                  features: ['Executive summary', 'DCF Gordon Growth', 'Detailed Ke', 'Risk and maturity score', 'Glossary and disclaimer', 'Email delivery'],
                  popular: false,
                },
                {
                  plan: 'profissional', name: 'Professional', price: 'R$2.597', pages: '~15 páginas',
                  desc: 'Analysis completa com benchmark',
                  features: ['Tudo do Essential', 'DCF Exit Multiple', 'Market multiples (info.)', 'Composition and waterfall', 'DLOM', 'Projected P&L (Income Statement)', 'FCFE projection', 'Sector benchmark', 'Sensitivity table'],
                  popular: false,
                },
                {
                  plan: 'estrategico', name: 'Strategic', price: 'R$4.997', pages: '~25 páginas',
                  desc: 'Máximo nível de análise',
                  features: ['Tudo do Professional', 'Analysis estratégica por IA', 'Qualitative radar assessment', 'Investment round simulation', 'The most complete report on the market'],
                  popular: true,
                },
              ].map((p) => (
                <div key={p.plan} className={`relative flex flex-col rounded-xl border-2 transition ${
                  p.popular
                    ? 'border-emerald-500 shadow-xl shadow-emerald-600/10 scale-[1.02]'
                    : isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300'
                }`}>
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold px-4 py-1 rounded-full shadow-lg whitespace-nowrap">
                      The most complete
                    </div>
                  )}
                  <div className={`flex-1 p-6 ${p.popular ? (isDark ? 'bg-gradient-to-b from-slate-900 to-slate-950' : 'bg-gradient-to-b from-emerald-50/50 to-white') : (isDark ? 'bg-slate-900' : 'bg-white')} rounded-t-xl`}>
                    <h4 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.name}</h4>
                    <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{p.desc}</p>
                    <div className="mb-1">
                      <span className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.price}</span>
                      <span className={`text-xs ml-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ one-time</span>
                    </div>
                    <p className={`text-xs font-medium mb-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{p.pages}</p>
                    <ul className="space-y-2.5">
                      {p.features.map((f, j) => (
                        <li key={j} className={`flex items-start gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`p-4 rounded-b-xl ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <button
                      onClick={() => handlePayment(p.plan)}
                      disabled={paying}
                      className={`w-full py-3 rounded-xl font-semibold text-sm transition disabled:opacity-50 ${
                        p.popular
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/25'
                          : isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      {paying ? 'Processing...' : `Choose ${p.name}`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* ─── Selos de segurança ─── */}
            <div className={`mt-8 pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              {/* Métodos de pagamento */}
              <p className={`text-center text-xs font-medium mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Payment processed securely via
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mb-5">
                {/* PIX */}
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M11.3 2.63a.984.984 0 0 1 1.4 0l2.58 2.57a3.96 3.96 0 0 0 2.8 1.16h.5a.984.984 0 0 1 .98.98v.5a3.96 3.96 0 0 0 1.16 2.8l2.6 2.58a.984.984 0 0 1 0 1.4l-2.6 2.57a3.96 3.96 0 0 0-1.16 2.8v.5a.984.984 0 0 1-.98.99h-.5a3.96 3.96 0 0 0-2.8 1.16l-2.58 2.57a.984.984 0 0 1-1.4 0l-2.58-2.57a3.96 3.96 0 0 0-2.8-1.16h-.5a.984.984 0 0 1-.98-.98v-.5a3.96 3.96 0 0 0-1.16-2.8L.68 12.7a.984.984 0 0 1 0-1.4l2.58-2.58A3.96 3.96 0 0 0 4.42 5.9v-.5a.984.984 0 0 1 .98-.98h.5a3.96 3.96 0 0 0 2.8-1.16L11.3 2.63z"/></svg>
                  PIX
                </span>
                {/* Bank slip */}
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  Bank slip
                </span>
                {/* Cartão */}
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  Credit Card
                </span>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-4">
                {/* SSL */}
                <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>SSL 256-bit Connection</span>
                </div>
                <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
                {/* Asaas */}
                <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Processed by <strong className={isDark ? 'text-slate-300' : 'text-slate-600'}>Asaas</strong></span>
                </div>
                <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
                {/* PCI */}
                <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PCI DSS Compliant</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {analysis.plan && (
          <div className={`border rounded-2xl p-6 text-center ${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
            <p className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
              Plan {analysis.plan} active — Report sent by email
            </p>
          </div>
        )}

        {/* Notes & Comments */}
        <div className={`border-t pt-8 mt-8 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <AnalysisNotes analysisId={id} initialNotes={analysis.notes} isDark={isDark} />
        </div>
      </main>
      </div>{/* end presentation mode wrapper */}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete análise"
        message="Are you sure you want to delete this analysis? This action cannot be undone."
        variant="danger"
      />

      {/* F5: Version History Modal with Diff */}
      {showVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowVersions(false); setSelectedVersionDiff(null); }} />
          <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <History className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Version history</h3>
                  {selectedVersionDiff && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                      Diff v{selectedVersionDiff.version_number}
                    </span>
                  )}
                </div>
                <button onClick={() => { setShowVersions(false); setSelectedVersionDiff(null); }} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>✕</button>
              </div>
              {versionsLoading ? (
                <div className="py-8 text-center">
                  <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : versions.length === 0 ? (
                <div className={`py-8 text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  No versions recorded yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 mb-4">
                  {versions.map((v, i) => (
                    <div
                      key={v.id || i}
                      onClick={() => setSelectedVersionDiff(selectedVersionDiff?.id === v.id ? null : v)}
                      className={`p-3 rounded-xl border cursor-pointer transition-colors ${selectedVersionDiff?.id === v.id ? (isDark ? 'bg-blue-500/10 border-blue-500/50' : 'bg-blue-50 border-blue-200') : (isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-slate-300')}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          Version {v.version_number}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {new Date(v.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {v.equity_value && (
                        <p className={`text-xs mt-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          Equity: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v.equity_value)}
                        </p>
                      )}
                      <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Click to view diff</p>
                    </div>
                  ))}
                </div>
              )}
              {/* F5: Diff panel */}
              {selectedVersionDiff && selectedVersionDiff.params && (
                <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Diff: Version {selectedVersionDiff.version_number} → Current
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Equity Value', vPrev: selectedVersionDiff.equity_value, vCurr: result?.equity_value_final || analysis.equity_value, fmt: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v) },
                      { label: 'Ke', vPrev: selectedVersionDiff.params?.wacc, vCurr: (result.wacc || 0) * 100, fmt: (v) => `${v?.toFixed(1)}%` },
                      { label: 'Growth', vPrev: selectedVersionDiff.params?.growth_rate, vCurr: (result.parameters?.growth_rate || 0) * 100, fmt: (v) => `${v?.toFixed(1)}%` },
                      { label: 'Net Margin', vPrev: selectedVersionDiff.params?.net_margin, vCurr: (result.parameters?.net_margin || 0) * 100, fmt: (v) => `${v?.toFixed(1)}%` },
                      { label: 'DLOM', vPrev: selectedVersionDiff.params?.dlom_pct, vCurr: (dlom.dlom_pct || 0) * 100, fmt: (v) => `${v?.toFixed(1)}%` },
                    ].map((d) => {
                      const delta = d.vCurr - d.vPrev;
                      const up = delta > 0;
                      const changed = Math.abs(delta) > 0.05;
                      return (
                        <div key={d.label} className={`flex items-center justify-between rounded-lg p-2 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'} line-through`}>{d.fmt(d.vPrev)}</span>
                            <span className={`text-xs tabular-nums font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{d.fmt(d.vCurr)}</span>
                            {changed && (
                              <span className={`text-[10px] font-bold ${up ? 'text-emerald-500' : 'text-red-500'}`}>
                                {up ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && shareLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold text-lg mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Share analysis</h3>
            <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <span className={`text-xs truncate flex-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{shareLink}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(shareLink); toast.success('Copied!'); }}
                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 transition flex-shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Password protection toggle */}
            <div className={`rounded-xl border p-3 mb-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={sharePasswordEnabled}
                  onChange={e => setSharePasswordEnabled(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-500"
                />
                <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  <Lock className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
                  Protect with password
                </span>
              </label>
              {sharePasswordEnabled && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="password"
                    value={sharePassword}
                    onChange={e => setSharePassword(e.target.value)}
                    placeholder="Enter a password..."
                    className={`flex-1 text-sm rounded-lg border px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500/40 ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  />
                  <button
                    onClick={handleSharePassword}
                    disabled={sharePasswordSaving || !sharePassword}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition disabled:opacity-40"
                  >
                    {sharePasswordSaving ? '...' : 'Save'}
                  </button>
                </div>
              )}
              {!sharePasswordEnabled && analysis?.share_token && (
                <button
                  onClick={handleSharePassword}
                  disabled={sharePasswordSaving}
                  className={`text-xs mt-1 ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-500'} transition`}
                >
                  Remove existing password
                </button>
              )}
            </div>

            <a
              href={`https://wa.me/?text=${encodeURIComponent('Check out the valuation analysis: ' + shareLink)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] text-white font-semibold text-sm hover:bg-[#20BD5A] transition mb-3"
            >
              <Share2 className="w-4 h-4" /> Share no WhatsApp
            </a>
            <button
              onClick={() => setShowShareModal(false)}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Alert Threshold Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAlertModal(false)} />
          <div className={`relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                <Bell className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h3 className={`font-semibold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Re-analysis Alert</h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Notify when value changes significantly</p>
              </div>
            </div>

            <div className="mb-5">
              <label className={`text-xs font-semibold uppercase tracking-wider mb-3 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Trigger alert if Equity changes ≥ {alertThreshold}%
              </label>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={alertThreshold}
                onChange={e => setAlertThreshold(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className={`flex justify-between text-[10px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                <span>5%</span><span>25%</span><span>50%</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveAlert}
                disabled={alertSaving}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {alertSaving ? 'Saving...' : 'Activate alert'}
              </button>
              {analysis?.reanalysis_alert_pct && (
                <button
                  onClick={handleClearAlert}
                  disabled={alertSaving}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Remove
                </button>
              )}
            </div>
            <button
              onClick={() => setShowAlertModal(false)}
              className={`w-full mt-2 py-2 rounded-xl text-xs transition ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* F6: NPS Modal — 30s after viewing paid analysis */}
      {showNps && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNps(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            {npsSent ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">❤️</div>
                <p className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>Thank you for your feedback!</p>
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Your opinion helps improve Valuora.</p>
              </div>
            ) : (
              <>
                <button onClick={() => setShowNps(false)} className={`absolute top-4 right-4 p-1.5 rounded-lg transition ${isDark ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <span className="text-base">&#10024;</span>
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>How was your experience?</p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Takes less than 30 seconds</p>
                  </div>
                </div>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>From 0 to 10, how likely would you recommend Valuora to a colleague?</p>
                <div className="grid grid-cols-11 gap-1 mb-5">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setNpsScore(i)}
                      className={`h-9 rounded-lg text-sm font-semibold transition-all ${
                        npsScore === i
                          ? i >= 9 ? 'bg-emerald-500 text-white scale-110'
                            : i >= 7 ? 'bg-yellow-400 text-slate-900 scale-110'
                            : 'bg-red-400 text-white scale-110'
                          : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
                <div className={`flex justify-between text-[10px] mb-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span>Not likely</span><span>Very likely</span>
                </div>
                <textarea
                  value={npsComment}
                  onChange={e => setNpsComment(e.target.value)}
                  placeholder="Optional comment (what can we improve?)"
                  rows={2}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none transition focus:ring-2 focus:ring-emerald-500/40 mb-4 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                />
                <button
                  disabled={npsScore === null}
                  onClick={() => {
                    if (npsScore === null) return;
                    try {
                      localStorage.setItem(`qv:nps:shown:${id}`, '1');
                      localStorage.setItem(`qv:nps:data:${id}`, JSON.stringify({ score: npsScore, comment: npsComment, date: new Date().toISOString() }));
                      api.post('/analyses/feedback', { analysis_id: id, score: npsScore, comment: npsComment }).catch(() => {});
                    } catch {}
                    setNpsSent(true);
                    setTimeout(() => setShowNps(false), 2500);
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-40"
                >
                  Submit feedback
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
