import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, ArrowRight, CheckCircle2, CreditCard, Loader2,
  LogIn, UserPlus, Shield, TrendingUp, FileText, Presentation, ChevronRight,
} from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

/**
 * Embed Valuation Page — standalone page for third-party integration.
 *
 * URL: /embed/valuation?client_id=XXX&redirect_uri=YYY&theme=light
 *
 * Shows the Valuora experience (login → plan selection → form → payment).
 * Can be loaded as iframe or full page redirect from partner sites.
 * Communicates back to parent via postMessage (for iframe mode).
 */

const PLAN_DATA = [
  {
    id: 'professional',
    name: 'Professional',
    price: '$990',
    features: ['DCF Valuation', 'Risk Score', 'Basic PDF Report'],
    color: 'emerald',
  },
  {
    id: 'investor_ready',
    name: 'Investor Ready',
    price: '$2,490',
    features: ['Everything in Professional', 'Sector Benchmark', 'Maturity Index', 'Full Report', 'Simulator'],
    color: 'blue',
    popular: true,
  },
  {
    id: 'fundraising',
    name: 'Fundraising',
    price: '$4,990',
    features: ['Everything in Investor Ready', 'AI Analysis', 'Value Timeline', 'Priority Support'],
    color: 'purple',
  },
];

const PITCH_DECK_DATA = {
  id: 'pitch_deck',
  name: 'AI Pitch Deck',
  price: '$890',
  features: ['AI-generated', '4 visual themes', 'Investor segmentation', 'PDF + PPTX', 'Analytics'],
  color: 'amber',
};

