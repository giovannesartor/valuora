import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft, Briefcase, CheckCircle, Users, DollarSign,
  TrendingUp, Building2, Eye, EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { formatCPF_CNPJ as formatTaxID, formatPhone, calculatePasswordStrength, getStrengthColor, getStrengthText } from '../lib/inputMasks';

export default function PartnerRegisterPage() {
  const { isDark } = useTheme();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const onSubmit = async (data) => {
    if (data.password !== data.confirm_password) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/partners/register', {
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        company_name: data.company_name,
        phone: data.phone || null,
        cpf_cnpj: data.cpf_cnpj || null,
      });
      const match = res.data.message?.match(/QV-[A-Z0-9]+/);
      setReferralCode(match ? match[0] : '');
      setSuccess(true);
      toast.success('Partner account created!');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === 'Email already registered.') {
        toast.error('This email is already registered. Log in as a partner.');
      } else {
        toast.error(detail || 'Registration error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { icon: DollarSign, title: '50% commission', description: 'We split 50/50 on each valuation and pitch deck sold. Simple as that.' },
    { icon: Users, title: 'Client management', description: 'Track the status of each client, valuation, and pitch deck in real time.' },
    { icon: TrendingUp, title: 'Recurring income', description: 'Every new product sold generates a new commission. No limits.' },
    { icon: Building2, title: 'Your firm grows', description: 'Offer professional valuation and pitch deck as a service for your portfolio.' },
  ];

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="text-center max-w-lg mx-auto">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Partner account created!</h2>
          <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Check your email to confirm your account. Then log in to access the dashboard.
          </p>
          {referralCode && (
            <div className={`inline-block px-6 py-3 rounded-xl text-lg font-mono font-bold mb-8 ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              {referralCode}
            </div>
          )}
          <div className="flex flex-col gap-3">
            <Link
              to="/partner/login"
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition text-center"
            >
              Go to partner login
            </Link>
            <Link to="/" className={`text-sm font-medium transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-emerald-600 to-teal-600 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-white/10 rounded-full blur-[80px]" />
        <div className="relative max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <Briefcase className="w-10 h-10 text-white" />
            <span className="text-white font-bold text-xl">Partner Mode</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Turn referrals into revenue.
          </h1>
          <p className="text-emerald-100 text-lg mb-10">
            Ideal for accounting and consulting firms looking to offer valuation and pitch deck as an additional service.
          </p>
          <div className="space-y-6">
            {benefits.map((b, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">{b.title}</h4>
                  <p className="text-emerald-100/80 text-sm">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link to="/" className={`flex items-center gap-1.5 text-sm font-medium transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Briefcase className={`w-8 h-8 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Partner Mode</span>
          </div>

          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Create partner account</h2>
          <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Fill in your details to become a partner.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Full name *</label>
              <input
                {...register('full_name', { required: 'Name is required' })}
                autoComplete="name"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                placeholder="Your full name"
              />
              {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Email *</label>
              <input
                {...register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } })}
                type="email"
                autoComplete="email"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                placeholder="your@email.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password *</label>
              <div className="relative">
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Minimum 8 characters' },
                    validate: {
                      hasUpper: v => /[A-Z]/.test(v) || 'Precisa de letra maiúscula',
                      hasDigit: v => /\d/.test(v) || 'Precisa de número',
                    },
                    onChange: (e) => setPasswordStrength(calculatePasswordStrength(e.target.value)),
                  })}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`w-full px-4 py-3 pr-12 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordStrength > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Força: {getStrengthText(passwordStrength)}</span>
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{passwordStrength}%</span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div className={`h-full ${getStrengthColor(passwordStrength)} transition-all duration-300`} style={{ width: `${passwordStrength}%` }} />
                  </div>
                </div>
              )}
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Confirm password *</label>
              <div className="relative">
                <input
                  {...register('confirm_password', { required: 'Confirmation required' })}
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`w-full px-4 py-3 pr-12 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  placeholder="Repeat your password"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Office / company name *</label>
              <input
                {...register('company_name', { required: 'Company name is required' })}
                autoComplete="organization"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                placeholder="e.g.: Smith Accounting & Associates"
              />
              {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Phone</label>
                <input
                  {...register('phone')}
                  autoComplete="tel"
                  onChange={(e) => { e.target.value = formatPhone(e.target.value); }}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Tax ID / EIN</label>
                <input
                  {...register('cpf_cnpj')}
                  onChange={(e) => { e.target.value = formatTaxID(e.target.value); }}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  placeholder="XX-XXXXXXX"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/25"
            >
              {loading ? 'Creating account...' : 'Create partner account'}
            </button>
          </form>

          <p className={`text-center text-sm mt-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Already a partner?{' '}
            <Link to="/partner/login" className="text-emerald-500 font-semibold hover:text-emerald-400">
              Fazer login
            </Link>
          </p>

          <div className={`flex items-center justify-center gap-3 mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            <Link to="/terms-of-use" className="text-xs hover:text-emerald-500 transition">Terms of Use</Link>
            <span className="text-xs">·</span>
            <Link to="/privacy-policy" className="text-xs hover:text-emerald-500 transition">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
