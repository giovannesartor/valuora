import { useEffect, useState } from 'react';
import {
  CreditCard, Key, Calendar, AlertCircle, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import formatBRL from '../lib/formatBRL';
import { useTheme } from '../context/ThemeContext';

const PIX_KEY_TYPES = [
  { value: 'cpf',    label: 'CPF'            },
  { value: 'cnpj',   label: 'CNPJ'           },
  { value: 'email',  label: 'E-mail'         },
  { value: 'phone',  label: 'Celular'        },
  { value: 'random', label: 'Chave aleatória' },
];

export default function PartnerFinanceiroPage() {
  const { isDark } = useTheme();
  const [dashboard, setDashboard]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [pixForm, setPixForm]         = useState({ pix_key_type: '', pix_key: '', payout_day: 15 });
  const [savingPix, setSavingPix]     = useState(false);

  const loadDashboard = () => {
    api.get('/partners/dashboard')
      .then(({ data }) => {
        setDashboard(data);
        if (data.partner) {
          setPixForm({
            pix_key_type: data.partner.pix_key_type || '',
            pix_key:      data.partner.pix_key      || '',
            payout_day:   data.partner.payout_day   || 15,
          });
        }
      })
      .catch(() => toast.error('Erro ao carregar dados financeiros.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDashboard(); }, []);

  const handleSavePix = async (e) => {
    e.preventDefault();
    if (!pixForm.pix_key_type || !pixForm.pix_key) {
      toast.error('Preencha o tipo e a chave PIX.');
      return;
    }
    setSavingPix(true);
    try {
      await api.put('/partners/pix-key', pixForm);
      toast.success('Chave PIX salva com sucesso!');
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar chave PIX.');
    } finally { setSavingPix(false); }
  };

  if (loading) return (
    <div className="space-y-4 p-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className={`h-32 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
      ))}
    </div>
  );

  if (!dashboard) return null;
  const { commissions, summary } = dashboard;

  const pixPlaceholder = {
    cpf: '000.000.000-00', cnpj: '00.000.000/0001-00',
    email: 'seu@email.com', phone: '+5511999999999',
  }[pixForm.pix_key_type] || 'Chave aleatória';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <CreditCard className="w-5 h-5 text-emerald-500" />
          Financeiro
        </h1>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Configure seu recebimento e acompanhe o saldo
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* PIX Key Form */}
        <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-5">
            <Key className="w-5 h-5 text-emerald-500" />
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>Chave PIX para recebimento</h3>
          </div>
          <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Cadastre sua chave PIX para receber as comissões. O pagamento é feito todo dia{' '}
            <strong className="text-emerald-500">{pixForm.payout_day || 15}</strong> do mês.
          </p>
          <form onSubmit={handleSavePix} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Tipo da chave *</label>
              <select
                value={pixForm.pix_key_type}
                onChange={e => setPixForm({ ...pixForm, pix_key_type: e.target.value })}
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
              >
                <option value="">Selecione...</option>
                {PIX_KEY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Chave PIX *</label>
              <input
                value={pixForm.pix_key}
                onChange={e => setPixForm({ ...pixForm, pix_key: e.target.value })}
                placeholder={pixPlaceholder}
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Dia do pagamento (1-28)</label>
              <input
                type="number"
                min="1"
                max="28"
                value={pixForm.payout_day}
                onChange={e => setPixForm({ ...pixForm, payout_day: parseInt(e.target.value) || 15 })}
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
              />
            </div>
            <button
              type="submit"
              disabled={savingPix}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50"
            >
              {savingPix ? 'Salvando...' : 'Salvar chave PIX'}
            </button>
          </form>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Payment Summary */}
          <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>Resumo de pagamentos</h3>
            </div>
            <div className="space-y-3">
              {[
                {
                  label: 'Comissões pendentes',
                  value: formatBRL(commissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.partner_amount || 0), 0)),
                  color: 'text-yellow-500',
                },
                {
                  label: 'Aprovadas (aguardando payout)',
                  value: formatBRL(commissions.filter(c => c.status === 'approved').reduce((s, c) => s + (c.partner_amount || 0), 0)),
                  color: 'text-blue-500',
                },
                {
                  label: 'Total já recebido',
                  value: formatBRL(commissions.filter(c => c.status === 'paid').reduce((s, c) => s + (c.partner_amount || 0), 0)),
                  color: 'text-emerald-500',
                },
              ].map((row, i, arr) => (
                <div key={row.label} className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? `border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}` : ''}`}>
                  <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{row.label}</span>
                  <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
                </div>
              ))}
              <div className={`flex items-center justify-between pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-navy-900'}`}>Total geral</span>
                <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>
                  {formatBRL(summary.total_earnings)}
                </span>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>Como funciona</h4>
            </div>
            <ul className={`text-xs space-y-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <li className="flex items-start gap-2"><span className="text-yellow-500 font-bold mt-0.5">1.</span> Quando seu cliente paga, a comissão fica <strong className="text-yellow-500">pendente</strong>.</li>
              <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">2.</span> O admin revisa e <strong className="text-blue-500">aprova</strong> a comissão.</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 font-bold mt-0.5">3.</span> No dia <strong className="text-emerald-500">{pixForm.payout_day || 15}</strong> do mês, o valor é transferido via PIX e marcado como <strong className="text-emerald-500">pago</strong>.</li>
            </ul>
          </div>

          {/* Settlement times */}
          <div className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Clock className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-navy-900'}`}>Prazo de liberação por forma de pagamento</h4>
            </div>
            <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              O prazo abaixo é o tempo que o pagamento do seu cliente leva para ser liquidado antes de entrar no ciclo de comissão.
            </p>
            <div className="space-y-2">
              {[
                { icon: '🟢', label: 'PIX',              detail: 'Liquidação instantânea', badge: 'Mesmo dia',       badgeColor: 'bg-emerald-500/10 text-emerald-400' },
                { icon: '🟡', label: 'Boleto',            detail: 'Compensação bancária',   badge: 'Até 1 dia útil',  badgeColor: 'bg-yellow-500/10 text-yellow-400'   },
                { icon: '🟣', label: 'Cartão de crédito', detail: 'Antecipação incluída',   badge: '32 dias corridos', badgeColor: 'bg-purple-500/10 text-purple-400'   },
                { icon: '🟣', label: 'Cartão de débito',  detail: 'Débito online',          badge: 'Até 1 dia útil',  badgeColor: 'bg-blue-500/10 text-blue-400'       },
              ].map(m => (
                <div key={m.label} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{m.icon}</span>
                    <div>
                      <p className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{m.label}</p>
                      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{m.detail}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${m.badgeColor}`}>{m.badge}</span>
                </div>
              ))}
            </div>
            <p className={`text-[10px] mt-4 leading-relaxed ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              💡 Após a liquidação, sua comissão entra como <strong>pendente</strong> e é transferida no dia <strong>{pixForm.payout_day || 15}</strong> do mês seguinte à aprovação.
            </p>
          </div>

          {/* No pix key warning */}
          {!pixForm.pix_key && (
            <div className={`border-2 border-dashed rounded-2xl p-5 text-center ${isDark ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-yellow-300 bg-yellow-50'}`}>
              <Key className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
              <p className={`text-sm font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Cadastre sua chave PIX ao lado para receber comissões.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
