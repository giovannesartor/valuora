import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, CheckCircle, Users, DollarSign,
  TrendingUp, Send, Building2, Phone, Mail, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function PartnerRegisterPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [form, setForm] = useState({ company_name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [partnerData, setPartnerData] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.get('/partners/me')
      .then(() => navigate('/parceiro/dashboard', { replace: true }))
      .catch(() => setChecking(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim()) {
      toast.error('Nome do escritório é obrigatório.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/partners/register', form);
      setPartnerData(data);
      setSuccess(true);
      toast.success('Cadastro de parceiro realizado!');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === 'Usuário já é um parceiro') {
        toast('Você já é parceiro! Redirecionando...', { icon: 'ℹ️' });
        navigate('/parceiro/dashboard');
      } else {
        toast.error(detail || 'Erro ao cadastrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { icon: DollarSign, title: '60% de comissão', description: 'Ganhe 60% do valor de cada venda gerada pela sua indicação.' },
    { icon: Users, title: 'Gestão de clientes', description: 'Acompanhe o status de cada cliente e valuation em tempo real.' },
    { icon: TrendingUp, title: 'Renda recorrente', description: 'Cada novo cliente é uma nova comissão. Sem limites.' },
    { icon: Building2, title: 'Seu escritório cresce', description: 'Ofereça valuation profissional como serviço ao seu portfólio.' },
  ];

  if (checking) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Carregando...</div>;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className={`transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-navy-900'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-500" />
              <h1 className={`font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>Modo Parceiro</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {success && partnerData ? (
          /* Success State */
          <div className="text-center max-w-lg mx-auto">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-navy-900'}`}>Bem-vindo ao programa!</h2>
            <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Você é agora um parceiro. Seu código de referência é:
            </p>
            <div className={`inline-block px-6 py-3 rounded-xl text-lg font-mono font-bold mb-8 ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              {partnerData.referral_code}
            </div>

            <div className={`rounded-2xl p-6 border text-left mb-8 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-navy-900'}`}>Seu link de indicação:</h3>
              <code className={`block px-4 py-3 rounded-xl text-sm font-mono break-all ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-emerald-600'}`}>
                {partnerData.referral_link}
              </code>
            </div>

            <button
              onClick={() => navigate('/parceiro/dashboard')}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition"
            >
              Ir para o Painel do Parceiro
            </button>
          </div>
        ) : (
          /* Form State */
          <div className="grid md:grid-cols-2 gap-12">
            {/* Left: Benefits */}
            <div>
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-navy-900'}`}>Seja um parceiro</h2>
              <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Ideal para contabilidades e consultorias que querem oferecer valuation como serviço adicional.
              </p>

              <div className="space-y-6">
                {benefits.map((b, i) => (
                  <div key={i} className="flex gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                      <b.icon className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-navy-900'}`}>{b.title}</h4>
                      <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Form */}
            <div>
              <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-navy-900'}`}>Cadastro de Parceiro</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className={`flex items-center gap-2 text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <Building2 className="w-4 h-4" />
                      Nome do escritório / empresa *
                    </label>
                    <input
                      value={form.company_name}
                      onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                      placeholder="Ex: Contabilidade Silva & Associados"
                      required
                    />
                  </div>
                  <div>
                    <label className={`flex items-center gap-2 text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <Phone className="w-4 h-4" />
                      Telefone (opcional)
                    </label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div className={`p-4 rounded-xl text-sm ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                    O e-mail e nome vinculados serão os da sua conta atual.
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Cadastrando...' : (
                      <>
                        <Send className="w-4 h-4" />
                        Tornar-me parceiro
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
