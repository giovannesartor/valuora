import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, Shield, Target, BarChart3, Sparkles,
  Lock, Eye, ArrowDown, ChevronDown, ChevronUp, Building2,
} from 'lucide-react';
import api from '../lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

export default function InteractiveReportPage() {
  const { token } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [expanded, setExpanded] = useState({});

  const isDark = true; // Always dark for public reports

  useEffect(() => {
    loadAnalysis();
  }, [token]);

  const loadAnalysis = async (pwd) => {
    setLoading(true);
    setError('');
    try {
      const params = pwd ? { password: pwd } : {};
      const { data } = await api.get(`/analyses/public/${token}`, { params });
      setAnalysis(data);
      setNeedsPassword(false);
    } catch (err) {
      if (err.response?.status === 401) {
        setNeedsPassword(true);
      } else {
        setError(err.response?.data?.detail || 'Report not found or expired.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fmtUSD = (v) => {
    if (!v && v !== 0) return '$0';
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${Number(v).toFixed(0)}`;
  };

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <Lock className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Password Protected</h2>
          <p className="text-sm text-slate-400 mb-6">This report requires a password to view.</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 mb-4"
            onKeyDown={e => e.key === 'Enter' && loadAnalysis(password)}
          />
          <button
            onClick={() => loadAnalysis(password)}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:brightness-110 transition"
          >
            View Report
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Eye className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Report Unavailable</h2>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const r = analysis.valuation_result || {};
  const financialHealth = r.financial_health || null;
  const sectorBenchmark = r.sector_benchmark || null;
  const insights = r.valuation_insights || [];
  const monteCarlo = r.monte_carlo || {};
  const fcf = r.fcf_projections || [];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-600/10 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-12 pb-8 relative">
          <div className="flex items-center gap-3 mb-2 text-emerald-400 text-sm font-medium">
            <Building2 className="w-4 h-4" />
            <span>{analysis.sector?.charAt(0).toUpperCase() + analysis.sector?.slice(1).replace(/_/g, ' ')}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{analysis.company_name}</h1>
          <p className="text-slate-400 text-sm">
            Report generated {analysis.created_at ? new Date(analysis.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
          </p>

          {/* Hero value */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 flex flex-wrap items-end gap-6"
          >
            <div>
              <p className="text-xs uppercase font-semibold text-slate-500 mb-1">Estimated Equity Value</p>
              <p className="text-4xl md:text-5xl font-bold text-emerald-400 tabular-nums">
                {fmtUSD(analysis.equity_value)}
              </p>
            </div>
            <div className="flex gap-6 mb-1">
              {analysis.risk_score != null && (
                <div>
                  <p className="text-[10px] uppercase text-slate-500">Risk Score</p>
                  <p className="text-lg font-bold">{analysis.risk_score.toFixed(0)}/100</p>
                </div>
              )}
              {analysis.percentile != null && (
                <div>
                  <p className="text-[10px] uppercase text-slate-500">Percentile</p>
                  <p className="text-lg font-bold">P{analysis.percentile.toFixed(0)}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 pb-16 space-y-6">
        {/* Financial Health */}
        {financialHealth && (
          <CollapsibleSection
            title="Financial Health"
            icon={<Shield className="w-4 h-4 text-emerald-500" />}
            expanded={expanded.health}
            onToggle={() => toggle('health')}
            defaultOpen
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(financialHealth.dimensions || []).map(dim => (
                <div key={dim.key} className="rounded-xl bg-slate-800/50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${dim.status === 'green' ? 'bg-emerald-500' : dim.status === 'yellow' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <span className="text-[10px] uppercase font-semibold text-slate-500">{dim.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-700">
                      <div className={`h-1.5 rounded-full ${dim.status === 'green' ? 'bg-emerald-500' : dim.status === 'yellow' ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${dim.score}%` }} />
                    </div>
                    <span className="text-xs font-bold text-white">{dim.score}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">{dim.detail}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* FCF Projections */}
        {fcf.length > 0 && (
          <CollapsibleSection
            title="Cash Flow Projections"
            icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
            expanded={expanded.fcf}
            onToggle={() => toggle('fcf')}
            defaultOpen
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={fcf}>
                <defs>
                  <linearGradient id="fcfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmtUSD} />
                <Tooltip
                  formatter={fmtUSD}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="fcfe" stroke="#059669" fill="url(#fcfGrad)" strokeWidth={2} name="FCFE" />
              </AreaChart>
            </ResponsiveContainer>
          </CollapsibleSection>
        )}

        {/* AI Insights */}
        {insights.length > 0 && (
          <CollapsibleSection
            title="AI Insights"
            icon={<Sparkles className="w-4 h-4 text-emerald-500" />}
            expanded={expanded.insights}
            onToggle={() => toggle('insights')}
            defaultOpen
          >
            <div className="space-y-3">
              {insights.map((ins, i) => {
                const c = ins.severity === 'positive' ? 'emerald' : ins.severity === 'warning' ? 'amber' : 'blue';
                return (
                  <div key={i} className={`flex items-start gap-3 rounded-xl border border-${c}-500/20 bg-${c}-500/5 p-4`}>
                    <Sparkles className={`w-4 h-4 text-${c}-500 mt-0.5 flex-shrink-0`} />
                    <div>
                      <span className={`text-[10px] uppercase font-semibold text-${c}-500`}>{ins.category}</span>
                      <p className="text-xs text-slate-300 leading-relaxed mt-0.5">{ins.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Sector Benchmark */}
        {sectorBenchmark && (
          <CollapsibleSection
            title="Sector Benchmarking"
            icon={<Target className="w-4 h-4 text-emerald-500" />}
            expanded={expanded.benchmark}
            onToggle={() => toggle('benchmark')}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(sectorBenchmark.metrics || {}).map(([key, m]) => (
                <div key={key} className="rounded-xl bg-slate-800/50 p-3">
                  <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">{key.replace(/_/g, ' ')}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    m.position === 'above' ? 'bg-emerald-500/10 text-emerald-500' :
                    m.position === 'below' ? 'bg-red-500/10 text-red-500' :
                    'bg-slate-500/10 text-slate-500'
                  }`}>
                    {m.diff_pct > 0 ? '+' : ''}{m.diff_pct}%
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Monte Carlo */}
        {monteCarlo.mean && (
          <CollapsibleSection
            title="Monte Carlo Simulation"
            icon={<BarChart3 className="w-4 h-4 text-emerald-500" />}
            expanded={expanded.mc}
            onToggle={() => toggle('mc')}
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'P5 (Conservative)', val: monteCarlo.p5 },
                { label: 'P25', val: monteCarlo.p25 },
                { label: 'Mean', val: monteCarlo.mean },
                { label: 'P75', val: monteCarlo.p75 },
                { label: 'P95 (Optimistic)', val: monteCarlo.p95 },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-xl bg-slate-800/50 p-3 text-center">
                  <p className="text-[10px] uppercase text-slate-500 mb-1">{label}</p>
                  <p className="text-sm font-bold text-white">{fmtUSD(val)}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Footer */}
        <div className="text-center pt-8 border-t border-slate-800">
          <p className="text-xs text-slate-600">
            Generated by <span className="text-emerald-500 font-semibold">Valuora</span> — Global Business Valuation Platform
          </p>
          <p className="text-[10px] text-slate-700 mt-1">
            Engine v{r.engine_version} • {r.parameters?.data_source}
          </p>
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, icon, expanded, onToggle, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(expanded ?? defaultOpen);

  useEffect(() => {
    if (expanded !== undefined) setIsOpen(expanded);
  }, [expanded]);

  const handleToggle = () => {
    setIsOpen(prev => !prev);
    onToggle?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden"
    >
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-800/50 transition"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-5 pb-5"
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}
