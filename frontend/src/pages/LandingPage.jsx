import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ArrowRight, BarChart3, Shield, FileText, TrendingUp,
  Zap, Target, Mail, ChevronRight, Lock,
  Cpu, Database, LineChart, CheckCircle, Activity,
  Building2, Users, Award, Clock, Eye, Briefcase,
  ChevronDown, PieChart, Menu, X, DollarSign as DollarIcon,
  Instagram, Brain, GitCompareArrows, Globe,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import DiagnosticoModal from '../components/DiagnosticoModal';
import WhatsAppButton from '../components/WhatsAppButton';
import LazySection from '../components/LazySection';
import EmeraldParticles from '../components/EmeraldParticles';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';

export default function LandingPage() {
  usePageTitle(null);
  const { isDark } = useTheme();
  const [openFaq, setOpenFaq] = useState(null);
  const [openMethod, setOpenMethod] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [diagnosticoOpen, setDiagnosticoOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // P2+P3: Hero product switcher
  const [heroProduct, setHeroProduct] = useState('valuation'); // 'valuation' | 'pitch'

  // L3: Typewriter
  const TW_TARGET = 'Get the answer now.';
  const [twText, setTwText] = useState('');
  const twDone = twText.length >= TW_TARGET.length;

  // Scroll suave para links âncora
  useEffect(() => {
    const handleClick = (e) => {
      const href = e.target.closest('a')?.getAttribute('href');
      if (href?.startsWith('#')) {
        e.preventDefault();
        const el = document.querySelector(href);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Scroll spy — destacar seção ativa na navbar
  useEffect(() => {
    const ids = ['como-funciona', 'recursos', 'planos', 'metodologia', 'partners'];
    const observers = ids.map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0.25, rootMargin: '-80px 0px -60% 0px' }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach((o) => o?.disconnect());
  }, []);

  // Navbar shrink + sticky bar on scroll
  useEffect(() => {
    const onScroll = () => {
      setShowStickyBar(window.scrollY > 600);
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // L3: Typewriter effect
  useEffect(() => {
    let i = 0;
    let intervalId = null;
    setTwText('');
    const delay = setTimeout(() => {
      intervalId = setInterval(() => {
        i++;
        setTwText(TW_TARGET.slice(0, i));
        if (i >= TW_TARGET.length) clearInterval(intervalId);
      }, 65);
    }, 600);
    return () => { clearTimeout(delay); if (intervalId) clearInterval(intervalId); };
  }, []);

  // F5: Schema.org structured data
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          'name': 'Valuora',
          'applicationCategory': 'BusinessApplication',
          'operatingSystem': 'Web',
          'offers': { '@type': 'Offer', 'price': '990', 'priceCurrency': 'USD' },
          'description': 'Professional business valuation platform with DCF methodology, calibrated sector benchmarks, and artificial intelligence.',
          'url': 'https://valuora.online',
        },
        {
          '@type': 'FAQPage',
          'mainEntity': [
            { '@type': 'Question', 'name': 'What is business valuation?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'Valuation is the process of determining the economic value of a company. The most robust method is DCF (Discounted Cash Flow), which projects future cash flows and discounts them by the cost of capital.' } },
            { '@type': 'Question', 'name': 'How much does a professional valuation cost?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'Traditional consulting firms charge between $5,000 and $50,000. Valuora offers professional valuation starting at $990, with delivery in minutes.' } },
            { '@type': 'Question', 'name': 'Is the report accepted by investors?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'Yes. The PDF report contains full calculation methodology, assumptions, sensitivity analysis, scenarios, and AI analysis — following M&A standards.' } },
            { '@type': 'Question', 'name': 'How does the DCF engine work?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'The engine calculates projected FCFE for 5–10 years, applies WACC with Damodaran sector beta, US Treasury risk-free rate, and equity risk premium. Sector benchmarks calibrated by a proprietary database with 50+ industry segments.' } },
          ],
        },
      ],
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'valuora-schema';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    return () => { document.getElementById('qv-schema')?.remove(); };
  }, []);

  return (
    <div className={`min-h-screen overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>

      {/* ─── Navbar ──────────────────────────────────────── */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-all duration-300 ${scrolled ? 'shadow-sm' : ''} ${isDark ? 'bg-slate-950/80 border-slate-800/50' : 'bg-white/80 border-slate-200'}`}>
        <div className={`max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between transition-all duration-300 ${scrolled ? 'h-14' : 'h-20'}`}>
          <div className="flex items-center gap-3">
            <img src="/favicon.svg?v=2" alt="Valuora" className={`transition-all duration-300 ${scrolled ? 'w-7 h-7' : 'w-8 h-8'}`} />
            <span className={`font-semibold text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Valuora<sup className="text-[9px] ml-0.5 opacity-50">®</sup>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[
              { href: '#como-funciona', id: 'como-funciona', label: 'How it works' },
              { href: '#recursos',      id: 'recursos',      label: 'Features' },
              { href: '#planos',        id: 'planos',        label: 'Plans' },
              { href: '#metodologia',   id: 'metodologia',   label: 'Methodology' },
              { href: '#partners',     id: 'partners',     label: 'Partners' },
            ].map(({ href, id, label }) => (
              <a
                key={id}
                href={href}
                className={`text-xs font-medium uppercase tracking-widest transition border-b-2 pb-0.5 ${
                  activeSection === id
                    ? isDark
                      ? 'text-white border-emerald-400'
                      : 'text-slate-900 border-emerald-500'
                    : 'border-transparent ' + (isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-500 hover:text-slate-900')
                }`}
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle />
            <Link to="/login" className={`hidden md:inline-block text-xs font-medium uppercase tracking-wide transition px-4 py-2 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              Sign in
            </Link>
            <Link to="/partner/login" className={`hidden lg:inline-block text-xs font-medium uppercase tracking-wide transition px-3 py-2 rounded-lg ${isDark ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}>
              Partner
            </Link>
            <Link to="/register" className="hidden sm:inline-block bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition-all">
              START VALUATION
            </Link>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className={`md:hidden p-3 rounded-xl transition-colors duration-200 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              {mobileNavOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileNavOpen && (
          <div className={`md:hidden border-t ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="px-4 py-4 space-y-1">
              {[
                { href: '#como-funciona', label: 'How it works' },
                { href: '#recursos', label: 'Features' },
                { href: '#planos', label: 'Plans' },
                { href: '#metodologia', label: 'Methodology' },
                { href: '#partners', label: 'Partners' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {item.label}
                </a>
              ))}
              <div className={`h-px my-2 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <Link
                to="/login"
                onClick={() => setMobileNavOpen(false)}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Sign in
              </Link>
              <Link
                to="/partner/login"
                onClick={() => setMobileNavOpen(false)}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-emerald-400 hover:bg-slate-800' : 'text-emerald-600 hover:bg-emerald-50'}`}
              >
                Login Partner
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileNavOpen(false)}
                className="block text-center bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm font-semibold hover:brightness-110 transition-all"
              >
                START VALUATION
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Barra fixa ──────────────────────────────────── */}
      {showStickyBar && (
        <div className={`fixed ${scrolled ? 'top-14' : 'top-20'} left-0 right-0 z-40 flex items-center justify-center gap-3 py-2 text-xs font-medium backdrop-blur-xl border-b transition-all ${
          isDark ? 'bg-slate-900/95 border-slate-800 text-slate-400' : 'bg-white/95 border-slate-200 text-slate-600'
        }`}>
          <span className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Valuation starting at $990</span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
          <span className={`font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Pitch Deck $897</span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
          <span>One-time payment</span>
          <Link to="/register" className="ml-1 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600 text-white hover:brightness-110 transition">
            Start →
          </Link>
        </div>
      )}

      {/* ─── Hero ────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28">
        {/* V5: Emerald neural network animated background */}
        <div className="absolute inset-0 overflow-hidden opacity-[0.18]">
          <EmeraldParticles isDark={isDark} />
        </div>
        {/* Subtle animated grid background */}
        <div className={`absolute inset-0 bg-grid-pattern opacity-[0.03] ${isDark ? '' : ''}`} />
        <div className={`absolute inset-0 pointer-events-none bg-gradient-to-b ${isDark ? 'from-slate-950 via-slate-950/95 to-slate-950' : 'from-white via-white/95 to-white'}`} />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-[160px] pointer-events-none transition-all duration-700"
          style={{ background: heroProduct === 'pitch'
            ? isDark
              ? 'radial-gradient(ellipse, rgba(168,85,247,0.10) 0%, transparent 68%)'
              : 'radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 68%)'
            : isDark
              ? 'radial-gradient(ellipse, rgba(16,185,129,0.10) 0%, transparent 68%)'
              : 'radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 68%)'
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6">
          {/* V1: Flex wrapper — split screen on large screens for both products */}
          <div className="lg:flex lg:items-center lg:gap-12">
          {/* Main content column */}
          <div className="flex-1 text-center lg:text-left">
          {/* Product switcher badge — M1: full-width on mobile */}
          <div className={`flex sm:inline-flex w-full sm:w-auto items-center gap-1 p-1 rounded-xl border mb-8 ${isDark ? 'bg-slate-900/80 border-slate-700/60' : 'bg-slate-100 border-slate-200'}`}>
            <button
              onClick={() => setHeroProduct('valuation')}
              className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 px-4 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                heroProduct === 'valuation'
                  ? isDark ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white text-emerald-700 border border-emerald-200 shadow-sm'
                  : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Valuation DCF
            </button>
            <button
              onClick={() => setHeroProduct('pitch')}
              className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 px-4 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                heroProduct === 'pitch'
                  ? isDark ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white text-purple-700 border border-purple-200 shadow-sm'
                  : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Pitch Deck
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>NEW</span>
            </button>
          </div>

          <h1 className={`text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1] mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            How much is
            <br />
            <span className={`text-transparent bg-clip-text bg-gradient-to-r ${heroProduct === 'pitch' ? 'from-purple-500 to-indigo-400' : 'from-emerald-500 to-teal-400'} transition-all duration-500`}>your company worth?</span>
            <br />
            <span className={`text-xl md:text-2xl lg:text-3xl font-medium tracking-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {twText}
              <span
                className={`inline-block w-[2px] h-[0.8em] align-middle ml-0.5 translate-y-[-0.05em] ${isDark ? 'bg-slate-400' : 'bg-slate-500'}`}
                style={{ animation: twDone ? 'blink 1s step-end infinite' : 'none', opacity: twDone ? undefined : 1 }}
              />
            </span>
          </h1>

          {/* Dynamic hero content */}
          <div key={heroProduct} style={{ animation: 'fadeIn 0.35s ease-out' }}>

            {heroProduct === 'valuation' ? (
              <>
                <p className={`text-base md:text-lg max-w-2xl mx-auto lg:mx-0 mb-6 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Professional valuation in minutes — not weeks.
                  The rigor of DCF with AI interpretation, calibrated sector benchmarks, and the same M&A standard at a fraction of the cost.
                </p>

                {/* M2: swipe strip on mobile */}
                <div className="flex overflow-x-auto snap-x gap-3 mb-8 -mx-6 px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:mx-0 sm:px-0 sm:overflow-visible sm:justify-center lg:justify-start">
                  {[
                    { icon: Cpu,      label: 'Institutional DCF Engine',           border: 'emerald' },
                    { icon: Brain,    label: 'Artificial Intelligence Analysis', border: 'teal' },
                    { icon: FileText, label: 'Up to 25-page report',        border: 'emerald' },
                  ].map(({ icon: Icon, label, border }, i) => (
                    <div key={i} className={`flex-shrink-0 snap-start flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold tracking-wide ${
                      border === 'teal'
                        ? isDark ? 'bg-slate-900/80 border-teal-500/30 text-teal-400' : 'bg-teal-50 border-teal-200 text-teal-700'
                        : isDark ? 'bg-slate-900/80 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </div>
                  ))}
                </div>

                {/* M3: primary CTA full-width on mobile */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-4">
                  <Link to="/register" className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-10 py-4 rounded-xl text-base font-semibold hover:brightness-110 transition-all">
                    Start valuation
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <button
                    onClick={() => setDiagnosticoOpen(true)}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-medium transition-colors duration-200 px-6 py-4 rounded-xl border ${isDark ? 'border-slate-700 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400' : 'border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-600'}`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Free Diagnostic
                  </button>
                </div>
                <p className={`text-xs mb-4 text-center lg:text-left ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  No subscription · Results in minutes · Starting at $990
                </p>
                <div className={`lg:hidden flex items-center gap-3 mb-8 p-4 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <FileText className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Report samples</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {[
                        { label: 'Professional Valuation', href: '/sample-report-professional.pdf' },
                        { label: 'Investor Ready', href: '/sample-report-investor-ready.pdf' },
                        { label: 'Fundraising Package ★', href: '/sample-report-fundraising.pdf' },
                      ].map(({ label, href }) => (
                        <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                          className={`text-xs font-medium hover:underline ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          {label} ↗
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className={`text-base md:text-lg max-w-2xl mx-auto lg:mx-0 mb-6 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Professional pitch deck for investors — in minutes.
                  A4 landscape layout with AI narrative, KPI panel, scenario charts, visual TAM/SAM/SOM, and competitive matrix.
                </p>

                {/* M2: swipe strip on mobile */}
                <div className="flex overflow-x-auto snap-x gap-3 mb-8 -mx-6 px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:mx-0 sm:px-0 sm:overflow-visible sm:justify-center lg:justify-start">
                  {[
                    { icon: Brain,    label: 'AI Narrative',           color: 'purple' },
                    { icon: LineChart, label: 'Waterfall + 3 Scenarios',    color: 'indigo' },
                    { icon: Target,   label: 'TAM/SAM/SOM Visual',         color: 'purple' },
                    { icon: FileText, label: 'Landscape A4 — Premium Design', color: 'indigo' },
                  ].map(({ icon: Icon, label, color }, i) => (
                    <div key={i} className={`flex-shrink-0 snap-start flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold tracking-wide ${
                      color === 'purple'
                        ? isDark ? 'bg-slate-900/80 border-purple-500/30 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-700'
                        : isDark ? 'bg-slate-900/80 border-indigo-500/30 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </div>
                  ))}
                </div>

                {/* M3: primary CTA full-width on mobile */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-4">
                  <Link to="/register" className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-purple-600 text-white px-10 py-4 rounded-xl text-base font-semibold hover:brightness-110 transition-all">
                    Create my pitch deck
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <button
                    onClick={() => setHeroProduct('valuation')}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-medium transition-colors duration-200 px-6 py-4 rounded-xl border ${isDark ? 'border-slate-700 text-slate-300 hover:border-purple-500/50 hover:text-purple-400' : 'border-slate-300 text-slate-600 hover:border-purple-400 hover:text-purple-600'}`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    See DCF Valuation
                  </button>
                </div>
                <p className={`text-xs mb-4 text-center lg:text-left ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  No subscription · Results in minutes · $897 one-time payment
                </p>
                <div className={`lg:hidden flex items-center gap-3 mb-8 p-4 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                    <Briefcase className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Pitch deck sample</p>
                    <a
                      href="/sample-pitchdeck.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs font-medium hover:underline ${isDark ? 'text-purple-400' : 'text-purple-600'}`}
                    >
                      View full PDF ↗
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Trust badges — M4: 2×2 grid on mobile, single row on sm+ */}
          <div className={`grid grid-cols-2 sm:inline-flex sm:items-center sm:justify-center lg:justify-start gap-3 sm:gap-6 md:gap-8 px-5 py-4 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            {[
              { icon: Shield,   label: 'LGPD Compliant' },
              { icon: Lock,     label: 'SSL 256-bit' },
              { icon: Cpu,      label: 'Methodology DCF' },
              { icon: Database, label: 'Sector Benchmarks' },
            ].map(({ icon: Icon, label }, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs font-medium">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {label}
              </div>
            ))}
          </div>

          </div>{/* /content-column */}

          {/* Live mock preview right column — desktop only, switches between valuation and pitch */}
          <div className="hidden lg:block w-80 xl:w-96 flex-shrink-0 mt-8 lg:mt-0">
            <div className={`rounded-2xl border overflow-hidden shadow-2xl transition-all duration-500 ${
              heroProduct === 'pitch'
                ? isDark ? 'border-purple-500/30 shadow-purple-900/30' : 'border-purple-200 shadow-purple-300/30'
                : isDark ? 'border-slate-700/60 shadow-black/40' : 'border-slate-200 shadow-slate-300/50'
            }`}>
              {/* Mock browser chrome */}
              <div className={`flex items-center gap-1.5 px-3 py-2.5 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                <span className={`text-[10px] ml-2 font-medium truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {heroProduct === 'pitch' ? 'pitchdeck-valuora.pdf' : 'report-valuora.pdf'}
                </span>
              </div>

              {/* Annotated mock preview — replaces slow iframe */}
              <div className={`relative h-[400px] overflow-hidden transition-all duration-500 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                {heroProduct === 'pitch' ? (
                  <div key="pitch-mock" className="p-5 space-y-3 h-full" style={{animation:'fadeIn 0.35s ease-out'}}>
                    <div className={`rounded-xl p-4 border ${isDark ? 'border-purple-500/20 bg-purple-500/5' : 'border-purple-100 bg-purple-50/60'}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${isDark ? 'text-purple-400/70' : 'text-purple-500'}`}>Pitch Deck · Company X</p>
                      <div className="flex justify-between items-end">
                        <p className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Series A Round — $5M</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>12 slides</span>
                      </div>
                    </div>
                    <div className={`rounded-xl p-4 border ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-white'}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Market Size</p>
                      <div className="flex items-end gap-4 justify-center">
                        <div className="text-center">
                          <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center mx-auto ${isDark ? 'border-purple-400/40 bg-purple-500/10' : 'border-purple-300 bg-purple-50'}`}>
                            <span className={`text-[9px] font-bold leading-tight text-center ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>TAM<br/>$4.2B</span>
                          </div>
                          <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Total</p>
                        </div>
                        <div className="text-center">
                          <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center mx-auto ${isDark ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-indigo-200 bg-indigo-50'}`}>
                            <span className={`text-[9px] font-bold leading-tight text-center ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>SAM<br/>$820M</span>
                          </div>
                          <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Addressable</p>
                        </div>
                        <div className="text-center">
                          <div className={`w-9 h-9 rounded-full border-4 flex items-center justify-center mx-auto ${isDark ? 'border-pink-400/40 bg-pink-500/10' : 'border-pink-200 bg-pink-50'}`}>
                            <span className={`text-[9px] font-bold text-center ${isDark ? 'text-pink-300' : 'text-pink-700'}`}>SOM</span>
                          </div>
                          <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Obtainable</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[['MRR','$84K',true],['Churn','2,1%',false],['NPS','72',true]].map(([l,v,pos],i) => (
                        <div key={i} className={`rounded-lg border p-2.5 ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-white'}`}>
                          <p className={`text-[9px] font-semibold uppercase mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{l}</p>
                          <p className={`text-sm font-bold ${pos ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-500')}`}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div key="val-mock" className="p-5 space-y-3 h-full" style={{animation:'fadeIn 0.35s ease-out'}}>
                    <div className={`rounded-xl p-4 border ${isDark ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/60'}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>Estimated Equity Value</p>
                      <div className="flex justify-between items-end">
                        <p className={`font-bold text-2xl ${isDark ? 'text-white' : 'text-slate-900'}`}>$4.2M</p>
                        <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Range: $3.1M — $5.6M</span>
                      </div>
                      <div className={`h-2 rounded-full mt-2 ${isDark ? 'bg-slate-700' : 'bg-emerald-100'}`}>
                        <div className="h-full w-[52%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 ml-[24%]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[['Risk Score','72/100',0],['Maturity','8,4/10',1],['Percentile','68%',2]].map(([l,v,ci],i) => (
                        <div key={i} className={`rounded-lg border p-2.5 ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-white'}`}>
                          <p className={`text-[9px] font-semibold uppercase mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{l}</p>
                          <p className={`text-sm font-bold ${ci===0 ? (isDark?'text-emerald-400':'text-emerald-600') : ci===1 ? (isDark?'text-teal-400':'text-teal-600') : (isDark?'text-cyan-400':'text-cyan-600')}`}>{v}</p>
                        </div>
                      ))}
                    </div>
                    <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-white'}`}>
                      <p className={`text-[9px] font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>FCFE Projection — 5 years</p>
                      <div className="flex items-end gap-1.5 h-14">
                        {[38,50,62,74,90].map((h,i) => (
                          <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-emerald-600/80 to-emerald-400/50" style={{height:`${h}%`}} />
                        ))}
                      </div>
                      <div className="flex justify-between mt-1.5">
                        {['A1','A2','A3','A4','A5'].map((l,i) => (
                          <span key={i} className={`text-[8px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{l}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {/* Callout annotation badges */}
                <div className="absolute inset-0 pointer-events-none">
                  {heroProduct === 'pitch' ? (
                    <>
                      <div className={`absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-purple-950/95 border-purple-500/50 text-purple-300' : 'bg-white border-purple-300 text-purple-700 shadow-purple-100'}`}>
                        <Brain className="w-3 h-3" /> AI Narrative
                      </div>
                      <div className={`absolute top-[145px] left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-indigo-950/95 border-indigo-500/50 text-indigo-300' : 'bg-white border-indigo-300 text-indigo-700 shadow-indigo-100'}`}>
                        <Target className="w-3 h-3" /> TAM/SAM/SOM
                      </div>
                      <div className={`absolute bottom-4 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-slate-800/95 border-slate-600/60 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <BarChart3 className="w-3 h-3" /> KPI Panel
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-300' : 'bg-white border-emerald-300 text-emerald-700 shadow-emerald-100'}`}>
                        <TrendingUp className="w-3 h-3" /> DCF Gordon
                      </div>
                      <div className={`absolute top-[120px] right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-teal-950/95 border-teal-500/50 text-teal-300' : 'bg-white border-teal-300 text-teal-700 shadow-teal-100'}`}>
                        <Database className="w-3 h-3" /> Sector Benchmark
                      </div>
                      <div className={`absolute bottom-10 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-cyan-950/95 border-cyan-500/50 text-cyan-300' : 'bg-white border-cyan-300 text-cyan-700 shadow-cyan-100'}`}>
                        <LineChart className="w-3 h-3" /> 5-year Projection
                      </div>
                      <div className={`absolute bottom-3 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-slate-800/95 border-slate-600/60 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <Brain className="w-3 h-3" /> AI Analysis
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 mt-6">
              <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {heroProduct === 'pitch' ? 'Real sample · 12 slides · premium design' : 'Fundraising Package · ~25 pages · ready after filling out'}
              </p>
              {heroProduct !== 'pitch' ? (
                <div className="flex gap-3">
                  {[
                    { label: 'Professional Valuation', href: '/sample-report-professional.pdf' },
                    { label: 'Investor Ready', href: '/sample-report-investor-ready.pdf' },
                    { label: 'Fundraising Package ★', href: '/sample-report-fundraising.pdf' },
                  ].map(({ label, href }) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs font-medium transition ${
                        label.includes('★')
                          ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                          : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {label} ↗
                    </a>
                  ))}
                </div>
              ) : (
                <a
                  href="/sample-pitchdeck.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs font-medium transition ${isDark ? 'text-purple-400/60 hover:text-purple-400' : 'text-purple-600/60 hover:text-purple-600'}`}
                >
                  Open ↗
                </a>
              )}
            </div>
          </div>

          </div>{/* /flex-wrapper */}
        </div>
      </section>

      {/* ─── Strip: Status do Motor ─────────────────────── */}
      <div className={`py-2.5 border-b ${isDark ? 'bg-slate-900/70 border-slate-800/60' : 'bg-slate-50 border-slate-100'}`}>
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs">
          <span className={`flex items-center gap-1.5 font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" style={{animation:'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite'}} />
            DCF Engine v7 — Active
          </span>
          <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Updated on <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>March 2026</span></span>
          <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>10Y Treasury: <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>4.25%</span></span>
          <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Beta Damodaran <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>2026</span></span>
          <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}><span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>52</span> calibrated industry sectors</span>
        </div>
      </div>

      {/* ─── Credibilidade ──────────────────────────────── */}
      <section className={`py-10 ${isDark ? 'bg-slate-900/40' : 'bg-slate-50'}`}>
        <div className="max-w-5xl mx-auto px-6">
          <p className={`text-center text-xs font-semibold uppercase tracking-widest mb-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Market-recognized methodology
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {[
              { icon: Shield,   label: 'LGPD Compliant' },
              { icon: Lock,     label: 'SSL 256-bit Encryption' },
              { icon: Cpu,      label: 'Certified DCF' },
              { icon: Database, label: 'Sector Benchmarks' },
              { icon: Globe,    label: 'Beta Damodaran / NYU Stern' },
            ].map(({ icon: Icon, label }, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                  <Icon className="w-4 h-4 text-emerald-500" />
                </div>
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── L1: Comparison Table ───────────────────────────── */}
      <section className="py-24 md:py-32 relative">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Comparison</p>
            <h2 className={`text-2xl md:text-3xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Why is{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Valuora</span>{' '}
              different?
            </h2>
          </div>

          {/* M5: horizontal scroll on narrow screens */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className={`min-w-[460px] rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200 shadow-sm'}`}>
            {/* Header row */}
            <div className={`grid grid-cols-[150px_1fr_1fr] ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
              <div className={`py-4 px-5 border-b border-r ${isDark ? 'border-slate-800' : 'border-slate-200'}`} />
              <div className={`py-4 px-5 text-center border-b border-r ${isDark ? 'border-slate-800 bg-emerald-500/8' : 'border-slate-200 bg-emerald-50'}`}>
                <div className="flex items-center justify-center gap-2">
                  <img src="/favicon.svg?v=2" alt="Valuora" className="w-4 h-4" />
                  <span className={`font-bold text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Valuora</span>
                </div>
              </div>
              <div className={`py-4 px-5 text-center border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <span className={`font-semibold text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Traditional Consulting</span>
              </div>
            </div>

            {[
              { label: 'Time',         qv: 'Results in 5 minutes',          cons: 'Weeks to months' },
              { label: 'Cost',         qv: 'Starting at $990',               cons: '$5,000 to $50,000+' },
              { label: 'Complexity',  qv: 'Fill out and receive — simple',     cons: 'Meetings, interviews, spreadsheets' },
              { label: 'PDF Report', qv: 'Up to 25 pages included',        cons: 'Charged separately or not included' },
              { label: 'Available',    qv: '24/7, anywhere',     cons: 'Business hours, in-person' },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-[150px_1fr_1fr] border-b last:border-b-0 ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
                <div className={`py-3 px-5 flex items-center text-sm font-medium border-r ${isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                  {row.label}
                </div>
                <div className={`py-3 px-5 flex items-center gap-2 border-r ${isDark ? 'border-slate-800 bg-emerald-500/3' : 'border-slate-200 bg-emerald-50/30'}`}>
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{row.qv}</span>
                </div>
                <div className="py-3 px-5 flex items-center gap-2">
                  <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{row.cons}</span>
                </div>
              </div>
            ))}
          </div>
          </div>{/* /overflow-x-auto */}

          <div className="text-center mt-7">
            <Link to="/register" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-7 py-3.5 rounded-xl text-sm font-semibold hover:brightness-110 transition-all">
              Start now — free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── L2: Sector Ticker ──────────────────────────────── */}
      <div className={`py-4 overflow-hidden border-y ${isDark ? 'border-slate-800/50' : 'border-slate-100'}`}>
        <div style={{ display: 'flex', width: 'max-content', animation: 'ticker 30s linear infinite' }}>
          {['Retail', 'Technology', 'Healthcare', 'Logistics', 'Industry', 'Education', 'Real Estate', 'Agribusiness', 'Finance', 'Construction', 'Food', 'E-commerce', 'Consulting', 'Services', 'Manufacturing',
            'Retail', 'Technology', 'Healthcare', 'Logistics', 'Industry', 'Education', 'Real Estate', 'Agribusiness', 'Finance', 'Construction', 'Food', 'E-commerce', 'Consulting', 'Services', 'Manufacturing',
          ].map((s, i) => (
            <span key={i} className={`flex items-center gap-3 px-6 text-sm font-medium whitespace-nowrap select-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-emerald-500/50' : 'bg-emerald-400/60'}`} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Problema → Solução ───────────────────────────── */}
      <section className="py-16 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-5xl mx-auto px-6">
          {/* Problem statement */}
          <div className="text-center mb-12">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-red-400/60' : 'text-red-500/60'}`}>The problem</p>
            <h2 className={`text-3xl md:text-4xl font-semibold tracking-tight mb-6 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Without a structured valuation, any negotiation starts with{' '}
              <span className="text-red-400">information asymmetry</span>
            </h2>
            <div className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {['Stake sale', 'Partner entry', 'Investment fundraising', 'Exit planning'].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className={`max-w-2xl mx-auto leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Consultings tradicionais levam semanas e custam entre{' '}
              <span className={isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>$5,000 to $50,000</span>.
              {' '}O Valuora entrega uma análise técnica, fundamentada e documentada em minutos.
            </p>
          </div>

          {/* Solution — 3 pillars */}
          <div className="text-center mb-8">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>The solution</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Cpu,
                title: 'Institutional Engine',
                desc: 'DCF with 10-year projected FCFE, WACC, Damodaran sector beta, and US Treasury risk-free rate — the same methodology used by M&A consulting firms.',
                tag: 'DCF Engine v7',
              },
              {
                icon: Database,
                title: 'Sector Benchmarks',
                desc: "Proprietary database with 50+ industry segments, calibrated with Damodaran methodology and market data. Your valuation reflects your sector's real scenario.",
                tag: 'Sector Database',
              },
              {
                icon: FileText,
                title: 'Defensible Report',
                desc: 'Up to 25 pages with calculation methodology, assumptions, scenarios, and AI analysis — ready for investors, partners, or banks.',
                tag: 'PDF Premium',
              },
            ].map((item, i) => (
              <div key={i} className={`rounded-2xl border p-8 text-center transition-colors duration-200 ${isDark ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4 inline-block ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>{item.tag}</span>
                <h3 className={`font-bold text-lg mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Para quem é ─────────────────────────────────── */}
      <section className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-teal-400/60' : 'text-teal-600/60'}`}>Use cases</p>
            <h2 className={`text-3xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Built for those who need{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">concrete answers</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Building2, title: 'Business owner looking to sell', desc: 'Know exactly how much to ask before starting any sale negotiation.' },
              { icon: TrendingUp, title: 'Startup raising funds', desc: 'Present a professional and defensible valuation to investors and funds.' },
              { icon: Award, title: 'Accounting / Consulting', desc: 'Offer valuation as an additional service to your clients. Become a partner.' },
              { icon: Users, title: 'Looking to buy', desc: 'Evaluate the target company before making an offer and negotiate with real data.' },
            ].map((item, i) => (
              <div key={i} className={`rounded-2xl border p-6 transition-colors duration-200 ${isDark ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                  <item.icon className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────── */}
      <section id="como-funciona" className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>How it works</p>
            <h2 className={`text-3xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              4 steps to your valuation
            </h2>
          </div>

          <div className="space-y-0">
            {[
              { step: '01', title: 'Create your account', desc: 'Registration with email confirmation. Secure environment.', color: 'from-emerald-500 to-emerald-600' },
              { step: '02', title: 'Submit your financial data', desc: 'Manual entry or income statement upload in PDF/Excel. AI extracts and structures it automatically.', color: 'from-teal-500 to-emerald-500' },
              { step: '03', title: 'See the preview', desc: 'Receive key indicators before unlocking the report.', color: 'from-emerald-500 to-cyan-500' },
              { step: '04', title: 'Unlock the full report', desc: 'Choose the plan and receive the executive PDF by email.', color: 'from-teal-600 to-emerald-500' },
            ].map((item, i) => (
              <div key={i} className={`flex items-start gap-6 py-6 border-b last:border-0 ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                <div className={`flex-shrink-0 w-14 h-14 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                  <span className="text-white font-bold text-sm">{item.step}</span>
                </div>
                <div className="pt-1">
                  <h3 className={`font-semibold text-lg mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                  <p className={`leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ─── Antes e Depois ──────────────────────────────── */}
      <section className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Transformation</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              From the old way to the{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">right way</span>
            </h2>
            <p className={`max-w-xl mx-auto text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>The same quality as the best consulting firms — without the weeks of waiting and without the prohibitive cost.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 items-stretch">
            {/* ANTES */}
            <div className={`rounded-2xl border p-8 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-7 border ${isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-200'}`}>
                <X className="w-3 h-3" /> BEFORE — Traditional Consulting
              </div>
              <ul className="space-y-5">
                {[
                  { label: 'Timeframe', value: '3 to 8 weeks' },
                  { label: 'Cost', value: '$5,000 to $50,000' },
                  { label: 'Process', value: 'Meetings, interviews, approvals' },
                  { label: 'Delivery', value: 'Generic PDF, no contextual analysis' },
                  { label: 'Availability', value: 'Business hours, in-person' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                      <X className="w-3 h-3 text-red-400" />
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider block mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</span>
                      <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.value}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {/* DEPOIS */}
            <div className={`rounded-2xl border-2 p-8 relative ${isDark ? 'border-emerald-500/40 bg-slate-900' : 'border-emerald-400 bg-white shadow-sm'}`}>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-7 border ${isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                <CheckCircle className="w-3 h-3" /> NOW — Valuora
              </div>
              <ul className="space-y-5">
                {[
                  { label: 'Timeframe', value: 'Results in 5 minutes' },
                  { label: 'Cost', value: 'Starting at $990, one-time payment' },
                  { label: 'Process', value: 'Fill out the form. Done.' },
                  { label: 'Delivery', value: 'Up to 25 pages with AI strategic analysis' },
                  { label: 'Availability', value: '24/7, any device' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider block mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</span>
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.value}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Nossos Products ──────────────────────────────── */}
      <section className="py-24 md:py-32 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Our products</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Two tools to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
                value and present
              </span>{' '}
              your company
            </h2>
            <p className={`max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Professional valuation and pitch deck for investors — all in a single platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Valuation Card */}
            <div className={`relative group rounded-2xl border-2 p-8 transition-colors duration-200 ${isDark ? 'border-emerald-500/30 bg-slate-900 hover:border-emerald-500/50' : 'border-emerald-200 bg-white hover:border-emerald-400'}`}>
              <span className={`absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                CORE
              </span>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Valuation DCF</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Institutional engine + AI</p>
                </div>
              </div>
              <p className={`text-sm leading-relaxed mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Professional report of up to 25 pages with DCF, calibrated sector benchmark, risk analysis, strategic simulator, and AI narrative.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['DCF Gordon + Exit Multiple', 'Sector Benchmark', 'AI Analysis', 'Up to 25 pages'].map((f, i) => (
                  <span key={i} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    <CheckCircle className="w-3 h-3" />
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-bold text-2xl ${isDark ? 'text-white' : 'text-slate-900'}`}>$990</span>
                  <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>to $4,990</span>
                </div>
                <Link to="/register" className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:brightness-110 transition-all">
                  Start <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-3 mt-4">
                {[
                  { label: 'Sample Professional Valuation', href: '/sample-report-professional.pdf' },
                  { label: 'Sample Investor Ready', href: '/sample-report-investor-ready.pdf' },
                  { label: 'Sample Fundraising Package ★', href: '/sample-report-fundraising.pdf' },
                ].map(({ label, href }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 text-xs font-medium transition hover:underline ${
                      label.includes('★')
                        ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                        : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    {label} ↗
                  </a>
                ))}
              </div>
            </div>

            {/* Pitch Deck Card */}
            <div className={`relative group rounded-2xl border-2 p-8 transition-colors duration-200 ${isDark ? 'border-purple-500/30 bg-slate-900 hover:border-purple-500/50' : 'border-purple-200 bg-white hover:border-purple-400'}`}>
              <span className={`absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${isDark ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-600 border border-purple-200'}`}>
                NEW
              </span>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Pitch Deck</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>PDF ready for investors</p>
                </div>
              </div>
              <p className={`text-sm leading-relaxed mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Premium A4 landscape with visual TAM/SAM/SOM, 2×2 competitive matrix, revenue waterfall, KPI panel, 3 financial scenarios, team with photos, and AI narrative.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Landscape A4', 'TAM/SAM/SOM Visual', '2×2 Matrix', 'Waterfall + Scenarios', 'KPI Panel', 'AI Narrative'].map((f, i) => (
                  <span key={i} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium ${isDark ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                    <CheckCircle className="w-3 h-3" />
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-bold text-2xl ${isDark ? 'text-white' : 'text-slate-900'}`}>$897</span>
                  <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ one-time</span>
                </div>
                <Link to="/register" className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:brightness-110 transition-all">
                  Create <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <a
                href="/sample-pitchdeck.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 text-xs font-medium mt-4 transition hover:underline ${isDark ? 'text-purple-400/70 hover:text-purple-400' : 'text-purple-600/70 hover:text-purple-600'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                View pitch deck sample
                <ArrowRight className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────── */}
      <section id="recursos" className="py-24 md:py-32 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-teal-400/60' : 'text-teal-600/60'}`}>Features</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Tudo para{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
                evaluate and defend
              </span>{' '}
              o valor da your company
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: BarChart3, title: 'Complete DCF Valuation', desc: 'Estimated value with DCF Gordon + Exit Multiple, DLOM, and survival analysis.', gradient: 'from-emerald-500 to-emerald-600' },
              { icon: FileText, title: 'PDF Report Premium', desc: 'Institutional document with charts, projections, benchmark, and AI strategic analysis.', gradient: 'from-teal-600 to-emerald-500' },
              { icon: Zap, title: 'Interactive Simulator', desc: 'Change growth, margin, and discount rate. The valuation recalculates instantly.', gradient: 'from-teal-600 to-teal-400' },
              { icon: Eye, title: 'Strategic AI Analysis', desc: 'Narrative analysis with strategic recommendations generated by artificial intelligence.', gradient: 'from-teal-500 to-emerald-500' },
              { icon: GitCompareArrows, title: 'Compare Analyses', desc: 'Compare up to 4 companies side by side — valuation, risk, revenue, and multiples in a single panel.', gradient: 'from-cyan-500 to-teal-500', isNew: true },
              { icon: Target, title: 'Strategic Benchmark', desc: 'Find out if your margin, growth, and efficiency are above or below the market.', gradient: 'from-emerald-500 to-cyan-500' },
            ].map((item, i) => (
              <div key={i} className={`group relative rounded-2xl p-5 border transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-200 hover:shadow-lg'}`}>
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-gradient-to-br from-emerald-500/5 to-transparent' : 'bg-gradient-to-br from-emerald-50 to-transparent'}`} />
                {item.isNew && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white tracking-wide">NEW</span>
                )}
                <div className={`relative w-11 h-11 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center mb-3 shadow-lg`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className={`relative font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                <p className={`relative text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-3.5 rounded-xl text-sm font-semibold hover:brightness-110 transition-all"
            >
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <LazySection minHeight="2800px">
      {/* ─── Methodology (deep dive) ────────────────────── */}
      <section id="metodologia" className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Methodology</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              6 layers of analysis for a defensible valuation
            </h2>
            <p className={`text-lg max-w-3xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Combinamos <span className={isDark ? 'text-white font-medium' : 'text-slate-900 font-medium'}>three valuation methods</span> com{' '}
              <span className={isDark ? 'text-white font-medium' : 'text-slate-900 font-medium'}>three adjustment layers</span> — the same approach used by M&A consulting firms.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                icon: TrendingUp,
                title: 'DCF — Gordon Growth',
                badge: 'Weight by maturity',
                badgeColor: 'emerald',
                desc: 'Projects FCFE (flow to equity) for 10 years and calculates Terminal Value using the Gordon formula. Uses Ke (Valuora) as discount rate, with Damodaran sector beta and US Treasury risk-free rate.',
                tags: ['Projected FCFE', 'Terminal Value', 'Ke', 'Beta Valuora'],
              },
              {
                icon: BarChart3,
                title: 'DCF — Exit Multiple',
                badge: 'Weight by maturity',
                badgeColor: 'emerald',
                desc: "Same projected cash flow, but Terminal Value is calculated by applying a sector EV/EBITDA multiple to the last projected year's EBITDA. Reduces dependence on perpetual growth assumptions.",
                tags: ['EV/EBITDA', 'Terminal Value', 'Exit multiple', 'Projected EBITDA'],
              },
              {
                icon: PieChart,
                title: 'Sector Multiples',
                badge: 'Informational',
                badgeColor: 'emerald',
                desc: 'Informational valuation by sector EV/Revenue and EV/EBITDA, with real Damodaran/NYU Stern data. In v4, multiples do not compose the final value.',
                tags: ['EV/Revenue', 'EV/EBITDA', 'Damodaran', 'Informational'],
              },
              {
                icon: Lock,
                title: 'DLOM',
                badge: '10–35%',
                badgeColor: 'teal',
                desc: '10% to 35% discount for privately held companies (no market liquidity). Adjusted by size, maturity, and sector liquidity.',
                tags: ['Discount for Lack of Marketability', 'Privately held'],
              },
              {
                icon: Activity,
                title: 'Survival Rate',
                badge: 'BLS',
                badgeColor: 'teal',
                desc: "Discount based on the company's actual survival probability over the projection horizon, with BLS/SBA data and bonus for years of operation.",
                tags: ['Actual probability', 'Projection horizon'],
              },
              {
                icon: Target,
                title: 'Qualitative Score',
                badge: '±15%',
                badgeColor: 'teal',
                desc: 'Team, market, product, traction, and operations assessment. Adjusts ±15% of the final value based on non-financial risk factors.',
                tags: ['10 questions', '5 dimensions', 'Non-financial factors'],
              },
              {
                icon: Brain,
                title: 'QV Intelligence',
                badge: 'Proprietary AI',
                badgeColor: 'teal',
                desc: "After the DCF engine calculates all the numbers, QV Intelligence — our AI layer specialized in finance — interprets the results. Contextualizes the valuation in your sector, flags inconsistencies, compares with market benchmarks, and writes the report's Executive Summary, turning numbers into actionable insights.",
                tags: ['QV Intelligence', 'Executive Summary', 'Sector context', 'Risk analysis', 'Sector Benchmark'],
              },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border overflow-hidden transition ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  onClick={() => setOpenMethod(openMethod === i ? null : i)}
                  className={`w-full flex items-center justify-between px-5 py-4 text-left transition ${isDark ? 'hover:bg-slate-900/80' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 bg-gradient-to-br ${item.badgeColor === 'emerald' ? 'from-emerald-500 to-teal-500' : 'from-teal-500 to-emerald-500'} rounded-lg flex items-center justify-center shadow`}>
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full hidden sm:inline ${
                      item.badgeColor === 'emerald'
                        ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                        : (isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600')
                    }`}>{item.badge}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ml-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} ${openMethod === i ? 'rotate-180' : ''}`} />
                </button>
                {openMethod === i && (
                  <div className={`px-5 pb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <p className="text-sm leading-relaxed mb-3">{item.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tag, j) => (
                        <span key={j} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pipeline summary */}
          <div className={`mt-8 rounded-2xl p-5 border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-emerald-50/60 border-emerald-100'}`}>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm">
              {[
                { label: 'DCF Gordon', color: 'emerald' },
                { label: 'DCF Exit Multiple', color: 'emerald' },
                { label: 'Multiples', color: 'emerald' },
                { label: 'DLOM', color: 'teal' },
                { label: 'Survival', color: 'teal' },
                { label: 'Qualitative', color: 'teal' },
                { label: 'QV Intelligence', color: 'blue' },
                { label: 'Final Equity', color: 'emerald' },
              ].map((step, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className={`whitespace-nowrap font-medium px-3 py-1 rounded-lg ${
                    step.color === 'emerald' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700') :
                    step.color === 'teal' ? (isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-100 text-teal-700') :
                    (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                  }`}>{step.label}</span>
                  {i < 7 && <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />}
                </span>
              ))}
            </div>
            <p className={`text-xs text-center mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Result: a technical, consistent, and <span className="font-semibold">defensible</span>.
            </p>
          </div>

        </div>
      </section>

      {/* ─── Plans ─────────────────────────────────────── */}
      <section id="planos" className="py-24 md:py-32 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Pricing</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>One-time payment. No subscription.</h2>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Secure payment via Stripe</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-6 items-stretch">
            {[
              {
                name: 'Professional Valuation', price: '$990', desc: 'Complete DCF Valuation',
                pages: '~8 pages', installment12: '83',
                samplePdf: '/sample-report-professional.pdf',
                features: ['DCF Gordon Growth Valuation', 'Risk and maturity score', 'Conservative / base / optimistic scenarios', 'Basic executive report', 'Email delivery'],
                popular: false,
              },
              {
                name: 'Investor Ready', price: '$2,490', desc: 'Complete analysis with benchmark',
                pages: '~15 pages', installment12: '208',
                samplePdf: '/sample-report-investor-ready.pdf',
                features: ['Everything in Professional Valuation', 'DCF Exit Multiple + Multiples', 'Official sector benchmark', 'DLOM + Survival + P&L', 'Revenue and FCFE Projection', 'Sensitivity table', 'Control premium / minority discount'],
                popular: false,
              },
              {
                name: 'Fundraising Package', price: '$4,990', desc: 'Maximum level of analysis',
                pages: '~25 pages', installment12: '416',
                samplePdf: '/sample-report-fundraising.pdf',
                features: ['Everything in Investor Ready', 'Tornado Chart — value drivers', 'Monte Carlo (2,000 simulations)', 'Qualitative assessment + dimension radar', 'Exit Strategy Analysis', 'M&A Risk Matrix', 'Value Enhancement Plan (AI)', 'Opinion of Value Letter', 'Investment round simulation', 'Complete strategic analysis by AI'],
                popular: true,
              },
            ].map((plan, i) => (
              <div key={i} className={`relative rounded-2xl border-2 transition-colors duration-200 flex flex-col ${
                plan.popular
                  ? isDark
                    ? 'border-emerald-500 bg-slate-900'
                    : 'border-emerald-500 bg-white'
                  : isDark ? 'border-slate-800 hover:border-slate-700 bg-slate-900' : 'border-slate-200 hover:border-emerald-200 bg-white'
              }`}>
                {plan.popular && (
                  <div className={`text-center py-2 text-xs font-semibold uppercase tracking-wider rounded-t-xl ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                    Recommended
                  </div>
                )}
                <div className={`flex flex-col flex-1 p-8 ${plan.popular ? 'pt-6' : ''}`}>
                  <h3 className={`font-semibold text-lg ${plan.popular ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-white' : 'text-slate-900')}`}>{plan.name}</h3>
                  <p className={`text-sm mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{plan.desc}</p>
                  <div className="mb-1">
                    <span className={`font-bold text-4xl ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                    <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ one-time</span>
                  </div>
                  <p className={`text-xs mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    or <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>12× of ${plan.installment12}</span> on credit card*
                  </p>
                  <p className={`text-xs font-medium mb-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>PDF Report with {plan.pages}</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className={`flex items-center gap-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${plan.popular ? 'text-emerald-400' : 'text-emerald-500'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className={`block text-center rounded-xl font-semibold text-sm py-3.5 transition-all mt-auto ${
                    plan.popular
                      ? 'bg-emerald-600 text-white hover:brightness-110'
                      : `border ${isDark ? 'border-slate-700 text-white hover:border-emerald-500/50' : 'border-slate-300 text-slate-900 hover:border-emerald-400'}`
                  }`}>
                    START VALUATION
                  </Link>
                  <a
                    href={plan.samplePdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-1.5 text-xs font-medium mt-3 transition hover:underline ${
                      plan.popular
                        ? isDark ? 'text-emerald-400/80 hover:text-emerald-400' : 'text-emerald-600/80 hover:text-emerald-600'
                        : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    View report sample ↗
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Satisfaction guarantee */}
          <p className={`text-center text-sm mt-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Satisfaction guaranteed · Secure payment · Email support
          </p>
          <p className={`text-center text-xs mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            * Installment plans subject to interest and fees from the card issuer. PIX and bank slip interest-free.
          </p>

          {/* Trust & payment badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-6">
            {[
              { icon: Lock,         label: 'Secure SSL' },
              { icon: Shield,       label: 'LGPD Compliant' },
              { icon: FileText,     label: 'Powered by Stripe' },
              { icon: CheckCircle,  label: 'One-Time Payment' },
              { icon: Clock,        label: 'No Subscription' },
            ].map((b, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <b.icon className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-500/60' : 'text-emerald-500/70'}`} />
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Partners ───────────────────────────────────── */}
      <section id="partners" className="py-24 md:py-32 relative">
        {isDark && (
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[300px] bg-teal-600/5 rounded-full blur-[100px]" />
        )}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Partners</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Turn referrals into revenue
            </h2>
            <p className={`max-w-2xl mx-auto text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Ideal for accounting firms, consulting firms, and advisory firms that want to offer <strong>professional valuation and pitch deck for investors</strong> as an additional service — and earn 50% of each sale.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { icon: DollarIcon, title: '50% — Valuation and Pitch Deck', desc: 'Commission on both products. Every sale — valuation or pitch deck — you earn half. No earnings cap.' },
              { icon: Users, title: 'Complete management', desc: 'Exclusive dashboard to track clients, status, and commissions in real time.' },
              { icon: Briefcase, title: 'Your portfolio grows', desc: 'Offer valuation and investor pitch deck without investing in a team or technology.' },
              { icon: TrendingUp, title: 'Referral link', desc: 'Share your link. Every signup is tracked automatically.' },
            ].map((item, i) => (
              <div key={i} className={`rounded-2xl border p-6 transition-colors duration-200 ${isDark ? 'bg-slate-900/50 border-slate-800 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                  <item.icon className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* How it works partner */}
          <div className={`rounded-2xl border p-8 md:p-10 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className={`text-lg font-bold mb-6 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>How it works</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Sign up as a partner', desc: 'Create your account and activate Partner Mode in seconds. You receive an exclusive referral link.' },
                { step: '02', title: 'Refer your clients', desc: 'Share your link or register clients directly on the dashboard. Every valuation or pitch deck is tracked automatically.' },
                { step: '03', title: 'Receive your commissions', desc: 'For every confirmed payment — whether valuation or pitch deck — 50% is automatically credited to your account.' },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-sm font-bold mb-4">{s.step}</div>
                  <h4 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.title}</h4>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA partner */}
          <div className={`rounded-3xl border-2 p-10 md:p-14 mt-12 text-center relative overflow-hidden ${isDark ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-teal-500/10' : 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50'}`}>
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6 ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                <DollarIcon className="w-3.5 h-3.5" />
                50% COMMISSION
              </div>
              <h3 className={`text-3xl md:text-4xl font-semibold tracking-tight mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                We split
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400"> 50/50</span>
              </h3>
              <p className={`text-lg md:text-xl mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Every sale you refer, <strong className="text-emerald-500">half is yours</strong>.
              </p>
              <p className={`text-sm mb-8 max-w-xl mx-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Professional valuation (<strong>$990+</strong>) or Pitch Deck para investidores (<strong>$897</strong>).<br />
                You refer, the client pays, and the money goes into your account via PIX. No earnings cap.
              </p>
              <Link
                to="/partner/register"
                className="group inline-flex items-center gap-3 bg-emerald-600 text-white px-10 py-5 rounded-2xl text-lg font-semibold hover:brightness-110 transition-all"
              >
                <Briefcase className="w-6 h-6" />
                I want to be a partner and earn 50%
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <p className={`text-xs mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                ✓ Sign up in 30 seconds &nbsp; ✓ Exclusive link &nbsp; ✓ Dashboard with full analytics
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Objeções Diretas ─────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Straight to the point</p>
            <h2 className={`text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>What's stopping you from starting now?</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                q: 'Is my company too small?',
                a: 'No company is too small for a valuation. The engine calibrates by your sector and maturity — from sole proprietors to companies with $50M in revenue.',
              },
              {
                q: 'Do I need an accountant to use it?',
                a: 'Not at all. The form is guided. If you know your annual revenue and approximate margin, you can finish in under 5 minutes.',
              },
              {
                q: "I've never done a valuation. Is this for me?",
                a: 'Exactly for you. The report was designed for any business owner — every indicator is explained in plain language, no jargon.',
              },
              {
                q: 'Will investors accept this report?',
                a: 'Yes. It follows standard M&A DCF methodology — full calculation methodology, sector benchmark, and sensitivity analysis included.',
              },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border p-5 ${isDark ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-300'} transition-colors`}>
                <p className={`font-semibold text-sm mb-2 flex items-start gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                  {item.q}
                </p>
                <p className={`text-sm leading-relaxed pl-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Perguntas Frequentes ──────────────────────────── */}
      <section className="py-24 md:py-32 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Frequently asked questions</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>FAQ</h2>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Everything you need to know before getting started</p>
          </div>
          <div className="space-y-2">
            {[
              {
                icon: Lock,
                color: 'emerald',
                q: 'Is my valuation confidential?',
                a: 'Yes. Your financial data is encrypted end-to-end and never shared with third parties. Full LGPD compliance.',
              },
              {
                icon: TrendingUp,
                color: 'teal',
                q: 'Can it be used to raise investment?',
                a: 'Yes. The report uses the same DCF methodology as M&A consulting firms, with calculation methodology, assumptions, and sector benchmark — ready to present to investors and funds.',
              },
              {
                icon: Clock,
                color: 'emerald',
                q: 'How soon do I receive the results?',
                a: 'The valuation is generated in minutes. After payment, the full PDF report is sent to your email automatically.',
              },
              {
                icon: Building2,
                color: 'teal',
                q: 'Can I use it to negotiate the sale of my company?',
                a: 'Absolutely. The report includes a value range, pessimistic/optimistic scenarios, and sector benchmark — documentation that strengthens your position in any negotiation.',
              },
              {
                icon: DollarIcon,
                color: 'emerald',
                q: 'Is the payment recurring?',
                a: 'No. It is a one-time payment per analysis. No subscription, no recurring fees. Credit card, wire transfer, or invoice.',
              },
              {
                icon: Database,
                color: 'teal',
                q: 'Where does the sector data come from?',
                a: 'Proprietary sector database with 50+ industry segments, calibrated with Damodaran methodology and regularly updated market data.',
              },
            ].map((faq, i) => {
              const colorMap = {
                emerald: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200',
                teal: isDark ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-teal-50 text-teal-600 border-teal-200',
              };
              const isOpen = openFaq === i;
              return (
                <div key={i} className={`rounded-xl border overflow-hidden transition-all ${isOpen ? (isDark ? 'border-emerald-500/30 bg-slate-900' : 'border-emerald-200 bg-emerald-50/20') : (isDark ? 'border-slate-800 hover:border-slate-700' : 'border-slate-200 hover:border-slate-300')}`}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition ${isDark ? 'hover:bg-slate-900/80' : 'hover:bg-slate-50/80'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${colorMap[faq.color]}`}>
                      <faq.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className={`font-medium text-sm flex-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'} ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className={`px-5 pb-5 pl-[72px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      <p className="text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      </LazySection>

      {/* ─── CTA Final ───────────────────────────────────── */}
      <section className="py-24 md:py-32 relative">
        {isDark ? (
          <>
            <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-600/10 rounded-full blur-[120px]" />
          </>
        ) : (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-100/60 rounded-full blur-[120px]" />
        )}

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className={`text-3xl md:text-4xl font-semibold tracking-tight mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            You built your company.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
              Now find out what it's really worth.
            </span>
          </h2>
          <p className={`mb-6 text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Professional valuation. Based on official data. In minutes.
          </p>
          <div>
            <Link to="/register" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:brightness-110 transition-all">
              Start valuation
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            No subscription · Results in minutes
          </p>
        </div>
      </section>

      {/* ─── Diagnóstico Modal ───────────────────────────── */}
      <DiagnosticoModal isOpen={diagnosticoOpen} onClose={() => setDiagnosticoOpen(false)} />

      {/* ─── Footer ──────────────────────────────────────── */}
      <footer className={`py-16 pb-24 md:pb-16 border-t ${isDark ? 'border-slate-800/50 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
        <div className="max-w-6xl mx-auto px-6">
          {/* 4-column grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Column 1: Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/favicon.svg?v=2" alt="Valuora" className="w-7 h-7" />
                <span className={`font-semibold text-base tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Valuora<sup className="text-[8px] ml-0.5 opacity-50">®</sup>
                </span>
              </div>
              <p className={`text-sm leading-relaxed mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Professional valuation with DCF methodology and calibrated sector benchmarks.
              </p>
              <div className="flex items-center gap-2">
                <a
                  href="https://instagram.com/valuora.online"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className={`p-2 rounded-lg transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
                >
                  <Instagram className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Column 2: Product */}
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Product</h4>
              <ul className="space-y-2">
                {[
                  { label: 'Valuation DCF', href: '#planos' },
                  { label: 'Pitch Deck', href: '#planos' },
                  { label: 'Methodology', href: '#metodologia' },
                  { label: 'Features', href: '#recursos' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className={`text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Legal */}
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Legal</h4>
              <ul className="space-y-2">
                {[
                  { label: 'Terms of Use', to: '/terms-of-use' },
                  { label: 'Privacy Policy', to: '/privacy-policy' },
                ].map(({ label, to }) => (
                  <li key={label}>
                    <Link to={to} className={`text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Contact */}
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Contact</h4>
              <ul className="space-y-2">
                <li>
                  <a href="mailto:contact@valuora.online" className={`flex items-center gap-1.5 text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
                    <Mail className="w-3.5 h-3.5" />
                    contact@valuora.online
                  </a>
                </li>
                <li>
                  <Link to="/partner/register" className={`text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>Become a Partner</Link>
                </li>
                <li>
                  <Link to="/partner/login" className={`text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>Partner Login</Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className={`pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              &copy; {new Date().getFullYear()} Valuora. All rights reserved.
            </p>
            <div className={`flex items-center gap-4 text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                LGPD
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                SSL
              </div>
            </div>
          </div>
        </div>
      </footer>
      {/* M6: Mobile bottom sticky CTA bar */}
      <div className={`sm:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe pt-3 border-t backdrop-blur-xl ${
        isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'
      }`} style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <Link
          to="/register"
          className={`flex items-center justify-between w-full px-5 py-3.5 rounded-xl text-sm font-semibold transition-all ${
            heroProduct === 'pitch'
              ? 'bg-purple-600 text-white hover:brightness-110'
              : 'bg-emerald-600 text-white hover:brightness-110'
          }`}
        >
          <span>{heroProduct === 'pitch' ? 'Create my pitch deck' : 'Start valuation'}</span>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-normal opacity-80`}>{heroProduct === 'pitch' ? '$897' : 'starting at $990'}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      <WhatsAppButton />
    </div>
  );
}
