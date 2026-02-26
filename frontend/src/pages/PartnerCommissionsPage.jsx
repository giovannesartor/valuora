import { useEffect, useState } from 'react';
import { DollarSign, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import formatBRL from '../lib/formatBRL';
import { useTheme } from '../context/ThemeContext';

const COMMISSION_STATUS = {
  pending:  { label: 'Pendente',  color: 'text-yellow-500' },
  approved: { label: 'Aprovada',  color: 'text-blue-500'   },
  paid:     { label: 'Paga',      color: 'text-emerald-500' },
};

const PAYMENT_METHOD_INFO = {
  PIX:         { label: 'Pix',    icon: '🟢', settlement: 'Instantâneo' },
  BOLETO:      { label: 'Boleto', icon: '🟡', settlement: '1 dia útil' },
  CREDIT_CARD: { label: 'Cartão', icon: '🟣', settlement: '32 dias'    },
  DEBIT_CARD:  { label: 'Débito', icon: '🟣', settlement: '1 dia útil' },
};
function methodInfo(method) {
  return PAYMENT_METHOD_INFO[(method || '').toUpperCase()] || { label: method || '—', icon: '⚪', settlement: '—' };
}

export default function PartnerCommissionsPage() {
  const { isDark } = useTheme();
  const [dashboard, setDashboard]                   = useState(null);
  const [loading, setLoading]                       = useState(true);
  const [commissionFilter, setCommissionFilter]     = useState('all');
  const [commissionDateFilter, setCommissionDateFilter] = useState('all');

  useEffect(() => {
    api.get('/partners/dashboard')
      .then(({ data }) => setDashboard(data))
      .catch(() => toast.error('Erro ao carregar comissões.'))
      .finally(() => setLoading(false));
  }, []);

  const handleExportCSV = () => {
    if (!dashboard?.commissions?.length) return;
    const headers = ['Empresa', 'Bruto', 'Taxa Asaas', 'Líquido', 'Comissão', 'Método', 'Prazo Recebimento', 'Status', 'Data', 'Pago em'];
    const rows = dashboard.commissions.map(c => {
      const gross = c.gross_amount ?? c.total_amount;
      const mInfo = methodInfo(c.payment_method);
      return [
        c.company_name || '—',
        gross || 0,
        c.fee_amount ?? '',
        c.total_amount || 0,
        c.partner_amount || 0,
        mInfo.label,
        mInfo.settlement,
        COMMISSION_STATUS[c.status]?.label || c.status,
        new Date(c.created_at).toLocaleDateString('pt-BR'),
        c.paid_at ? new Date(c.paid_at).toLocaleDateString('pt-BR') : '',
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
    toast.success('Comissões exportadas!');
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
            Acompanhe seus ganhos por venda
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
          { label: 'Pendentes', status: 'pending',  colorClass: 'text-yellow-500',  bg: isDark ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'   },
          { label: 'Aprovadas', status: 'approved', colorClass: 'text-blue-500',    bg: isDark ? 'bg-blue-500/10 border-blue-500/20'       : 'bg-blue-50 border-blue-200'     },
          { label: 'Pagas',     status: 'paid',     colorClass: 'text-emerald-500', bg: isDark ? 'bg-emerald-500/10 border-emerald-500/20'  : 'bg-emerald-50 border-emerald-200' },
        ].map(item => {
          const subset = commissions.filter(c => c.status === item.status);
          return (
            <div key={item.status} className={`border rounded-xl p-4 ${item.bg}`}>
              <p className={`text-xs font-medium uppercase mb-1 ${item.colorClass}`}>{item.label} ({subset.length})</p>
              <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>
                {formatBRL(subset.reduce((s, c) => s + (c.partner_amount || 0), 0))}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
            {{ all: 'Todas', pending: 'Pendentes', approved: 'Aprovadas', paid: 'Pagas' }[f]}
          </button>
        ))}
        <select
          value={commissionDateFilter}
          onChange={e => setCommissionDateFilter(e.target.value)}
          className={`ml-auto px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer transition border ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
        >
          <option value="all">Qualquer data</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
        </select>
      </div>

      {/* Fee explanation */}
      <div className={`rounded-xl border px-4 py-3 mb-4 text-xs flex flex-wrap gap-x-6 gap-y-1.5 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
        <span className="font-semibold text-slate-500 dark:text-slate-300">Taxas Asaas vigentes:</span>
        <span>🟢 <strong>Pix</strong> — R$ 1,99/recebimento · instantâneo</span>
        <span>🟡 <strong>Boleto</strong> — R$ 1,99/baixa · 1 dia útil</span>
        <span>🟣 <strong>Cartão</strong> à vista — 2,99% + R$0,49 · 32 dias</span>
        <span>🟣 <strong>Cartão</strong> 2–6x — 3,49% + R$0,49</span>
        <span>Sua comissão é calculada sobre o <strong>valor líquido</strong> (após a taxa).</span>
      </div>

      {/* Table */}
      <div className={`border rounded-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        {commissions.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
            <p className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma comissão ainda.</p>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Quando seus clientes pagarem, suas comissões aparecerão aqui.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isDark ? 'bg-slate-800/50' : 'bg-slate-50'}>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Empresa</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Bruto</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Taxa Asaas</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Líquido</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{`Comissão (${((partner.commission_rate || 0.5) * 100).toFixed(0)}%)`}</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Método / Prazo</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Data</th>
                  <th className={`text-left px-4 py-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pago em</th>
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
                      <td className={`px-4 py-4 text-xs max-w-[140px] truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`} title={c.company_name || ''}>
                        {c.company_name || <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                      </td>
                      <td className={`px-4 py-4 font-medium text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatBRL(gross)}</td>
                      <td className="px-4 py-4">
                        {fee != null ? (
                          <span className="text-xs text-red-400 font-medium">- {formatBRL(fee)}</span>
                        ) : (
                          <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>—</span>
                        )}
                      </td>
                      <td className={`px-4 py-4 font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>{formatBRL(net)}</td>
                      <td className="px-4 py-4 text-emerald-500 font-semibold text-xs">{formatBRL(c.partner_amount)}</td>
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
                        {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className={`px-4 py-4 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {c.paid_at ? new Date(c.paid_at).toLocaleDateString('pt-BR') : '—'}
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
