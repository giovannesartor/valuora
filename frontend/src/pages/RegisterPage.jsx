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
import { formatCPF_CNPJ as formatTaxID, formatPhone, calculatePasswordStrength, getStrengthColor, getStrengthText } from '../lib/inputMasks';
import { usePageTitle } from '../lib/usePageTitle';
import { useI18n } from '../lib/i18n';

export default function RegisterPage() {
  usePageTitle(t('reg_heading'));
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  const produto = searchParams.get('produto');
  const utmSource   = searchParams.get('utm_source');
  const utmMedium   = searchParams.get('utm_medium');
  const utmCampaign = searchParams.get('utm_campaign');
  const registerUser = useAuthStore((s) => s.register);
  const emailParam   = searchParams.get('email');
  const nomeParam    = searchParams.get('nome');
  const companyParam = searchParams.get('empresa');
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm();
  const watchPassword = watch('password', '');
  const [loading, setLoading] = useState(false);
  const [referralInfo, setReferralInfo] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOptional, setShowOptional] = useState(!!companyParam);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const { isDark } = useTheme();

  // Prefill from partner invite link params
  useEffect(() => {
    if (emailParam)   setValue('email',        decodeURIComponent(emailParam));
    if (nomeParam)    setValue('full_name',     decodeURIComponent(nomeParam));
    if (companyParam) setValue('company_name',  decodeURIComponent(companyParam));
  }, [emailParam, nomeParam, companyParam, setValue]);

  // Validate referral code
  useEffect(() => {
    if (referralCode) {
      api.get(`/partners/referral/${referralCode}`)
        .then(({ data }) => setReferralInfo(data))
        .catch(() => setReferralInfo(null));
    }
  }, [referralCode]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const { confirm_password, ...registerData } = data;
      if (referralCode) registerData.referral_code = referralCode;
      if (utmSource)   registerData.utm_source   = utmSource;
      if (utmMedium)   registerData.utm_medium   = utmMedium;
      if (utmCampaign) registerData.utm_campaign = utmCampaign;
      await registerUser(registerData);
      // Store timestamp and email so VerifyEmailPage can show countdown + resend
      try {
        localStorage.setItem('qv_verify_sent_at', String(Date.now()));
        localStorage.setItem('qv_verify_email', data.email);
      } catch { /* storage unavailable */ }
      if (produto === 'pitch') {
        sessionStorage.setItem('qv_post_verify_redirect', '/pitch-deck/new');
        toast.success('Account created! Check your email. Then we\'ll create your Pitch Deck!');
      } else {
        toast.success('Account created! Check your email (and spam folder).');
      }
      navigate('/verify-email');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed.');
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
            <img src="/favicon.svg?v=2" alt="QV" className="w-10 h-10" loading="lazy" />
            <span className="text-white font-bold text-xl">Valuora</span>
          </div>
          
          {/* Metrics badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs font-medium">
              <span className="w-2 h-2 bg-green-300 rounded-full" />
              500+ {t('reg_companies_valued')}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs font-medium">
              <span className="w-2 h-2 bg-green-300 rounded-full" />
              {t('reg_report_5min')}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs font-medium">
              <span className="w-2 h-2 bg-green-300 rounded-full" />
              {t('reg_sector_benchmarks')}
            </span>
          </div>
          
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            {t('reg_hero_heading')}
          </h1>
          <p className="text-emerald-100 text-lg">
            {t('reg_hero_desc')}
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link to="/" className={`flex items-center gap-1.5 text-sm font-medium transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
            <ArrowLeft className="w-4 h-4" />
            {t('reg_back_to_home')}
          </Link>
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src="/favicon.svg?v=2" alt="QV" className="w-8 h-8" loading="lazy" />
            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Valuora</span>
          </div>

          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('reg_heading')}</h2>
          <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('reg_subtitle')}</p>

          {referralInfo && (
            <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
              <Users className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <p className={`text-sm ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                {t('reg_referred_by')} <strong>{referralInfo.partner_name}</strong>
                {referralInfo.partner_company ? ` (${referralInfo.partner_company})` : ''}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('reg_fullname_label')}</label>
              <input
                {...register('full_name', { required: 'Name is required' })}
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="Your full name"
              />
              {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('reg_email_label')}</label>
              <input
                {...register('email', { required: 'Email is required' })}
                type="email"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="email@example.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('reg_taxid_label')}</label>
              <input
                {...register('cpf_cnpj', { required: 'Tax ID or EIN required', onChange: (e) => { e.target.value = formatTaxID(e.target.value); } })}
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="XX-XXXXXXX"
              />
              {errors.cpf_cnpj && <p className="text-red-500 text-xs mt-1">{errors.cpf_cnpj.message}</p>}
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('reg_taxid_hint')}</p>
            </div>

            {/* Optional fields - collapsible */}
            <div className={`border rounded-xl overflow-hidden transition ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setShowOptional(!showOptional)}
                className={`w-full px-4 py-3 flex items-center justify-between text-left text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
              >
                <span>{t('reg_additional_details')}</span>
                {showOptional ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {showOptional && (
                <div className={`p-4 space-y-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50/50'}`}>
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('reg_phone_label')}</label>
                    <input
                      {...register('phone', { onChange: (e) => { e.target.value = formatPhone(e.target.value); } })}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('reg_company_label')}</label>
                    <input
                      {...register('company_name')}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                      placeholder="Your company name"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('reg_password_label')}</label>
              <div className="relative">
                <input
                  {...register('password', { 
                    required: 'Password is required', 
                    minLength: { value: 8, message: 'Minimum 8 characters' },
                    validate: {
                      hasUppercase: v => /[A-Z]/.test(v) || 'Must contain at least one uppercase letter',
                      hasNumber: v => /[0-9]/.test(v) || 'Must contain at least one number',
                    },
                    onChange: (e) => setPasswordStrength(calculatePasswordStrength(e.target.value))
                  })}
                  type={showPassword ? 'text' : 'password'}
                  className={`w-full px-4 py-3 pr-12 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder={t('reg_min_8_chars')}
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
                    {t('reg_strength_label')} {getStrengthText(passwordStrength)}
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
                <li>• {t('reg_min_8_chars')}</li>
                <li>• {t('reg_has_uppercase')}</li>
                <li>• {t('reg_has_number')}</li>
              </ul>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('reg_confirm_password_label')}</label>
              <div className="relative">
                <input
                  {...register('confirm_password', { 
                    required: 'Confirmation required',
                    validate: v => v === watchPassword || 'Passwords do not match'
                  })}
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`w-full px-4 py-3 pr-12 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="Repeat your password"
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
              {loading ? t('reg_creating') : t('reg_submit')}
            </button>

            <p className={`text-center text-xs mt-4 leading-relaxed ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('reg_agree_prefix')}{' '}
              <Link to="/terms-of-use" className="text-emerald-500 hover:underline">{t('reg_terms_of_use')}</Link>{' '}
              {t('reg_agree_and')}{' '}
              <Link to="/privacy-policy" className="text-emerald-500 hover:underline">{t('reg_privacy_policy')}</Link>.
            </p>
          </form>

          <p className={`text-center text-sm mt-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('reg_have_account')}{' '}
            <Link to="/login" className="text-emerald-500 font-semibold hover:text-emerald-400">
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
