import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import WhatsAppButton from '../components/WhatsAppButton';
import {
  Users, DollarSign, BarChart3, Copy, Check,
  Briefcase, Percent, Clock,
  MessageCircle, Mail, Trophy, Target,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import api from '../lib/api';
import formatBRL from '../lib/formatBRL';
import { useTheme } from '../context/ThemeContext';

export default function PartnerDashboardPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/partners/dashboard')
      .then(({ data }) => setDashboard(data))
      .catch(() => {
        toast.error('Você não é um parceiro registrado.');
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, []);

  const earningsTimeline = useMemo(() => {
    if (!dashboard?.commissions?.length) return [];
    const byMonth = {};
    dashboard.commissions.forEach(c => {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { month: key, total: 0, count: 0 };
      byMonth[key].total += c.partner_amount || 0;
      byMonth[key].count += 1;
    });
    return Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        label: new Date(m.month + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      }));
  }, [dashboard]);

  const statusDistribution = useMemo(() => {
    if (!dashboard?.clients?.length) return [];
    const counts = {};
    dashboard.clients.forEach(c => {
      const s = c.data_status || 'pre_filled';
      counts[s] = (counts[s] || 0) + 1;
    });
    const COLORS = { pre_filled: '#eab308', completed: '#3b82f6', report_sent: '#10b981' };
    const LABELS = { pre_filled: 'Pré-preenchido', completed: 'Concluído', report_sent: 'Relatório enviado' };
    return Object.entries(counts).map(([key, value]) => ({
      name: LABELS[key] || key, value, color: COLORS[key] || '#94a3b8',
    }));
  }, [dashboard]);

  const handleCopyLink = () => {
    if (dashboard?.partner?.referral_link) {
      navigator.clipboard.writeText(dashboard.partner.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareWhatsApp = () => {
    const link = dashboard?.partner?.referral_link;
    if (!link) return;
    const text = `Descubra quanto vale a sua empresa com o QuantoVale! Use meu link: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareEmail = () => {
    const link = dashboard?.partner?.referral_link;
    if (!link) return;
    const subject = 'Descubra o valor da sua empresa';
    const body = `Olá!\n\nGostaria de indicar a plataforma QuantoVale para você.\nDescubra quanto vale a sua empresa usando meu link:\n\n${link}\n\nAbraços!`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className={`rounded-2xl border p-6 animate-pulse ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`h-4 w-48 rounded mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
        <div className={`h-10 w-full rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`rounded-2xl border p-5 animate-pulse ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`h-10 w-10 rounded-xl mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className={`h-7 w-16 rounded mb-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className={`h-4 w-24 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          </div>
        ))}
      </div>
    </div>
  );

  if (!dashboard) return null;
  const { partner, summary } = dashboard;

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Briefcase className="w-5 h-5 text-emerald-500" />
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Visão Geral</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Bem-vindo de volta, parceiro!
            </p>
          </div>
          <span className="ml-2 bg-emerald-500/10 text-emerald-500 text-xs font-bold px-2.5 py-1 rounded-full">Parceiro</span>
        </div>

        {/* Referral Link Banner */}
        <div className={`rounded-2xl p-6 mb-8 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-navy-900'}`}>Seu link de indicação</h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Compartilhe com seus clientes. Cada venda gera{' '}
                <span className="text-emerald-500 font-semibold">{(partner.commission_rate * 100).toFixed(0)}% de comissão</span>.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className={`px-4 py-2.5 rounded-xl text-sm font-mono ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-emerald-600'}`}>
                {partner.referral_link}
              </code>
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  copied ? 'bg-emerald-500/20 text-emerald-500' : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="px-3 py-2.5 rounded-xl text-sm font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20 transition"
                title="Compartilhar via WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              <button
                onClick={handleShareEmail}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                title="Compartilhar via E-mail"
              >
                <Mail className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users,      label: 'Clientes',      value: summary.total_clients,             color: 'text-blue-500'    },
            { icon: BarChart3,  label: 'Vendas',        value: summary.total_sales,               color: 'text-emerald-500' },
            { icon: DollarSign, label: 'Ganhos totais', value: formatBRL(summary.total_earnings), color: 'text-green-500'   },
            { icon: Percent,    label: 'Conversão',     value: `${summary.conversion_rate}%`,     color: 'text-teal-500'    },
          ].map((kpi, i) => (
            <div key={i} className={`border rounded-2xl p-5 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <kpi.icon className={`w-5 h-5 mb-3 ${kpi.color}`} />
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>{kpi.value}</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Gamification progress */}
        {(() => {
          const goals = [
            { label: 'Primeiro cliente',       target: 1,    current: summary.total_clients,  icon: Users     },
            { label: '5 vendas',               target: 5,    current: summary.total_sales,    icon: BarChart3 },
            { label: '10 vendas',              target: 10,   current: summary.total_sales,    icon: Trophy    },
            { label: 'R$ 5.000 em comissões',  target: 5000, current: summary.total_earnings, icon: Target    },
          ];
          const nextGoal = goals.find(g => g.current < g.target);
          if (!nextGoal) return null;
          const pct = Math.min(100, Math.round((nextGoal.current / nextGoal.target) * 100));
          return (
            <div className={`rounded-2xl border p-5 mb-8 ${isDark ? 'bg-gradient-to-r from-purple-500/5 to-violet-500/5 border-purple-500/20' : 'bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <nextGoal.icon className="w-4 h-4 text-purple-500" />
                  <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Próxima meta: {nextGoal.label}</span>
                </div>
                <span className={`text-xs font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{pct}%</span>
              </div>
              <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-purple-100'}`}>
                <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {typeof nextGoal.current === 'number' && nextGoal.target <= 100
                  ? `${nextGoal.current}/${nextGoal.target}`
                  : `${formatBRL(nextGoal.current)} / ${formatBRL(nextGoal.target)}`}
              </p>
            </div>
          );
        })()}

        {/* Pending commissions alert */}
        {summary.pending_commissions > 0 && (
          <div className={`rounded-2xl p-5 mb-8 border-2 ${isDark ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-yellow-300 bg-yellow-50'}`}>
            <div className="flex items-center gap-3">
              <Clock className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
              <p className={`text-sm font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Você tem <strong>{formatBRL(summary.pending_commissions)}</strong> em comissões pendentes de pagamento.
              </p>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Earnings timeline */}
          <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Ganhos por mês</h3>
            {earningsTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={earningsTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={v => formatBRL(v)}
                    contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 12 }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className={`flex items-center justify-center h-[200px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                <p className="text-sm">Dados insuficientes para gráfico</p>
              </div>
            )}
          </div>

          {/* Status distribution */}
          <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-navy-900'}`}>Distribuição de status</h3>
            {statusDistribution.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                      {statusDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusDistribution.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{s.name}: {s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`flex items-center justify-center h-[200px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                <p className="text-sm">Nenhum cliente ainda</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <WhatsAppButton />
    </>
  );
}
