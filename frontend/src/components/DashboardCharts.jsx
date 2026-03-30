import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts';
import { useI18n } from '../lib/i18n';

const VALUE_RANGE_COLORS = ['#059669', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#6366f1'];

export default function DashboardCharts({ isDark, sectorData, valueTimeline, formatCurrency, analyses = [] }) {
  const { t } = useI18n();

  // ─── B2: Portfolio distribution by value range ─────────
  const valueRanges = [
    { label: '<$100K', min: 0, max: 100000 },
    { label: '$100K–$500K', min: 100000, max: 500000 },
    { label: '$500K–$1M', min: 500000, max: 1000000 },
    { label: '$1M–$5M', min: 1000000, max: 5000000 },
    { label: '$5M–$20M', min: 5000000, max: 20000000 },
    { label: '>$20M', min: 20000000, max: Infinity },
  ];

  const portfolioData = valueRanges.map((r, i) => ({
    name: r.label,
    count: analyses.filter(a => {
      const v = parseFloat(a.equity_value || 0);
      return v >= r.min && v < r.max;
    }).length,
    color: VALUE_RANGE_COLORS[i],
  })).filter(d => d.count > 0);

  // Risk distribution
  const riskBuckets = [
    { label: t('chart_low_risk') || 'Low', min: 0, max: 33, color: '#059669' },
    { label: t('chart_med_risk') || 'Medium', min: 33, max: 66, color: '#f59e0b' },
    { label: t('chart_high_risk') || 'High', min: 66, max: 101, color: '#ef4444' },
  ];
  const riskData = riskBuckets.map(r => ({
    name: r.label,
    value: analyses.filter(a => (a.risk_score || 0) >= r.min && (a.risk_score || 0) < r.max).length,
    color: r.color,
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-4 mb-8">
      {/* Row 1: Sector pie + Value timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Pie chart */}
        <div className={`lg:col-span-2 rounded-2xl border p-4 md:p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('chart_sector')}</h3>
          {sectorData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={sectorData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value" stroke="none">
                    {sectorData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#fff',
                      border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 max-h-[160px] overflow-y-auto">
                {sectorData.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.name}</span>
                    <span className={`text-xs font-semibold ml-auto ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className={`text-sm text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('chart_no_data')}</p>
          )}
        </div>

        {/* Timeline chart */}
        <div className={`lg:col-span-3 rounded-2xl border p-4 md:p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('chart_trend')}</h3>
          {valueTimeline.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={valueTimeline}>
                <defs>
                  <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                <Tooltip
                  formatter={(v) => formatCurrency(v)}
                  labelFormatter={(l) => l}
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#fff',
                    border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#059669" fill="url(#valGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={`flex items-center justify-center h-[160px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
              <p className="text-sm">{t('chart_create_more')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Portfolio distribution + Risk distribution */}
      {analyses.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Portfolio by value range */}
          {portfolioData.length > 0 && (
            <div className={`rounded-2xl border p-4 md:p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('chart_portfolio') || 'Portfolio Distribution'}
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={portfolioData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#fff',
                      border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {portfolioData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Risk distribution pie */}
          {riskData.length > 0 && (
            <div className={`rounded-2xl border p-4 md:p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('chart_risk_dist') || 'Risk Distribution'}
              </h3>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie data={riskData} cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={3} dataKey="value" stroke="none">
                      {riskData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#0f172a' : '#fff',
                        border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                        borderRadius: '10px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {riskData.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.name}</span>
                      <span className={`text-xs font-semibold ml-auto ${isDark ? 'text-white' : 'text-slate-900'}`}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
