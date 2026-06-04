import { useState, useRef } from 'react';
import { Plus, Trash2, Info, ChevronDown, ChevronUp } from 'lucide-react';

const ASSET_TYPES = [
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'cash', label: 'Cash / Capital Contribution' },
  { value: 'equipment', label: 'Equipment / Machinery' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'receivable', label: 'Receivable' },
  { value: 'equity_stake', label: 'Equity Stake' },
  { value: 'intangible', label: 'Intangible (brand, IP)' },
  { value: 'other', label: 'Other' },
];

const CONFIDENCE_OPTIONS = [
  { value: 'high',   label: 'High (90–100%) — signed contract, deed, received', weight: '×1.00' },
  { value: 'medium', label: 'Medium (60–80%) — advanced negotiation / due diligence', weight: '×0.70' },
  { value: 'low',    label: 'Low (≤50%) — prospecting / letter of intent',         weight: '×0.40' },
];

const MODE_OPTIONS = [
  { value: 'add_to_equity',  label: 'Add to Equity (recommended)',       desc: 'Adds the weighted value to the final valuation.' },
  { value: 'add_to_assets',  label: 'Register as asset only',            desc: 'Shows in report without affecting valuation.' },
  { value: 'informational',  label: 'Informational only',                desc: 'Appears as a footnote.' },
];

const emptyItem = () => ({
  label: '',
  asset_type: 'real_estate',
  value: '',
  confidence: 'high',
  mode: 'add_to_equity',
  expected_date: '',
  notes: '',
});

/* ── Currency helpers ── */
const fmtUSD = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    .format(Number(n || 0));

const formatCurrencyDisplay = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
};

const parseCurrencyValue = (formatted) => {
  return String(formatted || '').replace(/\D/g, '');
};

function CurrencyField({ value, onChange, isDark }) {
  const inputRef = useRef(null);
  const displayed = formatCurrencyDisplay(value);

  const handleChange = (e) => {
    const raw = parseCurrencyValue(e.target.value);
    onChange(raw);
  };

  const inputClass = isDark
    ? 'mt-1 w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition'
    : 'mt-1 w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 outline-none transition';

  return (
    <div className="relative">
      {displayed && (
        <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs mt-0.5 pointer-events-none select-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>$</span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayed}
        onChange={handleChange}
        placeholder="0"
        className={`${inputClass} ${displayed ? 'pl-5' : ''}`}
      />
    </div>
  );
}

export default function PendingAssetsEditor({ value = [], onChange, defaultOpen = false, isDark = false }) {
  const [open, setOpen] = useState(defaultOpen || (value && value.length > 0));
  const items = Array.isArray(value) ? value : [];

  const update = (idx, patch) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange?.(next);
  };
  const add    = () => onChange?.([...items, emptyItem()]);
  const remove = (idx) => onChange?.(items.filter((_, i) => i !== idx));

  const totalRaw = items.reduce((s, it) => s + (Number(it.value) || 0), 0);
  const totalWeighted = items.reduce((s, it) => {
    if (it.mode !== 'add_to_equity') return s;
    const w = it.confidence === 'high' ? 1.0 : it.confidence === 'low' ? 0.4 : 0.7;
    return s + (Number(it.value) || 0) * w;
  }, 0);

  const wrapClass  = isDark
    ? 'rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03]'
    : 'rounded-xl border border-emerald-300/60 bg-emerald-50/60';

  const inputClass = isDark
    ? 'mt-1 w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition'
    : 'mt-1 w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 outline-none transition';

  const selectClass = isDark
    ? 'mt-1 w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-500 transition'
    : 'mt-1 w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-500 transition';

  const labelClass = isDark ? 'text-[11px] text-slate-400' : 'text-[11px] text-slate-500';

  const itemClass  = isDark
    ? 'rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-2.5'
    : 'rounded-lg border border-slate-200 bg-white p-3 space-y-2.5';

  const optBg = isDark ? 'bg-slate-900' : 'bg-white';

  return (
    <div className={wrapClass}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className={`flex items-center gap-2 text-sm font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
            Pending assets / to be contributed
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
              Optional
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Real estate entering capital, raised rounds, M&amp;A in progress, assets
            still off the balance sheet — weighted by confidence.
          </p>
        </div>
        {open
          ? <ChevronUp  className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          : <ChevronDown className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />}
      </button>

      {open && (
        <div className={`px-4 pb-4 space-y-3 border-t ${isDark ? 'border-emerald-500/10' : 'border-emerald-200/60'}`}>
          {items.length === 0 && (
            <div className={`flex items-start gap-2 pt-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Example: a $15M property to be contributed in 30 days with High confidence
                → adds $15M to equity. With Medium confidence → adds $10.5M (×0.70).
              </span>
            </div>
          )}

          {items.map((it, idx) => (
            <div key={idx} className={itemClass}>
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={it.label}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  placeholder="Ex: HQ building on Main St"
                  className={`flex-1 ${inputClass.replace('mt-1 ', '')}`}
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10"
                  aria-label="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className={labelClass}>
                  Type
                  <select
                    value={it.asset_type}
                    onChange={(e) => update(idx, { asset_type: e.target.value })}
                    className={selectClass}
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t.value} value={t.value} className={optBg}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Estimated value ($)
                  <CurrencyField
                    value={it.value}
                    onChange={(raw) => update(idx, { value: raw })}
                    isDark={isDark}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className={labelClass}>
                  Confidence level
                  <select
                    value={it.confidence}
                    onChange={(e) => update(idx, { confidence: e.target.value })}
                    className={selectClass}
                  >
                    {CONFIDENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className={optBg}>
                        {o.label} {o.weight}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Valuation treatment
                  <select
                    value={it.mode}
                    onChange={(e) => update(idx, { mode: e.target.value })}
                    className={selectClass}
                  >
                    {MODE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className={optBg}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className={labelClass}>
                  Expected date (optional)
                  <input
                    type="date"
                    value={it.expected_date || ''}
                    onChange={(e) => update(idx, { expected_date: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Notes (optional)
                  <input
                    type="text"
                    value={it.notes || ''}
                    onChange={(e) => update(idx, { notes: e.target.value })}
                    placeholder="Ex: contract signed on 03/10"
                    maxLength={500}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={add}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed text-sm transition ${
              isDark
                ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                : 'border-emerald-400/60 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <Plus className="w-4 h-4" /> Add pending asset
          </button>

          {items.length > 0 && (
            <div className={`flex items-center justify-between text-xs pt-2 border-t ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
              <span>
                Gross: <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fmtUSD(totalRaw)}</span>
              </span>
              <span className={`font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                To add to equity: {fmtUSD(totalWeighted)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
