import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';

export default function DashboardCharts({ isDark, sectorData, valueTimeline, formatBRL }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
      {/* Pie chart */}
      <div className={`lg:col-span-2 rounded-2xl border p-4 md:p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Distribuição por Setor</h3>
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
          <p className={`text-sm text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados</p>
        )}
      </div>

      {/* Timeline chart */}
      <div className={`lg:col-span-3 rounded-2xl border p-4 md:p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Evolução de Valuations</h3>
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
                formatter={(v) => formatBRL(v)}
                labelFormatter={(l) => l}
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#fff',
                  border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              />
              <Area type="monotone" dataKey="valor" stroke="#059669" fill="url(#valGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className={`flex items-center justify-center h-[160px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <p className="text-sm">Create more analyses to view the evolution</p>
          </div>
        )}
      </div>
    </div>
  );
}