export default function EmbedValuationPage() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user, login, fetchUser } = useAuthStore();

  const [step, setStep] = useState('auth');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appInfo, setAppInfo] = useState(null);
  const [result, setResult] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');

  const [form, setForm] = useState({
    company_name: '',
    sector: '',
    annual_revenue: '',
    annual_costs: '',
    annual_expenses: '',
  });

  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const embedTheme = searchParams.get('theme') || 'light';
  const isIframe = window !== window.parent;

  const postToParent = (type, data) => {
    if (isIframe && window.parent) {
      window.parent.postMessage({ source: 'valuora', type, ...data }, '*');
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      setStep('product');
      postToParent('authenticated', { email: user.email, isAdmin: user.is_admin });
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!clientId) return;
    const fetchAppInfo = async () => {
      try {
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri || window.location.href,
          response_type: 'code',
        });
        const { data } = await api.get(`/oauth/authorize?${params.toString()}`);
        setAppInfo(data);
      } catch {
        // App info is optional for embed
      }
    };
    fetchAppInfo();
  }, [clientId, redirectUri]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      await fetchUser();
      setStep('product');
      postToParent('authenticated', { email });
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/register', {
        email,
        password,
        full_name: form.company_name || email.split('@')[0],
      });
      setError(null);
      setAuthMode('login');
      alert('Account created! Check your email to confirm, then log in.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateValuation = async () => {
    if (!form.company_name || !form.annual_revenue) {
      setError('Company name and annual revenue are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/public/valuations', {
        company_name: form.company_name,
        plan: selectedPlan,
        sector: form.sector || 'Other',
        annual_revenue: parseFloat(form.annual_revenue),
        annual_costs: parseFloat(form.annual_costs) || 0,
        annual_expenses: parseFloat(form.annual_expenses) || 0,
      });
      setResult(data);
      setStep('done');
      postToParent('valuation_created', { id: data.id, plan: selectedPlan, payment_url: data.payment_url });
    } catch (err) {
      try {
        const { data } = await api.post('/analyses', {
          company_name: form.company_name,
          sector: form.sector || 'Other',
          revenue: parseFloat(form.annual_revenue),
          net_margin:
            form.annual_costs && form.annual_revenue
              ? ((parseFloat(form.annual_revenue) - parseFloat(form.annual_costs) - (parseFloat(form.annual_expenses) || 0)) / parseFloat(form.annual_revenue)) * 100
              : 10,
          growth_rate: 5,
          debt: 0,
          cash: 0,
          projection_years: 10,
        });
        setResult({ id: data.id, plan: selectedPlan, payment_url: null });
        setStep('done');
        postToParent('valuation_created', { id: data.id, plan: selectedPlan });
      } catch (err2) {
        setError(err2.response?.data?.detail || err.response?.data?.detail || 'Failed to create valuation.');
      }
    } finally {
      setLoading(false);
    }
  };

  const bgClass = embedTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900';
  const cardClass = embedTheme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const inputClass = embedTheme === 'dark'
    ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400'
    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400';

  const stepLabels = ['Access', 'Product', 'Plan', 'Details', 'Done'];
  const stepKeys = ['auth', 'product', 'plan', 'form', 'done'];
  const currentIdx = stepKeys.indexOf(step);

  return (
    <div className={`min-h-screen ${bgClass} p-4 sm:p-8`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="w-7 h-7 text-emerald-500" />
            <h1 className="text-2xl sm:text-3xl font-bold">Valuora</h1>
          </div>
          <p className={`text-sm ${embedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Discover the true value of your business with professional valuation
          </p>
          {appInfo && (
            <p className={`text-xs ${embedTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'} mt-1`}>
              connected via {appInfo.app_name}
            </p>
          )}
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {stepLabels.map((label, i) => {
            const isActive = i === currentIdx;
            const isDone = i < currentIdx;
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isActive
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                        : embedTheme === 'dark'
                          ? 'bg-slate-700 text-slate-400'
                          : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                {i < 4 && (
                  <ChevronRight className={`w-4 h-4 ${embedTheme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* AUTH STEP */}
        {step === 'auth' && (
          <div className={`${cardClass} rounded-2xl border p-6 sm:p-8 max-w-md mx-auto`}>
            <h2 className="text-xl font-bold text-center mb-6">
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
            <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${inputClass}`}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${inputClass}`}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : authMode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
            <p className="text-center text-sm mt-4">
              <button
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-emerald-600 hover:underline"
              >
                {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </p>
          </div>
        )}

        {/* PRODUCT STEP */}
        {step === 'product' && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-center mb-6">What do you need?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => { setSelectedProduct('valuation'); setStep('plan'); }}
                className={`${cardClass} rounded-2xl border p-6 text-left hover:border-emerald-400 transition-colors`}
              >
                <Building2 className="w-8 h-8 text-emerald-500 mb-3" />
                <h3 className="text-lg font-semibold mb-1">Business Valuation</h3>
                <p className={`text-sm ${embedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Complete valuation with DCF, risk analysis, and professional report.
                </p>
                <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium mt-3">
                  Choose plan <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
              <button
                onClick={() => { setSelectedProduct('pitch_deck'); setSelectedPlan('pitch_deck'); setStep('form'); }}
                className={`${cardClass} rounded-2xl border p-6 text-left hover:border-amber-400 transition-colors`}
              >
                <Presentation className="w-8 h-8 text-amber-500 mb-3" />
                <h3 className="text-lg font-semibold mb-1">AI Pitch Deck</h3>
                <p className={`text-sm ${embedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Professional pitch deck generated by AI with investor segmentation.
                </p>
                <span className="inline-flex items-center gap-1 text-amber-600 text-sm font-medium mt-3">
                  {PITCH_DECK_DATA.price} <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* PLAN STEP */}
        {step === 'plan' && (
          <div>
            <h2 className="text-xl font-bold text-center mb-6">Choose your plan</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {PLAN_DATA.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => { setSelectedPlan(plan.id); setStep('form'); }}
                  className={`${cardClass} rounded-2xl border p-6 text-left hover:border-${plan.color}-400 transition-all relative ${
                    plan.popular ? `ring-2 ring-${plan.color}-500` : ''
                  }`}
                >
                  {plan.popular && (
                    <span className={`absolute -top-3 left-1/2 -translate-x-1/2 bg-${plan.color}-500 text-white text-xs font-bold px-3 py-1 rounded-full`}>
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  <p className={`text-2xl font-bold text-${plan.color}-600 mb-3`}>{plan.price}</p>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className={`w-4 h-4 text-${plan.color}-500 shrink-0`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            <p className="text-center mt-4">
              <button onClick={() => setStep('product')} className="text-sm text-slate-500 hover:text-slate-700">
                ← Back to product selection
              </button>
            </p>
          </div>
        )}

        {/* FORM STEP */}
        {step === 'form' && (
          <div className={`${cardClass} rounded-2xl border p-6 sm:p-8 max-w-lg mx-auto`}>
            <h2 className="text-xl font-bold mb-6">Company Details</h2>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company Name *</label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${inputClass}`}
                  placeholder="Acme Inc."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sector</label>
                <input
                  type="text"
                  value={form.sector}
                  onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${inputClass}`}
                  placeholder="Technology"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Annual Revenue (USD) *</label>
                <input
                  type="number"
                  value={form.annual_revenue}
                  onChange={(e) => setForm((f) => ({ ...f, annual_revenue: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${inputClass}`}
                  placeholder="500000"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Annual Costs</label>
                  <input
                    type="number"
                    value={form.annual_costs}
                    onChange={(e) => setForm((f) => ({ ...f, annual_costs: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${inputClass}`}
                    placeholder="200000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Annual Expenses</label>
                  <input
                    type="number"
                    value={form.annual_expenses}
                    onChange={(e) => setForm((f) => ({ ...f, annual_expenses: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${inputClass}`}
                    placeholder="100000"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateValuation}
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Create Valuation
              </button>
            </div>
            <p className="text-center mt-4">
              <button onClick={() => setStep(selectedProduct === 'pitch_deck' ? 'product' : 'plan')} className="text-sm text-slate-500 hover:text-slate-700">
                ← Back
              </button>
            </p>
          </div>
        )}

        {/* DONE STEP */}
        {step === 'done' && result && (
          <div className={`${cardClass} rounded-2xl border p-6 sm:p-8 max-w-lg mx-auto text-center`}>
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Valuation Created!</h2>
            <p className={`text-sm ${embedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'} mb-6`}>
              Your analysis is being processed. You can track it from your dashboard.
            </p>
            {result.payment_url && (
              <a
                href={result.payment_url}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors mb-3"
              >
                <CreditCard className="w-4 h-4" />
                Complete Payment
              </a>
            )}
            <div className="flex items-center justify-center gap-4 mt-4">
              <button
                onClick={() => {
                  setStep('product');
                  setResult(null);
                  setForm({ company_name: '', sector: '', annual_revenue: '', annual_costs: '', annual_expenses: '' });
                }}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Create another
              </button>
              {redirectUri && (
                <a href={redirectUri} className="text-sm text-slate-500 hover:text-slate-700">
                  Return to app →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`text-center mt-8 text-xs ${embedTheme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
          <p>
            Powered by{' '}
            <a href="https://valuora.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">
              Valuora
            </a>
          </p>
          <p className="flex items-center justify-center gap-1 mt-1">
            <Shield className="w-3 h-3" /> Data protected by encryption
          </p>
        </div>
      </div>
    </div>
  );
}
