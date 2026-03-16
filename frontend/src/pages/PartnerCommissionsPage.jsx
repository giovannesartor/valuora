import { useEffect, useState } from 'react';
import { DollarSign, Download, TrendingUp, FileText, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import formatCurrency from '../lib/formatCurrency';
import { useTheme } from '../context/ThemeContext';

const COMMISSION_STATUS = {
  pending:  { label: 'Pending',  color: 'text-yellow-500' },
  approved: { label: 'Approved',  color: 'text-blue-500'   },
  paid:     { label: 'Paid',      color: 'text-emerald-500' },
};

const PAYMENT_METHOD_INFO = {
  PIX:         { label: 'Pix',    icon: '🟢', settlement: 'Coming soon' },
  CREDIT_CARD: { label: 'Credit card', icon: '🟣', settlement: '2 business days' },
  DEBIT_CARD:  { label: 'Debit', icon: '🟣', settlement: '2 business days' },
  ACH:         { label: 'ACH', icon: '🟡', settlement: '5 business days' },
};
function methodInfo(method) {
  return PAYMENT_METHOD_INFO[(method || '').toUpperCase()] || { label: method || '—', icon: '⚪', settlement: '—' };
}

export default function PartnerCommissionsPage() {
  const { isDark } = useTheme();
  const [dashboard, setDashboard]                   = useState(null);
  const [loading, setLoading]                       = useState(true);
  const [commissionFilter, setCommissionFilter]         = useState('all');
  const [commissionDateFilter, setCommissionDateFilter] = useState('all');
  const [commissionProductFilter, setCommissionProductFilter] = useState('all');

  useEffect(() => {
    api.get('/partners/dashboard')
      .then(({ data }) => setDashboard(data))
      .catch(() => toast.error('Error loading commissions.'))
      .finally(() => setLoading(false));
  }, []);

  const handleExportCSV = () => {
    if (!dashboard?.commissions?.length) return;
    const headers = ['Company', 'Product', 'Gross', 'Stripe Fee', 'Net', 'Commission', 'Method', 'Settlement', 'Status', 'Date', 'Paid on'];
    const rows = dashboard.commissions.map(c => {
      const gross = c.gross_amount ?? c.total_amount;
      const mInfo = methodInfo(c.payment_method);
      const prodLabel = c.product_type === 'pitch_deck' ? 'Pitch Deck' : c.product_type === 'bundle' ? 'Bundle' : 'Valuation';
      return [
        c.company_name || '—',
        prodLabel,
        gross || 0,
        c.fee_amount ?? '',
        c.total_amount || 0,
        c.partner_amount || 0,
        mInfo.label,
        mInfo.settlement,
        COMMISSION_STATUS[c.status]?.label || c.status,
        new Date(c.created_at).toLocaleDateString('en-US'),
        c.paid_at ? new Date(c.paid_at).toLocaleDateString('en-US') : '',
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comissoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Commissions exported!');
  };

  if (loading) return (
    <div className="space-y-4 p-6">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`h-14 rounded-xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
      ))}
    </div>
  );

  if (!dashboard) return null;
  const { commissions, partner } = dashboard;

  const filtered = commissions
    .filter(c => commissionFilter === 'all' || c.status === commissionFilter)
    .filter(c => {
      if (commissionProductFilter === 'all') return true;
      if (commissionProductFilter === 'valuation') return !c.product_type || c.product_type === 'valuation';
      if (commissionProductFilter === 'pitch_deck') return c.product_type === 'pitch_deck';
      return true;
    })
    .filter(c => {
      if (commissionDateFilter === 'all') return true;
      const days = { '7d': 7, '30d': 30, '90d': 90 }[commissionDateFilter] || 0;
      return days ? new Date(c.created_at) >= new Date(Date.now() - days * 86400000) : true;
    });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Comissões
          </h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Track your earnings per sale
          </p>
        </div>
        {commissions.length > 0 && (
          <button
            onClick={handleExportCSV}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pending', status: 'pending',  colorClass: 'text-yellow-500',  bg: isDark ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'   },
          { label: 'Approved', status: 'approved', colorClass: 'text-blue-500',    bg: isDark ? 'bg-blue-500/10 border-blue-500/20'       : 'bg-blue-50 border-blue-200'     },
          { label: 'Pagas',     status: 'paid',     colorClass: 'text-emerald-500', bg: isDark ? 'bg-emerald-500/10 border-emerald-500/20'  : 'bg-emerald-50 border-emerald-200' },
        ].map(item => {
          const subset = commissions.filter(c => c.status === item.status);
          return (
            <div key={item.status} className={`border rounded-xl p-4 ${item.bg}`}>
              <p className={`text-xs font-medium uppercase mb-1 ${item.colorClass}`}>{item.label} ({subset.length})</p>
              <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>
                {formatCurrency(subset.reduce((s, c) => s + (c.partner_amount || 0), 0))}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Status */}
        {['all', 'pending', 'approved', 'paid'].map(f => (
          <button
            key={f}
            onClick={() => setCommissionFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              commissionFilter === f
                ? 'bg-emerald-500/20 text-emerald-500'
                : isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {{ all: 'All', pending: 'Pending', approved: 'Approved', paid: 'Paid' }[f]}
          </button>
        ))}
        {/* Product */}
        <span className={`w-px h-5 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
        {[['all','All'],['valuation','Valuation'],['pitch_deck','Pitch Deck']].map(([v,label]) => (
          <button
            key={v}
            onClick={() => setCommissionProductFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
              commissionProductFilter === v
                ? 'bg-indigo-500/20 text-indigo-400'
                : isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {v === 'pitch_deck' && <FileText className="w-3 h-3" />}
            {v === 'valuation' && <Package className="w-3 h-3" />}
            {label}
          </button>
        ))}
        <select
          value={commissionDateFilter}
          onChange={e => setCommissionDateFilter(e.target.value)}
          className={`ml-auto px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer transition border ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
        >
          <option value="all">Any date</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* Fee explanation */}
      <div className={`rounded-xl border px-4 py-3 mb-4 text-xs flex flex-wrap gap-x-6 gap-y-1.5 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
        <span className="font-semibold text-slate-500 dark:text-slate-300">Current processing fees:</span>
        <span>🟢 <strong>Stripe</strong> — Secure payment processing</span>
        <span>🟡 <strong>Invoice</strong> — Net 30 terms available</span>
        <span>🟣 <strong>Credit Card</strong> — 2.9% + $0.30 per transaction</span>
        <span>🟣 <strong>Installments</strong> — Available via Stripe</span>
        <span>Your commission is calculated on the <strong>net value</strong> (after fees).</span>
      </div>

      {/* Table */}
      <div className={`border rounded-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        {commissions.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
            <p className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No commissions yet.</p>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>When your clients pay, your commissions will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isDark ? 'bg-slate-800/50' : 'bg-slate-50'}>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Company</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Product</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Gross</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Fee</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Net</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{`Commission (${((partner.commission_rate || 0.5) * 100).toFixed(0)}%)`}</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Method / Settlement</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Date</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Paid on</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const status = COMMISSION_STATUS[c.status] || { label: c.status, color: 'text-slate-400' };
                  const gross = c.gross_amount ?? c.total_amount;
                  const net = c.total_amount;
                  const fee = c.fee_amount;
                  const mInfo = methodInfo(c.payment_method);
                  return (
                    <tr key={c.id} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <td className={`px-4 py-4 text-xs max-w-[140px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <div className="relative group inline-block max-w-full">
                          <span className="block truncate cursor-default">
                            {c.company_name || <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                          </span>
                          {c.company_name && (
                            <div className={`absolute bottom-full left-0 mb-1.5 z-10 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${
                              isDark ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white'
                            }`}>
                              {c.company_name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {c.product_type === 'pitch_deck' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400">
                            <FileText className="w-2.5 h-2.5" /> Pitch Deck
                          </span>
                        ) : c.product_type === 'bundle' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">
                            <Package className="w-2.5 h-2.5" /> Bundle
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                            <TrendingUp className="w-2.5 h-2.5" /> Valuation
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-4 font-medium text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatCurrency(gross)}</td>
                      <td className="px-4 py-4">
                        {fee != null ? (
                          <span className="text-xs text-red-400 font-medium">- {formatCurrency(fee)}</span>
                        ) : (
                          <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>—</span>
                        )}
                      </td>
                      <td className={`px-4 py-4 font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>{formatCurrency(net)}</td>
                      <td className="px-4 py-4 text-emerald-500 font-semibold text-xs">{formatCurrency(c.partner_amount)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {mInfo.icon} {mInfo.label}{c.installment_count > 1 ? ` ${c.installment_count}x` : ''}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{mInfo.settlement}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-4 font-medium text-xs ${status.color}`}>{status.label}</td>
                      <td className={`px-4 py-4 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {new Date(c.created_at).toLocaleDateString('en-US')}
                      </td>
                      <td className={`px-4 py-4 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {c.paid_at ? new Date(c.paid_at).toLocaleDateString('en-US') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
