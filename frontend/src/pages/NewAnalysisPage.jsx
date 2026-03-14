import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, ChevronDown, HelpCircle, FileText, X, Info, MessageSquare, ImagePlus, CheckCircle2, Loader2, AlertTriangle, Edit2, ScanSearch, TrendingUp, DollarSign, BarChart2, Landmark, Percent } from 'lucide-react';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
// EIN formatter (US Employer Identification Number: XX-XXXXXXX)

// ─── Processing Modal ──────────────────────────────────────
const UPLOAD_STEPS = [
  { key: 'sending', label: 'Sending documents...' },
  { key: 'extracting', label: 'Analyzing documents with AI...' },
  { key: 'valuation', label: 'Calculating valuation...' },
  { key: 'analysis', label: 'Generating strategic analysis...' },
  { key: 'done', label: 'Finalizing report...' },
];

const MANUAL_STEPS = [
  { key: 'sending', label: 'Sending data...' },
  { key: 'valuation', label: 'Calculating valuation...' },
  { key: 'analysis', label: 'Generating report...' },
  { key: 'done', label: 'Finalizing...' },
];

function ProcessingModal({ isOpen, steps, currentStep, error, onRetry, onClose, isDark, progressPercentage, estimatedTimeRemaining }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className={`relative w-full max-w-md rounded-2xl p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          {error ? (
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          ) : currentStep >= steps.length ? (
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          )}
          <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {error ? 'Processing error' : currentStep >= steps.length ? 'Valuation complete!' : 'Processing valuation...'}
          </h3>
          {!error && currentStep < steps.length && (
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {estimatedTimeRemaining ? `Cerca de ${estimatedTimeRemaining}s restantes` : 'This may take up to 1 minute'}
            </p>
          )}
        </div>

        {/* Steps with granular progress */}
        {!error && (
          <div className="space-y-3 mb-6">
            {steps.map((step, idx) => {
              const isActive = idx === currentStep;
              const isDone = idx < currentStep;
              const isPending = idx > currentStep;
              const stepProgress = isActive ? progressPercentage : (isDone ? 100 : 0);
              
              return (
                <div key={step.key} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                  isActive ? (isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200') :
                  isDone ? (isDark ? 'bg-slate-800/50' : 'bg-slate-50') : ''
                }`}>
                  <div className="shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                    ) : (
                      <div className={`w-5 h-5 rounded-full border-2 ${isDark ? 'border-slate-600' : 'border-slate-300'}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium transition-colors ${
                        isDone ? (isDark ? 'text-slate-400' : 'text-slate-500') :
                        isActive ? (isDark ? 'text-emerald-400' : 'text-emerald-700') :
                        (isDark ? 'text-slate-500' : 'text-slate-400')
                      }`}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          {progressPercentage}%
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <div className={`h-1.5 rounded-full overflow-hidden mt-2 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Overall progress bar */}
        {!error && currentStep < steps.length && (
          <div className="space-y-2">
            <div className={`flex justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>Overall progress</span>
              <span>{Math.round((currentStep / steps.length) * 100 + (progressPercentage / steps.length))}%</span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${(currentStep / steps.length) * 100 + (progressPercentage / steps.length)}%` }}
              />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 text-sm ${isDark ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {error}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Close
              </button>
              <button
                onClick={onRetry}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-emerald-600 hover:brightness-110 text-white transition-colors duration-200"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Currency mask helper ──────────────────────────────────
function formatCurrency(value) {
  if (!value && value !== 0) return '';
  const num = typeof value === 'string' ? value.replace(/\D/g, '') : String(value);
  if (!num) return '';
  const cents = parseInt(num, 10);
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(formatted) {
  if (!formatted) return 0;
  return parseFloat(formatted.replace(/\./g, '').replace(',', '.')) || 0;
}

function CurrencyInput({ name, register, label, placeholder, required, isDark, error, setValue, watch, tooltip }) {
  const rawValue = watch ? watch(name) : undefined;
  const [display, setDisplay] = useState('');

  // Sync display when form value changes externally (e.g., draft restore)
  useEffect(() => {
    if (rawValue && !display) {
      const cents = Math.round(rawValue * 100).toString();
      setDisplay(formatCurrency(cents));
    }
  }, [rawValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    const formatted = formatCurrency(raw);
    setDisplay(formatted);
    setValue(name, parseCurrency(formatted), { shouldValidate: true });
  };
  return (
    <div>
      <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
        {label}
        {tooltip && <FieldTooltip text={tooltip} isDark={isDark} />}
      </label>
      <div className="relative">
        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>$</span>
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          placeholder={placeholder || '0,00'}
          className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
        />
      </div>
      <input type="hidden" {...register(name, required ? { required: 'Required', validate: v => v > 0 || 'Value must be greater than zero' } : {})} />
      {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
    </div>
  );
}

// ─── Field Tooltip ───────────────────────────────────────
function FieldTooltip({ text, isDark }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        className={`ml-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center transition ${isDark ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
      >?</button>
      {open && (
        <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 text-xs rounded-xl px-3 py-2.5 shadow-xl border leading-relaxed ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
          {text}
          <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 -mt-1 ${isDark ? 'bg-slate-800 border-r border-b border-slate-700' : 'bg-white border-r border-b border-slate-200'}`} />
        </div>
      )}
    </span>
  );
}

// ─── EIN mask helper (XX-XXXXXXX) ──────────────────────────
function formatEIN(value) {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0,2)}-${digits.slice(2)}`;
}

// ─── Sector fallback list ──────────────────────────────────

const FALLBACK_SECTORS = [
  'tecnologia', 'saude', 'varejo', 'industria', 'servicos',
  'alimentacao', 'educacao', 'construcao', 'agronegocio',
  'financeiro', 'logistica', 'energia', 'imobiliario',
  'consultoria', 'marketing', 'ecommerce', 'outros',
];

const QUALITATIVE_QUESTIONS = [
  // 1. EQUIPE & FUNDADORES (3 perguntas)
  { key: 'equipe_num_fundadores', dim: 'Team', q: 'How many partners/founders does the company currently have?', type: 'choice', options: [
    { value: 1, label: '1 founder (maximum risk)' },
    { value: 2, label: '2 founders' },
    { value: 4, label: '3-4 founders' },
    { value: 5, label: '5+ founders or professional management' },
  ]},
  { key: 'equipe_dedicacao', dim: 'Team', q: 'Do the founders work full-time at the company?', type: 'choice', options: [
    { value: 1, label: 'No, side project' },
    { value: 2, label: 'Part-time (< 20h/week)' },
    { value: 4, label: 'Full-time, but we plan to leave' },
    { value: 5, label: 'Full-time, 100% dedicated' },
  ]},
  { key: 'equipe_experiencia', dim: 'Team', q: "What is the executive team's level of experience in the industry?", type: 'choice', options: [
    { value: 1, label: '< 2 years of experience' },
    { value: 2, label: '2-5 years' },
    { value: 4, label: '5-10 years' },
    { value: 5, label: '10+ years (senior team)' },
  ]},
  // 2. GOVERNANÇA (2 perguntas)
  { key: 'gov_profissional', dim: 'Governance', q: 'Is management professionalized and not solely dependent on the founder?' },
  { key: 'gov_compliance', dim: 'Governance', q: 'Does the company have clear decision-making processes, internal controls, and compliance?' },
  // 3. MERCADO & COMPETIÇÃO (3 perguntas)
  { key: 'mercado_posicao', dim: 'Market', q: 'Is the company a leader or holds a relevant position in its segment?' },
  { key: 'mercado_tendencia', dim: 'Market', q: 'Does the industry show a growth trend for the next 3-5 years?' },
  { key: 'mercado_competicao', dim: 'Market', q: 'What is the level of competition in the market?', type: 'choice', options: [
    { value: 1, label: 'Highly competitive (many players)' },
    { value: 3, label: 'Moderate competition' },
    { value: 4, label: 'Niche with few competitors' },
    { value: 5, label: 'Monopoly or dominant position' },
  ]},
  // 4. CLIENTES & RECEITA (2 perguntas)
  { key: 'clientes_diversificacao', dim: 'Clients', q: 'Is revenue diversified — no single client represents more than 25% of billing?' },
  { key: 'clientes_recorrencia', dim: 'Clients', q: 'Does the company have recurring revenue (MRR/ARR) or long-term contracts?' },
  // 5. PRODUTO & DIFERENCIAÇÃO (2 perguntas)
  { key: 'produto_moat', dim: 'Product', q: 'Does the company have a strong brand, patents, proprietary technology, or a hard-to-replicate advantage?' },
  { key: 'produto_criticidade', dim: 'Product', q: 'Does the product/service solve a critical pain point or is it a "nice-to-have"?', type: 'choice', options: [
    { value: 1, label: 'Nice-to-have (luxury/convenience)' },
    { value: 2, label: 'Important but not urgent' },
    { value: 4, label: 'Solves a significant pain point' },
    { value: 5, label: "Mission-critical (client can't operate without it)" },
  ]},
  // 6. OPERAÇÃO & ESCALABILIDADE (2 perguntas)
  { key: 'operacao_escalavel', dim: 'Operations', q: "Is the operation scalable — growing revenue doesn't require a proportional increase in costs?" },
  { key: 'operacao_automacao', dim: 'Operations', q: 'What is the degree of automation of operational processes?', type: 'choice', options: [
    { value: 1, label: 'Fully manual' },
    { value: 2, label: 'Partially automated (< 30%)' },
    { value: 4, label: 'Moderately automated (30-70%)' },
    { value: 5, label: 'Highly automated (> 70%)' },
  ]},
  // 7. TRAÇÃO & MOMENTUM (1 pergunta)
  { key: 'tracao_investimento', dim: 'Traction', q: 'Has the company received external investment or is it in process?', type: 'choice', options: [
    { value: 1, label: "No, and we don't plan to" },
    { value: 3, label: 'No, but already talking to investors' },
    { value: 4, label: 'Yes, angel/seed investment' },
    { value: 5, label: 'Yes, Series A+ or PE' },
  ]},
];

const QUAL_OPTIONS = [
  { value: 1, label: 'Não', color: 'red' },
  { value: 3, label: 'Partially', color: 'yellow' },
  { value: 5, label: 'Sim', color: 'green' },
];

// ─── Extracted Data Preview Panel ─────────────────────────────────────────────
const PANEL_STYLES = `
@keyframes qv-fade-up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes qv-expand{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
`;
if (typeof document !== 'undefined' && !document.getElementById('qv-panel-styles')) {
  const s = document.createElement('style'); s.id = 'qv-panel-styles'; s.textContent = PANEL_STYLES;
  document.head.appendChild(s);
}

function ExtractedDataBadges({ data, isDark }) {
  const [expanded, setExpanded] = useState(false);
  const sources = data._sources || {};

  const fmt = (val, type) => {
    if (val === null || val === undefined) return null;
    if (type === 'currency') {
      const n = Number(val);
      if (isNaN(n)) return null;
      if (n >= 1_000_000) return `$ ${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `$ ${(n / 1_000).toFixed(0)}K`;
      return `$ ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    if (type === 'percent') {
      const n = Number(val);
      if (isNaN(n)) return null;
      const pct = n > 1 ? n : n * 100;
      return `${pct.toFixed(1)}%`;
    }
    return String(val);
  };

  const critical = [
    { key: 'revenue',     label: 'Net Revenue', type: 'currency', color: 'emerald' },
    { key: 'net_margin',  label: 'Net Margin',  type: 'percent',  color: 'blue'    },
    { key: 'growth_rate', label: 'Growth',      type: 'percent',  color: 'violet'  },
  ];

  const secondary = [
    { key: 'net_income',         label: 'Net Income'   },
    { key: 'ebit',               label: 'EBIT'             },
    { key: 'gross_profit',       label: 'Gross Profit'      },
    { key: 'total_assets',       label: 'Total Assets'      },
    { key: 'equity',             label: 'Net Equity'  },
    { key: 'total_liabilities',  label: 'Total Debt'     },
    { key: 'cash',               label: 'Cash'            },
    { key: 'operating_expenses', label: 'Operating Expenses'},
    { key: 'cogs',               label: 'COGS'        },
    { key: 'years_available',    label: 'Years of data',    type: 'text' },
  ];

  // dot color per KPI health
  const dotColor = (key, value) => {
    if (value === null) return isDark ? 'bg-slate-600' : 'bg-slate-300';
    if (key === 'net_margin') {
      const n = Number(data[key]); const pct = n > 1 ? n : n * 100;
      return pct >= 10 ? 'bg-emerald-400' : pct >= 0 ? 'bg-amber-400' : 'bg-red-400';
    }
    if (key === 'growth_rate') {
      const n = Number(data[key]); const pct = n > 1 ? n : n * 100;
      return pct >= 5 ? 'bg-emerald-400' : pct >= 0 ? 'bg-amber-400' : 'bg-red-400';
    }
    return 'bg-emerald-400';
  };

  const kpiColors = {
    emerald: {
      bg:    isDark ? 'bg-emerald-500/[0.07]' : 'bg-emerald-50/70',
      border:isDark ? 'border-emerald-500/20' : 'border-emerald-200/80',
      label: isDark ? 'text-emerald-400/70'   : 'text-emerald-700/70',
      val:   isDark ? 'text-emerald-300'       : 'text-emerald-800',
    },
    blue: {
      bg:    isDark ? 'bg-blue-500/[0.07]'    : 'bg-blue-50/70',
      border:isDark ? 'border-blue-500/20'    : 'border-blue-200/80',
      label: isDark ? 'text-blue-400/70'      : 'text-blue-700/70',
      val:   isDark ? 'text-blue-300'         : 'text-blue-800',
    },
    violet: {
      bg:    isDark ? 'bg-violet-500/[0.07]'  : 'bg-violet-50/70',
      border:isDark ? 'border-violet-500/20'  : 'border-violet-200/80',
      label: isDark ? 'text-violet-400/70'    : 'text-violet-700/70',
      val:   isDark ? 'text-violet-300'       : 'text-violet-800',
    },
  };

  // summary pills for the collapsed header
  const summaryPills = critical.map(c => {
    const v = fmt(data[c.key], c.type);
    return v ? `${c.label.split(' ')[0]} ${v}` : null;
  }).filter(Boolean);
  if (data.years_available) summaryPills.push(`${data.years_available}y of data`);

  // left/right column split for secondary fields
  const secFiltered = secondary.filter(s => fmt(data[s.key], s.type || 'currency') !== null);
  const left  = secFiltered.filter((_, i) => i % 2 === 0);
  const right = secFiltered.filter((_, i) => i % 2 === 1);

  return (
    <div
      style={{ animation: 'qv-fade-up 0.4s ease both' }}
      className={`rounded-2xl border overflow-hidden transition-all duration-200
        ${isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200 shadow-sm'}`}
    >
      {/* ── Header always visible ── */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150
          ${isDark ? 'hover:bg-slate-700/40' : 'hover:bg-slate-50'}`}
      >
        {/* green check */}
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        </span>

        {/* title */}
        <span className={`text-sm font-semibold flex-shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Extracted data
        </span>

        {/* summary pills */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden flex-1">
          {summaryPills.map((p, i) => (
            <span
              key={i}
              className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0
                ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              {p}
            </span>
          ))}
        </div>

        {/* chevron */}
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200
            ${isDark ? 'text-slate-400' : 'text-slate-400'}
            ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div style={{ animation: 'qv-expand 0.2s ease both' }}>
          {/* divider */}
          <div className={`h-px mx-4 ${isDark ? 'bg-slate-700/60' : 'bg-slate-100'}`} />

          <div className="px-4 pt-4 pb-5 space-y-5">

            {/* ── 3 KPI cards ── */}
            <div className="grid grid-cols-3 gap-3">
              {critical.map(({ key, label, type, color }, idx) => {
                const value = fmt(data[key], type);
                const isNull = value === null;
                const c = kpiColors[color];
                const src = sources[key];
                return (
                  <div
                    key={key}
                    title={src ? `Fonte: ${src}` : undefined}
                    style={{ animation: `qv-fade-up 0.3s ease both`, animationDelay: `${idx * 60}ms` }}
                    className={`relative rounded-xl border p-3.5 cursor-default overflow-hidden
                      ${isNull
                        ? isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'
                        : `${c.bg} ${c.border}`
                      }`}
                  >
                    {/* status dot */}
                    <span className={`absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full ${dotColor(key, value)}`} />

                    <p className={`text-[11px] font-medium mb-1.5 leading-none
                      ${isNull
                        ? isDark ? 'text-slate-600' : 'text-slate-400'
                        : c.label
                      }`}>
                      {label}
                    </p>
                    <p className={`text-xl font-bold tabular-nums leading-none
                      ${isNull
                        ? isDark ? 'text-slate-600' : 'text-slate-400'
                        : c.val
                      }`}>
                      {isNull ? '—' : value}
                    </p>
                    {src && !isNull && (
                      <p className={`text-[9px] mt-2 truncate leading-none ${isDark ? 'text-slate-600' : 'text-slate-400'}`} title={src}>
                        {src}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Secondary fields — 2-column extrato ── */}
            {secFiltered.length > 0 && (
              <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}>
                <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700/50">
                  {[left, right].map((col, ci) => (
                    <div key={ci} className="divide-y divide-slate-100 dark:divide-slate-700/40">
                      {col.map(({ key, label, type }) => {
                        const value = fmt(data[key], type || 'currency');
                        const src = sources[key];
                        return (
                          <div
                            key={key}
                            title={src ? `Fonte: ${src}` : undefined}
                            className={`flex items-center justify-between px-3.5 py-2.5 gap-2
                              ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50/80'} transition-colors duration-100`}
                          >
                            <span className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {label}
                            </span>
                            <span className={`text-xs font-semibold tabular-nums flex-shrink-0
                              ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                              {value ?? '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Notes ── */}
            {data.notes && (
              <p className={`text-[10px] font-mono leading-relaxed px-0.5
                ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {data.notes}
              </p>
            )}

          </div>{/* end px-4 body */}
        </div>
      )}{/* end expanded */}
    </div>
  );
}

function StepIndicator({ step, isDark }) {
  const steps = [
    { n: 1, label: 'Basic Info' },
    { n: 2, label: 'Financial' },
    { n: 3, label: 'Qualitative' },
  ];
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          {i > 0 && <div className={`flex-1 h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />}
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-200 ${step >= s.n ? 'bg-emerald-600 text-white' : isDark ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
              {step > s.n ? '✓' : s.n}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${step === s.n ? isDark ? 'text-white' : 'text-slate-900' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Custom dropdown — only ONE can be open at a time across ALL instances.
 * Uses a global ref so clicking on dropdown B auto-closes dropdown A
 * without any race-conditions from document listeners.
 */
const _activeDropdown = { current: null, close: null };

function DropdownSelect({ value, placeholder, options, onChange, isDark, variant = 'default', dropdownId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const idRef = useRef(dropdownId || Math.random().toString(36));

  // When this dropdown opens, close any other open dropdown
  const doOpen = useCallback(() => {
    if (_activeDropdown.current && _activeDropdown.current !== idRef.current && _activeDropdown.close) {
      _activeDropdown.close();
    }
    _activeDropdown.current = idRef.current;
    _activeDropdown.close = () => setOpen(false);
    setOpen(true);
  }, []);

  const doClose = useCallback(() => {
    if (_activeDropdown.current === idRef.current) {
      _activeDropdown.current = null;
      _activeDropdown.close = null;
    }
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    if (open) doClose(); else doOpen();
  }, [open, doClose, doOpen]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) doClose();
    };
    // Use capture phase so it fires before any other handler
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [open, doClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') doClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, doClose]);

  const selected = options.find(o => String(o.value) === String(value));

  const variantStyles = {
    warning: isDark ? 'bg-slate-700 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-700',
    blue:    isDark ? 'bg-slate-700 border-blue-500/30 text-blue-300'   : 'bg-blue-50 border-blue-200 text-blue-700',
    green:   isDark ? 'bg-slate-700 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700',
    default: isDark ? 'bg-slate-700 border-slate-600 text-slate-300'    : 'bg-white border-slate-200 text-slate-700',
  };

  return (
    <div ref={ref} className="relative" style={{ zIndex: open ? 100 : 1 }}>
      <button
        type="button"
        onPointerDown={(e) => { e.stopPropagation(); }}
        onClick={toggle}
        className={`w-full text-sm rounded-lg px-3 py-2.5 border text-left flex items-center justify-between gap-1 cursor-pointer select-none ${variantStyles[variant]}`}
      >
        <span className={!selected ? 'opacity-60' : ''}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute left-0 right-0 top-full mt-1 rounded-lg border shadow-xl py-1 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}
          style={{ zIndex: 9999 }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => { onChange(opt.value); doClose(); }}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors cursor-pointer ${
                String(opt.value) === String(value)
                  ? isDark ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'bg-emerald-50 text-emerald-700 font-semibold'
                  : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Infer doc type + fiscal year from filename (mirrors backend _infer_from_filename). */
function inferFromFilename(filename) {
  const name = filename.toLowerCase();
  const yearMatch = filename.match(/(20\d{2})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  let type = null;
  if (name.includes('balancete')) {
    type = 'Balancete';
  } else if (
    name.includes('balanço patrimonial') || name.includes('balanco patrimonial') ||
    name.includes('patrimoni') || name.includes('balance_') ||
    name.includes('balanço') || name.includes('balanco') ||
    name.includes('balance')
  ) {
    type = 'Balanço';
  } else if (
    name.includes('dre') || name.includes('demonstra') ||
    name.includes('resultado') || name.includes('income') ||
    name.includes('p&l') || name.includes('profit')
  ) {
    type = 'DRE';
  }
  return { type, year };
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 3;

export default function NewAnalysisPage() {
  usePageTitle('New Analysis');
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState: { errors }, setValue, getValues, reset, watch, trigger } = useForm();
  const [loading, setLoading] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [cnpjError, setCnpjError] = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [mode, setMode] = useState('manual');
  const [step, setStep] = useState(1); // 1=Básico, 2=Financial, 3=Qualitative
  const [projectionYears, setProjectionYears] = useState(5);
  const [showV3Fields, setShowV3Fields] = useState(false);
  const [qualAnswers, setQualAnswers] = useState({});
  const [qualObservations, setQualObservations] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [sectorGroups, setSectorGroups] = useState({});
  const [cnpjLookingUp, setCnpjLookingUp] = useState(false);
  const [cnpjFilled, setCnpjFilled] = useState(false);
  const [cnpjLookingUpUpload, setCnpjLookingUpUpload] = useState(false);
  const [cnpjFilledUpload, setCnpjFilledUpload] = useState(false);
  const uploadCompanyNameRef = useRef(null);
  const uploadSectorRef = useRef(null);
  const uploadCnpjRef = useRef(null);
  const { isDark } = useTheme();

  // Processing modal state
  const [processingOpen, setProcessingOpen] = useState(false);
  const [processingSteps, setProcessingSteps] = useState(MANUAL_STEPS);
  const [processingStep, setProcessingStep] = useState(0);
  const [processingError, setProcessingError] = useState(null);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);
  const stepTimerRef = useRef(null);
  const retryFnRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const startTimeRef = useRef(null);

  const startProcessing = (steps, timings) => {
    setProcessingSteps(steps);
    setProcessingStep(0);
    setProcessingError(null);
    setProgressPercentage(0);
    setEstimatedTimeRemaining(0);
    setProcessingOpen(true);
    
    // Calculate total estimated time
    const totalTime = timings.reduce((acc, t) => acc + t, 0);
    startTimeRef.current = Date.now();
    
    // Automatically advance steps with granular progress
    let idx = 0;
    let stepProgress = 0;
    
    const advance = () => {
      if (idx < timings.length) {
        const stepDuration = timings[idx];
        
        // Update progress within current step
        progressIntervalRef.current = setInterval(() => {
          stepProgress += 2; // Update every 2%
          if (stepProgress > 100) stepProgress = 100;
          setProgressPercentage(stepProgress);
          
          // Calculate estimated time remaining
          const elapsed = Date.now() - startTimeRef.current;
          const remaining = totalTime - elapsed;
          setEstimatedTimeRemaining(Math.max(0, Math.ceil(remaining / 1000)));
        }, stepDuration / 50); // 50 updates per step
        
        stepTimerRef.current = setTimeout(() => {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          idx++;
          setProcessingStep(prev => Math.min(prev + 1, steps.length - 1));
          stepProgress = 0;
          advance();
        }, stepDuration);
      }
    };
    advance();
  };

  const stopProcessing = () => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  const completeProcessing = (analysisId) => {
    stopProcessing();
    localStorage.removeItem('qv_draft_analysis');
    setProcessingStep(99); // past last = done state
    setTimeout(() => {
      setProcessingOpen(false);
      navigate(`/analysis/${analysisId}`);
    }, 1200);
  };

  const failProcessing = (message) => {
    stopProcessing();
    setProcessingError(message);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => stopProcessing();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll progress bar
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollPct(max > 0 ? Math.round((window.scrollY / max) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Pre-fill fields from WACC calculator navigation
  useEffect(() => {
    if (location.state?.wacc) {
      setShowV3Fields(true);
      toast('WACC of ' + location.state.wacc + '% imported from calculator.', { icon: '📊' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revoke blob URLs on cleanup to prevent memory leaks
  useEffect(() => {
    return () => { if (logoPreview) URL.revokeObjectURL(logoPreview); };
  }, [logoPreview]);

  // Auto-save draft on mount + restore
  useEffect(() => {
    const saved = localStorage.getItem('qv_draft_analysis');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed._form) reset(parsed._form);
        if (parsed._mode) setMode(parsed._mode);
        if (parsed._projectionYears) setProjectionYears(parsed._projectionYears);
        if (parsed._qualAnswers) {
          // Filter out stale keys from old drafts that don't match current questions
          const validKeys = new Set(QUALITATIVE_QUESTIONS.map(q => q.key));
          const cleaned = Object.fromEntries(Object.entries(parsed._qualAnswers).filter(([k]) => validKeys.has(k)));
          setQualAnswers(cleaned);
        }
        if (parsed._qualObservations) {
          const validKeys = new Set(QUALITATIVE_QUESTIONS.map(q => q.key));
          const cleaned = Object.fromEntries(Object.entries(parsed._qualObservations).filter(([k]) => validKeys.has(k)));
          setQualObservations(cleaned);
        }
        // Restore upload-mode fields after DOM renders
        if (parsed._uploadCompanyName || parsed._uploadSector || parsed._uploadCnpj) {
          setTimeout(() => {
            if (parsed._uploadCompanyName && uploadCompanyNameRef.current) uploadCompanyNameRef.current.value = parsed._uploadCompanyName;
            if (parsed._uploadSector && uploadSectorRef.current) uploadSectorRef.current.value = parsed._uploadSector;
            if (parsed._uploadCnpj && uploadCnpjRef.current) uploadCnpjRef.current.value = parsed._uploadCnpj;
          }, 100);
        }
        toast('Draft restored automatically', { icon: '📝' });
      } catch { localStorage.removeItem('qv_draft_analysis'); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const formValues = getValues();
      // Also capture upload-mode fields from refs
      const uploadCompanyName = uploadCompanyNameRef.current?.value || '';
      const uploadSector = uploadSectorRef.current?.value || '';
      const uploadCnpj = uploadCnpjRef.current?.value || '';
      const hasData = Object.values(formValues).some(v => v !== null && v !== undefined && v !== '')
        || Object.keys(qualAnswers).length > 0
        || uploadCompanyName || uploadSector || uploadCnpj;
      if (hasData) {
        const draft = {
          _form: formValues,
          _mode: mode,
          _projectionYears: projectionYears,
          _qualAnswers: qualAnswers,
          _qualObservations: qualObservations,
          _uploadCompanyName: uploadCompanyName,
          _uploadSector: uploadSector,
          _uploadCnpj: uploadCnpj,
        };
        localStorage.setItem('qv_draft_analysis', JSON.stringify(draft));
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 3000);
      }
    }, 5000); // F1: auto-save every 5s (was 30s)
    return () => clearInterval(interval);
  }, [getValues, mode, projectionYears, qualAnswers, qualObservations]);

  // Fetch sectors from API
  useEffect(() => {
    api.get('/analyses/sectors/list')
      .then(({ data }) => {
        setSectors(data.sectors || []);
        setSectorGroups(data.groups || {});
      })
      .catch(() => setSectors(FALLBACK_SECTORS.map(s => ({ id: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))));
  }, []);

  const onSubmitManual = async (data) => {
    setLoading(true);
    startProcessing(MANUAL_STEPS, [2000, 5000, 8000]);
    const doSubmit = async () => {
      try {
        const payload = {
          company_name: data.company_name,
          sector: data.sector,
          cnpj: data.cnpj || null,
          revenue: typeof data.revenue === 'number' ? data.revenue : parseFloat(data.revenue),
          net_margin: parseFloat(data.net_margin) / 100,
          growth_rate: data.growth_rate ? parseFloat(data.growth_rate) / 100 : null,
          debt: typeof data.debt === 'number' ? data.debt : parseFloat(data.debt || 0),
          cash: typeof data.cash === 'number' ? data.cash : parseFloat(data.cash || 0),
          founder_dependency: parseFloat(data.founder_dependency || 0) / 100,
          projection_years: projectionYears,
          // v3 fields
          ebitda: typeof data.ebitda === 'number' ? data.ebitda : (data.ebitda ? parseFloat(data.ebitda) : null),
          recurring_revenue_pct: data.recurring_revenue_pct ? parseFloat(data.recurring_revenue_pct) / 100 : 0,
          num_employees: data.num_employees ? parseInt(data.num_employees) : 0,
          years_in_business: data.years_in_business ? parseInt(data.years_in_business) : 3,
          previous_investment: typeof data.previous_investment === 'number' ? data.previous_investment : parseFloat(data.previous_investment || 0),
          qualitative_answers: Object.keys(qualAnswers).length > 0
            ? Object.fromEntries(Object.entries(qualAnswers).map(([k, v]) => [
                k, { score: v, ...(qualObservations[k] ? { obs: qualObservations[k] } : {}) }
              ]))
            : null,
          dcf_weight: data.dcf_weight ? parseFloat(data.dcf_weight) / 100 : 0.60,
        };
        const { data: result } = await api.post('/analyses/', payload, { timeout: 120000 });
        // Upload logo if provided
        if (logoFile && result.id) {
          const logoData = new FormData();
          logoData.append('logo', logoFile);
          try {
            await api.post(`/analyses/${result.id}/logo`, logoData, { headers: { 'Content-Type': 'multipart/form-data' } });
          } catch { /* logo upload is best-effort */ }
        }
        completeProcessing(result.id);
      } catch (err) {
        let msg;
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          msg = 'The request took longer than expected. Please try again.';
        } else {
          const detail = err.response?.data?.detail;
          if (Array.isArray(detail)) {
            msg = detail.map(d => typeof d === 'object' ? (d.msg || JSON.stringify(d)) : String(d)).join('; ');
          } else if (typeof detail === 'object' && detail !== null) {
            msg = detail.msg || JSON.stringify(detail);
          } else {
            msg = detail || 'Error creating analysis. Please try again.';
          }
        }
        failProcessing(String(msg));
      } finally {
        setLoading(false);
      }
    };
    retryFnRef.current = () => {
      setLoading(true);
      startProcessing(MANUAL_STEPS, [2000, 5000, 8000]);
      doSubmit();
    };
    doSubmit();
  };

  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadFileLabels, setUploadFileLabels] = useState([]); // [{type, year}] parallel to uploadFiles
  const [uploadPhase, setUploadPhase] = useState('drop'); // 'drop' | 'extracting' | 'preview'
  const [extractedPreview, setExtractedPreview] = useState(null);

  const handleExtractPreview = async () => {
    if (uploadFiles.length < 2) {
      toast.error('Select at least 2 files (e.g., 1 Income Statement + 1 Balance Sheet).');
      return;
    }
    const unlabeled = uploadFileLabels.filter(l => !l?.type || !l?.year);
    if (unlabeled.length > 0) {
      toast.error('Select the type (Income Statement / Balance Sheet) and year of each file before continuing.');
      return;
    }
    setUploadPhase('extracting');

    const formData = new FormData();
    uploadFiles.forEach(f => formData.append('files', f));
    formData.append('file_labels', JSON.stringify(uploadFileLabels));

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data } = await api.post('/analyses/extract-preview', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 90000,
        });

        // Validação mínima: receita é obrigatória para o valuation
        if (!data.revenue) {
          setUploadPhase('drop');
          toast.error(
            'Could not identify Revenue in the submitted documents. Check that the file contains a complete Income Statement and try again.',
            { duration: 6000 }
          );
          return;
        }

        setExtractedPreview(data);
        setUploadPhase('preview');

        const fieldCount = data._field_count ?? Object.keys(data).filter(k => !k.startsWith('_') && k !== 'notes' && data[k] !== null).length;
        const fileCount  = data._file_count ?? uploadFiles.length;
        toast.success(`✓ ${fieldCount} campo${fieldCount !== 1 ? 's' : ''} extraído${fieldCount !== 1 ? 's' : ''} de ${fileCount} documento${fileCount !== 1 ? 's' : ''}`);
        return;
      } catch (err) {
        lastError = err;
        // Validation errors (422) are deterministic — no point retrying
        if (err.response?.status === 422) break;
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    setUploadPhase('drop');
    // Format validation error detail (can be string or array of strings)
    const detail = lastError?.response?.data?.detail;
    let msg;
    if (Array.isArray(detail)) {
      msg = detail.join('\n');
    } else if (typeof detail === 'string') {
      msg = detail;
    } else {
      msg = 'Could not process the documents. Check that the files contain a readable Income Statement or Balance Sheet and try again.';
    }
    toast.error(msg, { duration: 8000 });
  };

  const resetUploadPhase = () => {
    setUploadPhase('drop');
    setExtractedPreview(null);
    setUploadFiles([]);
    setUploadFileLabels([]);
  };

  const onUpload = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    if (uploadFiles.length < 2) {
      toast.error('Select at least 2 files.');
      return;
    }
    const unlabeledUp = uploadFileLabels.filter(l => !l?.type || !l?.year);
    if (unlabeledUp.length > 0) {
      toast.error('Select the type and year of each file before continuing.');
      return;
    }
    setLoading(true);
    startProcessing(UPLOAD_STEPS, [3000, 10000, 15000, 10000]);
    const doUpload = async () => {
      try {
        const formData = new FormData();
        uploadFiles.forEach(f => formData.append('files', f));
        formData.append('file_labels', JSON.stringify(uploadFileLabels));
        formData.append('company_name', form.get('company_name'));
        formData.append('sector', form.get('sector'));
        formData.append('cnpj', form.get('cnpj') || '');
        formData.append('founder_dependency', form.get('founder_dependency') || '0');
        formData.append('projection_years', String(projectionYears));
        if (Object.keys(qualAnswers).length > 0) {
          const nested = Object.fromEntries(Object.entries(qualAnswers).map(([k, v]) => [
            k, { score: v, ...(qualObservations[k] ? { obs: qualObservations[k] } : {}) }
          ]));
          formData.append('qualitative_answers', JSON.stringify(nested));
        }
        if (logoFile) {
          formData.append('logo', logoFile);
        }
        const { data: result } = await api.post('/analyses/upload', formData, {
          timeout: 300000,
        });
        completeProcessing(result.id);
      } catch (err) {
        let msg;
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          msg = 'The request took longer than expected. The server may still be processing. Please try again in a moment.';
        } else if (err.message?.includes('Network Error') || err.message?.includes('CORS')) {
          msg = 'Server connection error. Please try again in a moment.';
        } else {
          const detail = err.response?.data?.detail;
          if (Array.isArray(detail)) {
            msg = detail.map(d => typeof d === 'object' ? (d.msg || JSON.stringify(d)) : String(d)).join('; ');
          } else if (typeof detail === 'object' && detail !== null) {
            msg = detail.msg || JSON.stringify(detail);
          } else {
            msg = detail || 'Error processing upload. Please try again.';
          }
        }
        failProcessing(String(msg));
      } finally {
        setLoading(false);
      }
    };
    retryFnRef.current = () => {
      setLoading(true);
      startProcessing(UPLOAD_STEPS, [3000, 10000, 15000, 10000]);
      doUpload();
    };
    doUpload();
  };

  return (
    <>
      {/* Scroll progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 pointer-events-none">
        <div
          className="h-full bg-emerald-500 transition-all duration-200"
          style={{ width: `${scrollPct}%` }}
        />
      </div>
      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className={`transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>New Analysis</h1>
          </div>
          {draftSaved && (
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved automatically
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setMode('manual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'manual'
                ? 'bg-emerald-600 text-white'
                : isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Enter manually
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'upload'
                ? 'bg-emerald-600 text-white'
                : isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Upload Income Statement / Balance Sheet
          </button>
        </div>

        {mode === 'manual' ? (
          <form onSubmit={handleSubmit(onSubmitManual)} className={`border rounded-2xl p-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <StepIndicator step={step} isDark={isDark} />

            {/* Step 1: Basic Info */}
            {step === 1 && (
            <div>
            <h2 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Company information</h2>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Company name *</label>
                <input
                  {...register('company_name', { required: 'Required' })}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="Company name"
                />
                {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name.message}</p>}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Industry *</label>
                <select
                  {...register('sector', { required: 'Required' })}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                >
                  <option value="">Select...</option>
                  {Object.keys(sectorGroups).length > 0
                    ? Object.entries(sectorGroups).map(([group, items]) => (
                        <optgroup key={group} label={group}>
                          {items.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </optgroup>
                      ))
                    : sectors.map((s) => (
                        <option key={s.id || s} value={s.id || s}>{s.label || s}</option>
                      ))
                  }
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  EIN (optional)
                </label>
                <input
                  {...register('cnpj')}
                  maxLength={10}
                  onChange={(e) => {
                    e.target.value = formatEIN(e.target.value);
                  }}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="XX-XXXXXXX"
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Company logo (optional)</label>
                <div className="relative">
                  {logoPreview ? (
                    <div className={`flex items-center gap-3 px-4 py-3 border rounded-xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <img src={logoPreview} alt="Logo" className="w-10 h-10 rounded-lg object-contain" loading="lazy" />
                      <span className={`text-sm truncate flex-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{logoFile?.name}</span>
                      <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                        className={`p-1 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition ${isDark ? 'bg-slate-800 border-slate-700 hover:border-emerald-500/50 text-slate-500' : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-400'}`}>
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-sm">Click to upload the logo</span>
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (f.size > 2 * 1024 * 1024) { toast.error('Logo must be 2MB or less'); return; }
                            setLogoFile(f);
                            if (logoPreview) URL.revokeObjectURL(logoPreview);
                            setLogoPreview(URL.createObjectURL(f));
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
            </div>
            )}

            {/* Step 2: Dados Financials */}
            {step === 2 && (
            <div>
            <h2 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Financial data</h2>

            <div className="grid md:grid-cols-2 gap-5">

              <CurrencyInput name="revenue" register={register} setValue={setValue} watch={watch} label="Annual revenue ($) *" placeholder="1,000,000.00" required isDark={isDark} error={errors.revenue} tooltip="Total sales or services in the last fiscal year (e.g., $1,000,000)." />

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Net margin (%) *
                  <FieldTooltip text="Net income divided by revenue. E.g., revenue $1M, profit $150k → 15%. Can be negative for growing companies." isDark={isDark} />
                </label>
                <input
                  {...register('net_margin', { required: 'Required', min: { value: -100, message: 'Min. -100%' }, max: { value: 100, message: 'Max. 100%' } })}
                  type="number"
                  step="0.1"
                  min="-100"
                  max="100"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="15"
                />
                {errors.net_margin && <p className="text-red-500 text-xs mt-1">{errors.net_margin.message}</p>}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Growth rate (%)
                  <FieldTooltip text="Average annual revenue growth over the last 2–3 years. Early-stage companies can use a conservative projection." isDark={isDark} />
                </label>
                <input
                  {...register('growth_rate')}
                  type="number"
                  step="0.1"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="10"
                />
              </div>

              <CurrencyInput name="debt" register={register} setValue={setValue} watch={watch} label="Total debt ($)" placeholder="0.00" isDark={isDark} error={errors.debt} tooltip="Sum of all financial debts: loans, financing, debentures. Excludes trade payables." />
              <CurrencyInput name="cash" register={register} setValue={setValue} watch={watch} label="Cash ($)" placeholder="0.00" isDark={isDark} error={errors.cash} tooltip="Cash balance + short-term investments + immediately available financial investments." />

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Founder dependency (0-100%)
                  <FieldTooltip text="How much the company would depend on you to keep operating. 0% = fully professional management; 100% = only you know how to run it." isDark={isDark} />
                </label>
                <input
                  {...register('founder_dependency')}
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="0"
                />
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>0% = no dependency, 100% = fully dependent</p>
              </div>
            </div>

            {/* ─── Real-time Estimate Widget ─────────────────── */}
            {(() => {
              const rev = watch('revenue');
              const margin = parseFloat(watch('net_margin'));
              const growth = parseFloat(watch('growth_rate')) || 10;
              if (!rev || isNaN(margin)) return null;
              const netIncome = rev * (margin / 100);
              if (netIncome <= 0) return null;
              const multiple = growth > 30 ? 14 : growth > 20 ? 10 : growth > 10 ? 7 : 5;
              const low = Math.round(netIncome * (multiple * 0.7));
              const high = Math.round(netIncome * multiple);
              const fmt = (n) => n >= 1e6
                ? `$ ${(n / 1e6).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
                : `$ ${(n / 1e3).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`;
              return (
                <div className={`mt-6 flex items-center gap-4 rounded-xl px-5 py-4 border ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                  <TrendingUp className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Preliminary estimate</p>
                    <p className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmt(low)} – {fmt(high)}</p>
                  </div>
                  <p className={`text-[10px] leading-snug text-right max-w-[120px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Subject to full analysis. {multiple}× lucro líquido.</p>
                </div>
              );
            })()}

            {/* v3: Additional fields */}
            <div className="mt-6">
              <button type="button" onClick={() => setShowV3Fields(!showV3Fields)}
                className={`flex items-center gap-2 text-sm font-medium transition ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
                <ChevronDown className={`w-4 h-4 transition-transform ${showV3Fields ? 'rotate-180' : ''}`} /> Additional data (optional, improves accuracy)
              </button>
              {showV3Fields && (
              <div className="mt-4 grid md:grid-cols-2 gap-5">
                <CurrencyInput name="ebitda" register={register} setValue={setValue} watch={watch} label="Annual EBITDA ($)" placeholder="Calculate automatically" isDark={isDark} error={errors.ebitda} tooltip="Earnings before interest, taxes, depreciation, and amortization. If unknown, leave blank — we'll calculate it automatically." />
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    % Recurring revenue
                    <FieldTooltip text="Percentage of revenue that recurs automatically (subscriptions, fixed contracts, monthly fees). Increases the valuation multiple." isDark={isDark} />
                  </label>
                  <input {...register('recurring_revenue_pct')} type="number" min="0" max="100" step="5"
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    placeholder="0" />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Number of employees
                    <FieldTooltip text="Total headcount (employees + contractors). Used as a proxy for value per employee in industry benchmarks." isDark={isDark} />
                  </label>
                  <input {...register('num_employees')} type="number" min="0"
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    placeholder="0" />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Years in operation
                    <FieldTooltip text="How many years the company has been active. More mature companies receive a lower risk discount in valuation." isDark={isDark} />
                  </label>
                  <input {...register('years_in_business')} type="number" min="0"
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    placeholder="3" />
                </div>
                <CurrencyInput name="previous_investment" register={register} setValue={setValue} watch={watch} label="Investment already received ($)" placeholder="0.00" isDark={isDark} error={errors.previous_investment} />
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>DCF vs Multiples weight (%)</label>
                  <input {...register('dcf_weight')} type="number" min="30" max="90" step="5" defaultValue="60"
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`} />
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>60% = DCF 60%, Multiples 40%</p>
                </div>
              </div>
              )}
            </div>

            {/* Projection Years Toggle */}
            <div className="mt-6">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Projection horizon
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setProjectionYears(5)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition border ${
                    projectionYears === 5
                      ? 'bg-emerald-600 text-white border-transparent shadow-lg shadow-emerald-600/25'
                      : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-emerald-500/50' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  5 years
                </button>
                <button
                  type="button"
                  onClick={() => setProjectionYears(10)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 border ${
                    projectionYears === 10
                      ? 'bg-emerald-600 text-white border-transparent shadow-lg shadow-emerald-600/25'
                      : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-emerald-500/50' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  10 years
                </button>
              </div>
              <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {projectionYears === 5
                  ? 'Recommended for companies with short track records or volatile industries'
                  : 'Recommended for mature companies with predictable revenue'}
              </p>
            </div>
            </div>
            )}

            {/* Step 3: Qualitative Assessment */}
            {step === 3 && (
            <div>

            {/* Qualitative Assessment — MANDATORY */}
            <div className={`mt-8 border rounded-2xl p-6 ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Qualitative Assessment</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>±15% accuracy</span>
              </div>
              <p className={`text-xs mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Answer each question to refine the valuation accuracy. The observation field is optional.
              </p>

              <div className="space-y-4">
                {QUALITATIVE_QUESTIONS.map((q, idx) => {
                  // Use perguntas customizadas (type='choice') ou padrão (Sim/Não/Partially)
                  const options = q.options || QUAL_OPTIONS;
                  const isMultiChoice = q.options && q.options.length > 3;
                  
                  return (
                  <div key={q.key} className={`pb-4 ${idx < QUALITATIVE_QUESTIONS.length - 1 ? `border-b ${isDark ? 'border-slate-700/60' : 'border-slate-200'}` : ''}`}>
                    <div className="flex items-start gap-2 mb-2.5">
                      <span className={`text-xs font-semibold uppercase tracking-wide mt-0.5 shrink-0 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>{q.dim}</span>
                      <p className={`text-sm leading-snug ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{q.q}</p>
                    </div>
                    <div className={`flex gap-2 mb-2 ${isMultiChoice ? 'flex-col' : ''}`}>
                      {options.map((opt) => {
                        const selected = qualAnswers[q.key] === opt.value;
                        const colorMap = {
                          red: selected
                            ? 'bg-red-500/90 text-white border-red-500 shadow-lg shadow-red-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-red-400 hover:text-red-400' : 'border-slate-300 text-slate-500 hover:border-red-400 hover:text-red-500',
                          yellow: selected
                            ? 'bg-amber-500/90 text-white border-amber-500 shadow-lg shadow-amber-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-amber-400 hover:text-amber-400' : 'border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-500',
                          green: selected
                            ? 'bg-emerald-500/90 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-emerald-400 hover:text-emerald-400' : 'border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-500',
                        };
                        // Para perguntas multi-choice (4+ opções), usa estilo neutro
                        const baseStyle = isMultiChoice 
                          ? selected 
                            ? 'bg-emerald-500/90 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                            : isDark ? 'bg-slate-800 border-slate-600 text-slate-300 hover:border-emerald-400' : 'bg-white border-slate-300 text-slate-600 hover:border-emerald-400'
                          : colorMap[opt.color || 'green'];
                        
                        return (
                          <button key={opt.value} type="button"
                            onClick={() => setQualAnswers(prev => ({ ...prev, [q.key]: opt.value }))}
                            className={`${isMultiChoice ? 'w-full text-left' : 'flex-1'} py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${baseStyle}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Optional observation */}
                    <div className="relative">
                      <MessageSquare className={`absolute left-3 top-2.5 w-3.5 h-3.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                      <input type="text"
                        placeholder="Observation (optional)"
                        value={qualObservations[q.key] || ''}
                        onChange={(e) => setQualObservations(prev => ({ ...prev, [q.key]: e.target.value }))}
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-lg border transition ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 placeholder-slate-600 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-600 placeholder-slate-400 focus:border-emerald-400'}`}
                      />
                    </div>
                  </div>
                )})}
              </div>

              {/* Progress indicator */}
              {(() => { const validKeys = QUALITATIVE_QUESTIONS.map(q => q.key); const answered = Object.keys(qualAnswers).filter(k => validKeys.includes(k)).length; const total = QUALITATIVE_QUESTIONS.length; return (
              <div className={`mt-4 flex items-center gap-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <span>{answered}/{total} answered</span>
                <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(answered / total) * 100}%` }} />
                </div>
              </div>
              ); })()}
            </div>

            <button
              type="submit"
              disabled={loading || QUALITATIVE_QUESTIONS.some(q => qualAnswers[q.key] === undefined)}
              className="mt-8 w-full bg-emerald-600 hover:brightness-110 text-white py-3 rounded-xl font-semibold transition-colors duration-200 disabled:opacity-50 shadow-lg shadow-emerald-600/25"
            >
              {(() => { const validKeys = QUALITATIVE_QUESTIONS.map(q => q.key); const answered = Object.keys(qualAnswers).filter(k => validKeys.includes(k)).length; const total = QUALITATIVE_QUESTIONS.length; return loading ? 'Calculating valuation...' : answered < total ? `Answer all questions (${answered}/${total})` : 'Calculate valuation'; })()}
            </button>
            </div>
            )}

            {/* Step navigation */}
            <div className="mt-8 flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(s => s - 1)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors duration-200 ${isDark ? 'border-slate-700 text-slate-300 hover:border-emerald-500/50' : 'border-slate-200 text-slate-600 hover:border-emerald-300'}`}
                >
                  ← Previous
                </button>
              )}
              {step < 3 && (
                <button
                  type="button"
                  onClick={async () => {
                    const fieldsToValidate = step === 1 ? ['company_name', 'sector'] : ['revenue', 'net_margin'];
                    const valid = await trigger(fieldsToValidate);
                    if (valid) setStep(s => s + 1);
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold bg-emerald-600 hover:brightness-110 text-white transition-colors duration-200 shadow-lg shadow-emerald-600/25"
                >
                  Next →
                </button>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={onUpload} className={`border rounded-2xl p-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Upload Income Statement / Balance Sheet</h2>

            {/* Info badge */}
            <div className={`flex items-start gap-3 rounded-xl p-4 mb-6 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-medium mb-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>What AI extracts automatically</p>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-blue-400/80' : 'text-blue-600'}`}>
                  Revenue, net margin, growth rate, debt and cash are automatically extracted from your documents.
                  Fields like founder dependency and qualitative assessment need to be filled in manually below.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Company name *</label>
                <input
                  ref={uploadCompanyNameRef}
                  name="company_name"
                  required
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="Company name"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Industry *</label>
                <select
                  ref={uploadSectorRef}
                  name="sector"
                  required
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                >
                  <option value="">Select...</option>
                  {Object.keys(sectorGroups).length > 0
                    ? Object.entries(sectorGroups).map(([group, items]) => (
                        <optgroup key={group} label={group}>
                          {items.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </optgroup>
                      ))
                    : sectors.map((s) => (
                        <option key={s.id || s} value={s.id || s}>{s.label || s}</option>
                      ))
                  }
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  EIN *
                </label>
                <input
                  ref={uploadCnpjRef}
                  name="cnpj"
                  required
                  maxLength={10}
                  onChange={(e) => {
                    e.target.value = formatEIN(e.target.value);
                  }}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="XX-XXXXXXX"
                />
              </div>
            </div>

            {/* Logo Upload */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Company logo (optional)</label>
              {logoPreview ? (
                <div className={`flex items-center gap-3 px-4 py-3 border rounded-xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <img src={logoPreview} alt="Logo" className="w-10 h-10 rounded-lg object-contain" loading="lazy" />
                  <span className={`text-sm truncate flex-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{logoFile?.name}</span>
                  <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                    className={`p-1 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className={`flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition ${isDark ? 'bg-slate-800 border-slate-700 hover:border-emerald-500/50 text-slate-500' : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-400'}`}>
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-sm">Click to upload the logo</span>
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 2 * 1024 * 1024) { toast.error('Logo must be 2MB or less'); return; }
                        setLogoFile(f);
                        if (logoPreview) URL.revokeObjectURL(logoPreview);
                        setLogoPreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                </label>
              )}
            </div>

            {/* File Upload — Phased: drop → extracting → preview */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Financial documents *</label>

              {/* ─── PHASE: drop ─── */}
              {uploadPhase === 'drop' && (
                <>
                  <div className={`flex items-start gap-2 rounded-lg px-3 py-2 mb-3 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                      Upload between <strong>2 and 6 files</strong> (Income Statement and Balance Sheet for each year).
                      For each file, select the <strong>type</strong> and the <strong>fiscal year</strong>.
                      Accepted years: <strong>{MIN_YEAR} to {CURRENT_YEAR}</strong>.
                    </p>
                  </div>
                  <div
                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition ${isDark ? 'border-slate-700 hover:border-emerald-500/50' : 'border-slate-200 hover:border-emerald-300'}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const MAX_MB = 10;
                      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => /\.(pdf|xlsx|xls)$/i.test(f.name));
                      const oversized = droppedFiles.filter(f => f.size > MAX_MB * 1024 * 1024);
                      if (oversized.length > 0) toast.error(`${oversized.map(f => f.name).join(', ')}: file(s) exceed ${MAX_MB}MB`);
                      const valid = droppedFiles.filter(f => f.size <= MAX_MB * 1024 * 1024);
                      if (valid.length > 0) {
                        const newLabels = valid.map(f => {
                          const { type, year } = inferFromFilename(f.name);
                          return { type: type === 'Balanço' || type === 'Balancete' ? 'Balance Sheet' : type || null, year: year || null };
                        });
                        setUploadFiles(prev => [...prev, ...valid].slice(0, 6));
                        setUploadFileLabels(prev => [...prev, ...newLabels].slice(0, 6));
                      }
                    }}
                  >
                    <Upload className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    <p className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Drag or select your files</p>
                    <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>PDF or Excel — 2 to 6 files</p>
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls"
                      multiple
                      onChange={(e) => {
                        const MAX_MB = 10;
                        const newFiles = Array.from(e.target.files || []);
                        const oversized = newFiles.filter(f => f.size > MAX_MB * 1024 * 1024);
                        if (oversized.length > 0) toast.error(`${oversized.map(f => f.name).join(', ')}: file(s) exceed ${MAX_MB}MB`);
                        const valid = newFiles.filter(f => f.size <= MAX_MB * 1024 * 1024);
                        if (valid.length > 0) {
                          const newLabels = valid.map(f => {
                            const { type, year } = inferFromFilename(f.name);
                            return { type: type === 'Balanço' || type === 'Balancete' ? 'Balance Sheet' : type || null, year: year || null };
                          });
                          setUploadFiles(prev => [...prev, ...valid].slice(0, 6));
                          setUploadFileLabels(prev => [...prev, ...newLabels].slice(0, 6));
                        }
                        e.target.value = '';
                      }}
                      className={`block mx-auto text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:text-sm ${isDark ? 'text-slate-400 file:bg-emerald-500/20 file:text-emerald-400' : 'text-slate-500 file:bg-emerald-50 file:text-emerald-600 hover:file:bg-emerald-100'}`}
                    />
                  </div>
                  {/* File list with explicit type + year selectors */}
                  {uploadFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {uploadFiles.map((f, i) => {
                        const label = uploadFileLabels[i] || { type: null, year: null };
                        const labelOk = !!label.type && !!label.year;
                        return (
                          <div key={`${f.name}-${f.size}-${i}`} className={`rounded-xl border px-3 py-2.5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            {/* Row 1: filename + size + remove */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span className={`text-sm truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{f.name}</span>
                                <span className={`text-xs shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{(f.size / 1024).toFixed(0)} KB</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadFiles(prev => prev.filter((_, idx) => idx !== i));
                                  setUploadFileLabels(prev => prev.filter((_, idx) => idx !== i));
                                }}
                                className="text-red-400 hover:text-red-500 hover:bg-red-500/10 transition rounded-lg p-1.5 shrink-0 -mr-1"
                                title="Remove file"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                            {/* Row 2: type + year buttons */}
                            <div className="grid grid-cols-2 gap-2">
                              {/* Type selector */}
                              <DropdownSelect
                                dropdownId={`type-${i}`}
                                value={label.type || ''}
                                placeholder="Type…"
                                options={[
                                  { value: 'DRE', label: 'DRE' },
                                  { value: 'Balance Sheet', label: 'Balance Sheet' },
                                ]}
                                onChange={val => setUploadFileLabels(prev => prev.map((l, idx) => idx === i ? { ...l, type: val || null } : l))}
                                isDark={isDark}
                                variant={!label.type ? 'warning' : label.type === 'DRE' ? 'blue' : 'green'}
                              />
                              {/* Year selector */}
                              <DropdownSelect
                                dropdownId={`year-${i}`}
                                value={label.year != null ? String(label.year) : ''}
                                placeholder="Year…"
                                options={Array.from({ length: 4 }, (_, k) => {
                                  const yr = CURRENT_YEAR - k;
                                  return { value: String(yr), label: String(yr) };
                                })}
                                onChange={val => setUploadFileLabels(prev => prev.map((l, idx) => idx === i ? { ...l, year: val ? parseInt(val) : null } : l))}
                                isDark={isDark}
                                variant={!label.year ? 'warning' : 'default'}
                              />
                            </div>
                            {!labelOk && (
                              <p className={`text-xs mt-1.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>⚠ Select the type and year for this file</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* "Upload files" button — only shown when files are selected */}
                  {uploadFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExtractPreview}
                      className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:brightness-110 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-600/25"
                    >
                      <ScanSearch className="w-4 h-4" />
                      Submit and extract financial data
                    </button>
                  )}
                </>
              )}

              {/* ─── PHASE: extracting ─── */}
              {uploadPhase === 'extracting' && (
                <div className={`rounded-2xl border p-8 flex flex-col items-center gap-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Analyzing documents with AI...</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>This may take up to 30 seconds</p>
                  </div>
                  <div className={`flex gap-1.5 mt-1`}>
                    {uploadFiles.map((f, i) => (
                      <span key={i} className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-white border border-slate-200 text-slate-500'}`}>{f.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── PHASE: preview ─── */}
              {uploadPhase === 'preview' && extractedPreview && (
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <ExtractedDataBadges data={extractedPreview} isDark={isDark} />
                  <div className="mt-4 pt-4 border-t flex items-center gap-3 ${isDark ? 'border-slate-700' : 'border-slate-100'}">
                    <button
                      type="button"
                      onClick={resetUploadPhase}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition ${isDark ? 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Change data (new upload)
                    </button>
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Data OK? Continue answering the questions below.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Founder Dependency */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Founder dependency (0-100%)
              </label>
              <input
                name="founder_dependency"
                type="number"
                min="0"
                max="100"
                step="5"
                defaultValue="0"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="0"
              />
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>0% = no dependency, 100% = fully dependent</p>
            </div>

            {/* Projection Years Toggle */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Projection horizon
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setProjectionYears(5)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 border ${
                    projectionYears === 5
                      ? 'bg-emerald-600 text-white border-transparent shadow-lg shadow-emerald-600/25'
                      : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-emerald-500/50' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  5 years
                </button>
                <button
                  type="button"
                  onClick={() => setProjectionYears(10)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 border ${
                    projectionYears === 10
                      ? 'bg-emerald-600 text-white border-transparent shadow-lg shadow-emerald-600/25'
                      : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-emerald-500/50' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  10 years
                </button>
              </div>
              <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {projectionYears === 5
                  ? 'Recommended for companies with short track records or volatile industries'
                  : 'Recommended for mature companies with predictable revenue'}
              </p>
            </div>

            {/* Qualitative Assessment — MANDATORY */}
            <div className={`mb-6 border rounded-2xl p-6 ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Qualitative Assessment</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>±15% accuracy</span>
              </div>
              <p className={`text-xs mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Answer each question to refine the valuation accuracy. The observation field is optional.
              </p>

              <div className="space-y-4">
                {QUALITATIVE_QUESTIONS.map((q, idx) => {
                  // Use perguntas customizadas (type='choice') ou padrão (Sim/Não/Partially)
                  const options = q.options || QUAL_OPTIONS;
                  const isMultiChoice = q.options && q.options.length > 3;
                  
                  return (
                  <div key={q.key} className={`pb-4 ${idx < QUALITATIVE_QUESTIONS.length - 1 ? `border-b ${isDark ? 'border-slate-700/60' : 'border-slate-200'}` : ''}`}>
                    <div className="flex items-start gap-2 mb-2.5">
                      <span className={`text-xs font-semibold uppercase tracking-wide mt-0.5 shrink-0 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>{q.dim}</span>
                      <p className={`text-sm leading-snug ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{q.q}</p>
                    </div>
                    <div className={`flex gap-2 mb-2 ${isMultiChoice ? 'flex-col' : ''}`}>
                      {options.map((opt) => {
                        const selected = qualAnswers[q.key] === opt.value;
                        const colorMap = {
                          red: selected
                            ? 'bg-red-500/90 text-white border-red-500 shadow-lg shadow-red-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-red-400 hover:text-red-400' : 'border-slate-300 text-slate-500 hover:border-red-400 hover:text-red-500',
                          yellow: selected
                            ? 'bg-amber-500/90 text-white border-amber-500 shadow-lg shadow-amber-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-amber-400 hover:text-amber-400' : 'border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-500',
                          green: selected
                            ? 'bg-emerald-500/90 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                            : isDark ? 'border-slate-600 text-slate-400 hover:border-emerald-400 hover:text-emerald-400' : 'border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-500',
                        };
                        // Para perguntas multi-choice (4+ opções), usa estilo neutro
                        const baseStyle = isMultiChoice 
                          ? selected 
                            ? 'bg-emerald-500/90 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                            : isDark ? 'bg-slate-800 border-slate-600 text-slate-300 hover:border-emerald-400' : 'bg-white border-slate-300 text-slate-600 hover:border-emerald-400'
                          : colorMap[opt.color || 'green'];
                        
                        return (
                          <button key={opt.value} type="button"
                            onClick={() => setQualAnswers(prev => ({ ...prev, [q.key]: opt.value }))}
                            className={`${isMultiChoice ? 'w-full text-left' : 'flex-1'} py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${baseStyle}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Optional observation */}
                    <div className="relative">
                      <MessageSquare className={`absolute left-3 top-2.5 w-3.5 h-3.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                      <input type="text"
                        placeholder="Observation (optional)"
                        value={qualObservations[q.key] || ''}
                        onChange={(e) => setQualObservations(prev => ({ ...prev, [q.key]: e.target.value }))}
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-lg border transition ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 placeholder-slate-600 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-600 placeholder-slate-400 focus:border-emerald-400'}`}
                      />
                    </div>
                  </div>
                )})}
              </div>

              {/* Progress indicator */}
              {(() => { const validKeys = QUALITATIVE_QUESTIONS.map(q => q.key); const answered = Object.keys(qualAnswers).filter(k => validKeys.includes(k)).length; const total = QUALITATIVE_QUESTIONS.length; return (
              <div className={`mt-4 flex items-center gap-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <span>{answered}/{total} answered</span>
                <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(answered / total) * 100}%` }} />
                </div>
              </div>
              ); })()}
            </div>

            <button
              type="submit"
              disabled={loading || uploadPhase !== 'preview' || QUALITATIVE_QUESTIONS.some(q => qualAnswers[q.key] === undefined)}
              className="mt-2 w-full bg-emerald-600 hover:brightness-110 text-white py-3 rounded-xl font-semibold transition-colors duration-200 disabled:opacity-50 shadow-lg shadow-emerald-600/25"
            >
              {(() => { const validKeys = QUALITATIVE_QUESTIONS.map(q => q.key); const answered = Object.keys(qualAnswers).filter(k => validKeys.includes(k)).length; const total = QUALITATIVE_QUESTIONS.length; return loading ? 'Processing...' : uploadPhase !== 'preview' ? 'Upload the files first above ↑' : answered < total ? `Answer all (${answered}/${total})` : `Calculate valuation (${uploadFiles.length} file${uploadFiles.length > 1 ? 's' : ''})`; })()}
            </button>
          </form>
        )}
      </main>

      {/* Processing Modal */}
      <ProcessingModal
        isOpen={processingOpen}
        steps={processingSteps}
        currentStep={processingStep}
        error={processingError}
        isDark={isDark}
        progressPercentage={progressPercentage}
        estimatedTimeRemaining={estimatedTimeRemaining}
        onRetry={() => retryFnRef.current?.()}
        onClose={() => { setProcessingOpen(false); setProcessingError(null); }}
      />
    </>
  );
}
