import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { ParticleNetwork, Counter } from '../components/UIComponents.jsx';
import { usePageTitle } from '../lib/usePageTitle';

export default function LoginPage() {
  usePageTitle('Log In');
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const { register, handleSubmit, formState: { errors }, getValues } = useForm();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { isDark } = useTheme();
  const rawFrom = location.state?.from || '/dashboard';
  const redirectTo = rawFrom.startsWith('/') ? rawFrom : '/dashboard';

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Logged in successfully!');
      // Read state after login has completed updating the store
      // Use a microtask to ensure Zustand has flushed
      await new Promise(resolve => setTimeout(resolve, 0));
      const { isPartner, isAdmin, isSuperAdmin } = useAuthStore.getState();
      if (isPartner && !isAdmin && !isSuperAdmin) {
        navigate('/partner/dashboard');
      } else {
        navigate(redirectTo);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const email = getValues('email');
    if (!email) return toast.error('Enter your email above to resend verification.');
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      toast.success('Verification email resent! Check your inbox.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to resend verification.');
    } finally {
      setResending(false);
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
              <Counter end={500} suffix="+" /> companies valued
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs font-medium">
              <span className="w-2 h-2 bg-green-300 rounded-full" />
              Report in 5 min
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs font-medium">
              <span className="w-2 h-2 bg-green-300 rounded-full" />
              Sector benchmarks
            </span>
          </div>
          
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Exclusive access for professional analysis.
          </h1>
          <p className="text-emerald-100 text-lg">
            Log in and access your valuation reports with real data.
          </p>
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
            <img src="/favicon.svg?v=2" alt="QV" className="w-8 h-8" loading="lazy" />
            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Valuora</span>
          </div>

          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Log In</h2>
          <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sign in to your account to continue.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Email</label>
              <input
                {...register('email', { required: 'Email is required' })}
                type="email"
                autoComplete="email"
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="seu@email.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password</label>
                <Link to="/esqueci-senha" className="text-sm text-emerald-500 hover:text-emerald-400 font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`w-full px-4 py-3 pr-12 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className={`inline-flex items-center gap-1.5 text-xs font-medium transition disabled:opacity-50 ${isDark ? 'text-slate-400 hover:text-emerald-400' : 'text-slate-500 hover:text-emerald-500'}`}
              >
                <Mail className="w-3.5 h-3.5" />
                {resending ? 'Resending...' : 'Didn\'t receive verification email? Resend'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/25"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <p className={`text-center text-sm mt-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Don't have an account?{' '}
            <Link to="/cadastro" className="text-emerald-500 font-semibold hover:text-emerald-400">
              Criar conta
            </Link>
          </p>

          <div className={`flex items-center justify-center gap-3 mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            <Link to="/termos-de-uso" className="text-xs hover:text-emerald-500 transition">Terms of Use</Link>
            <span className="text-xs">·</span>
            <Link to="/politica-de-privacidade" className="text-xs hover:text-emerald-500 transition">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
