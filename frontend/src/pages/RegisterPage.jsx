import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, Users, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { ParticleNetwork } from '../components/UIComponents.jsx';
import { formatCPF_CNPJ, formatPhone, calculatePasswordStrength, getStrengthColor, getStrengthText } from '../lib/inputMasks';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  const registerUser = useAuthStore((s) => s.register);
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [referralInfo, setReferralInfo] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const { isDark } = useTheme();

  // Validate referral code
  useEffect(() => {
    if (referralCode) {
      api.get(`/partners/referral/${referralCode}`)
        .then(({ data }) => setReferralInfo(data))
        .catch(() => setReferralInfo(null));
    }
  }, [referralCode]);

  const onSubmit = async (data) => {
    if (data.password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(data.password)) {
      toast.error('A senha deve conter ao menos uma letra maiúscula.');
      return;
    }
    if (!/[0-9]/.test(data.password)) {
      toast.error('A senha deve conter ao menos um número.');
      return;
    }
    if (data.password !== data.confirm_password) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const { confirm_password, ...registerData } = data;
      await registerUser(registerData);
      toast.success('Conta criada! Verifique seu e-mail para confirmar.');
      navigate('/verificar-email');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-emerald-600 to-teal-600 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-white/10 rounded-full blur-[80px]" />
        {/* Particle network overlay */}
        <div className="absolute inset-0 opacity-10">
          <ParticleNetwork isDark={false} />
        </div>
        
        <div className="relative max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <img src="/favicon.svg?v=2" alt="QV" className="w-10 h-10" />
            <span className="text-white font-bold text-xl">Quanto Vale</span>
          </div>
          
          {/* Metrics badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs font-medium">
              <span className="w-2 h-2 bg-green-300 rounded-full" />
              +500 empresas avaliadas
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs font-medium">
              <span className="w-2 h-2 bg-green-300 rounded-full" />
              Relatório em 5 min
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs font-medium">
              <span className="w-2 h-2 bg-green-300 rounded-full" />
              Dados IBGE em tempo real
            </span>
          </div>
          
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Crie seu acesso profissional.
          </h1>
          <p className="text-emerald-100 text-lg">
            Cadastre-se e gere relatórios de valuation em minutos com dados reais.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link to="/" className={`flex items-center gap-1.5 text-sm font-medium transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src="/favicon.svg?v=2" alt="QV" className="w-8 h-8" />
            <span className={`font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>Quanto Vale</span>
          </div>

          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-navy-900'}`}>Criar conta</h2>
          <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Preencha seus dados para começar.</p>

          {referralInfo && (
            <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
              <Users className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <p className={`text-sm ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                Você foi indicado por <strong>{referralInfo.partner_name}</strong>
                {referralInfo.partner_company ? ` (${referralInfo.partner_company})` : ''}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nome completo</label>
              <input
                {...register('full_name', { required: 'Nome obrigatório' })}
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="Seu nome completo"
              />
              {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>E-mail</label>
              <input
                {...register('email', { required: 'E-mail obrigatório' })}
                type="email"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="seu@email.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>CPF ou CNPJ *</label>
              <input
                {...register('cpf_cnpj', { required: 'CPF ou CNPJ obrigatório' })}
                onChange={(e) => e.target.value = formatCPF_CNPJ(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="000.000.000-00"
              />
              {errors.cpf_cnpj && <p className="text-red-500 text-xs mt-1">{errors.cpf_cnpj.message}</p>}
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Necessário para emissão de pagamento</p>
            </div>

            {/* Optional fields - collapsible */}
            <div className={`border rounded-xl overflow-hidden transition ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setShowOptional(!showOptional)}
                className={`w-full px-4 py-3 flex items-center justify-between text-left text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
              >
                <span>Dados adicionais (opcional)</span>
                {showOptional ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {showOptional && (
                <div className={`p-4 space-y-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50/50'}`}>
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Telefone</label>
                    <input
                      {...register('phone')}
                      onChange={(e) => e.target.value = formatPhone(e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Empresa</label>
                    <input
                      {...register('company_name')}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                      placeholder="Nome da sua empresa"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Senha</label>
              <div className="relative">
                <input
                  {...register('password', { 
                    required: 'Senha obrigatória', 
                    minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                    onChange: (e) => setPasswordStrength(calculatePasswordStrength(e.target.value))
                  })}
                  type={showPassword ? 'text' : 'password'}
                  className={`w-full px-4 py-3 pr-12 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              {/* Password strength meter */}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Força: {getStrengthText(passwordStrength)}
                  </span>
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {passwordStrength}%
                  </span>
                </div>
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                  <div 
                    className={`h-full ${getStrengthColor(passwordStrength)} transition-all duration-300`}
                    style={{ width: `${passwordStrength}%` }}
                  />
                </div>
              </div>
              
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              <ul className={`text-xs mt-1.5 space-y-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <li>• Mínimo 8 caracteres</li>
                <li>• Pelo menos uma letra maiúscula</li>
                <li>• Pelo menos um número</li>
              </ul>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Confirmar Senha</label>
              <div className="relative">
                <input
                  {...register('confirm_password', { required: 'Confirmação obrigatória' })}
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`w-full px-4 py-3 pr-12 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="Repita sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 mt-2 shadow-lg shadow-emerald-600/25"
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>

            <p className={`text-center text-xs mt-4 leading-relaxed ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Ao criar sua conta, você concorda com os{' '}
              <Link to="/termos-de-uso" className="text-emerald-500 hover:underline">Termos de Uso</Link>{' '}
              e a{' '}
              <Link to="/politica-de-privacidade" className="text-emerald-500 hover:underline">Política de Privacidade</Link>.
            </p>
          </form>

          <p className={`text-center text-sm mt-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Já tem conta?{' '}
            <Link to="/login" className="text-emerald-500 font-semibold hover:text-emerald-400">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
