import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ArrowRight, BarChart3, Shield, FileText, TrendingUp,
  Zap, Target, Mail, ChevronRight, Lock,
  Cpu, Database, LineChart, CheckCircle, Activity,
  Building2, Users, Award, Clock, Eye, Briefcase,
  ChevronDown, PieChart, Menu, X, DollarSign as DollarIcon,
  Instagram, Brain, GitCompareArrows, Globe,
  Layers, Dice1, Leaf, Gauge, BarChart2,
} from 'lucide-react';
import CountUp from '../components/CountUp';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSwitcher from '../components/LanguageSwitcher';
import DiagnosticoModal from '../components/DiagnosticoModal';
import WhatsAppButton from '../components/WhatsAppButton';
import LazySection from '../components/LazySection';
import EmeraldParticles from '../components/EmeraldParticles';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import { useI18n } from '../lib/i18n';

export default function LandingPage() {
  usePageTitle(null);
  const { isDark } = useTheme();
  const { t } = useI18n();
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
  const TW_TARGET = t('hero_typewriter');
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

  // F5: Schema.org structured data — now served statically from index.html
  // (removed dynamic injection to avoid duplicate/conflicting ld+json blocks)

  return (
    <div className={`min-h-screen overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>

      {/* ─── Navbar — Minimal Pro ─────────────────────────── */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-all duration-300 ${scrolled ? 'shadow-sm' : ''} ${isDark ? 'bg-slate-950/80 border-slate-800/50' : 'bg-white/80 border-slate-200'}`}>
        <div className={`max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-[auto_1fr_auto] items-center transition-all duration-300 ${scrolled ? 'h-14' : 'h-16'}`}>

          {/* Left — Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src="/favicon.svg?v=2" alt="Valuora" className={`transition-all duration-300 ${scrolled ? 'w-7 h-7' : 'w-8 h-8'}`} />
            <span className={`font-semibold text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Valuora<sup className="text-[9px] ml-0.5 opacity-50">®</sup>
            </span>
          </Link>

          {/* Center — Nav links (desktop) */}
          <div className="hidden md:flex items-center justify-center gap-1">
            {[
              { href: '#como-funciona', id: 'como-funciona', label: t('nav_how_it_works') },
              { href: '#recursos',      id: 'recursos',      label: t('nav_features') },
              { href: '#planos',        id: 'planos',        label: t('nav_plans') },
              { href: '#metodologia',   id: 'metodologia',   label: t('nav_methodology') },
              { href: '#partners',      id: 'partners',      label: t('nav_partners') },
            ].map(({ href, id, label }) => (
              <a
                key={id}
                href={href}
                className={`relative px-3 py-1.5 text-xs font-medium uppercase tracking-widest transition-colors duration-200 group ${
                  activeSection === id
                    ? isDark ? 'text-white' : 'text-slate-900'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {label}
                {/* Animated underline */}
                <span className={`absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-[2px] rounded-full transition-all duration-300 ${
                  activeSection === id
                    ? 'w-4/5 bg-emerald-500'
                    : 'w-0 group-hover:w-3/5 bg-emerald-500/60'
                }`} />
              </a>
            ))}
          </div>

          {/* Right — Actions */}
          <div className="flex items-center gap-1.5 md:gap-2 justify-end">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              to="/login"
              className={`hidden md:inline-flex items-center text-xs font-medium tracking-wide transition-colors duration-200 px-3 py-2 rounded-lg ${
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t('nav_sign_in')}
            </Link>
            <Link
              to="/register"
              className="hidden sm:inline-flex items-center bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-all duration-200 shadow-sm shadow-emerald-600/20"
            >
              {t('nav_start_valuation')}
            </Link>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className={`md:hidden p-2.5 rounded-lg transition-colors duration-200 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileNavOpen ? 'max-h-[420px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className={`border-t px-4 py-3 space-y-0.5 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
            {[
              { href: '#como-funciona', label: t('nav_how_it_works') },
              { href: '#recursos', label: t('nav_features') },
              { href: '#planos', label: t('nav_plans') },
              { href: '#metodologia', label: t('nav_methodology') },
              { href: '#partners', label: t('nav_partners') },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {item.label}
              </a>
            ))}
            <div className={`h-px my-2 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <Link
              to="/login"
              onClick={() => setMobileNavOpen(false)}
              className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {t('nav_sign_in')}
            </Link>
            <Link
              to="/partner/login"
              onClick={() => setMobileNavOpen(false)}
              className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-emerald-400 hover:bg-slate-800' : 'text-emerald-600 hover:bg-emerald-50'}`}
            >
              {t('nav_login_partner')}
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileNavOpen(false)}
              className="block text-center bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-all mt-1"
            >
              {t('nav_start_valuation')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Barra fixa ──────────────────────────────────── */}
      {showStickyBar && (
        <div className={`fixed ${scrolled ? 'top-14' : 'top-16'} left-0 right-0 z-40 flex items-center justify-center gap-3 py-2 text-xs font-medium backdrop-blur-xl border-b transition-all ${
          isDark ? 'bg-slate-900/95 border-slate-800 text-slate-400' : 'bg-white/95 border-slate-200 text-slate-600'
        }`}>
          <span className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('sticky_valuation_from')}</span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
          <span className={`font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{t('sticky_pitch_deck_price')}</span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
          <span>{t('sticky_one_time')}</span>
          <Link to="/register" className="ml-1 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600 text-white hover:brightness-110 transition">
            {t('sticky_start')}
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
              {t('hero_valuation_dcf')}
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
              {t('hero_pitch_deck')}
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>{t('hero_new_badge')}</span>
            </button>
          </div>

          <h1 className={`text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1] mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('hero_how_much_is')}
            <br />
            <span className={`text-transparent bg-clip-text bg-gradient-to-r ${heroProduct === 'pitch' ? 'from-purple-500 to-indigo-400' : 'from-emerald-500 to-teal-400'} transition-all duration-500`}>{t('hero_your_company_worth')}</span>
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
                  {t('hero_val_subtitle')}
                </p>

                {/* M2: swipe strip on mobile */}
                <div className="flex overflow-x-auto snap-x gap-3 mb-8 -mx-6 px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:mx-0 sm:px-0 sm:overflow-visible sm:justify-center lg:justify-start">
                  {[
                    { icon: Cpu,      label: t('hero_val_badge_dcf'),    border: 'emerald' },
                    { icon: Brain,    label: t('hero_val_badge_ai'), border: 'teal' },
                    { icon: FileText, label: t('hero_val_badge_report'),        border: 'emerald' },
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
                    {t('hero_val_cta_start')}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <button
                    onClick={() => setDiagnosticoOpen(true)}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-medium transition-colors duration-200 px-6 py-4 rounded-xl border ${isDark ? 'border-slate-700 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400' : 'border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-600'}`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    {t('hero_val_cta_diagnostic')}
                  </button>
                </div>
                <p className={`text-xs mb-4 text-center lg:text-left ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('hero_val_subtext')}
                </p>
                <div className={`lg:hidden flex items-center gap-3 mb-8 p-4 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <FileText className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('hero_val_report_samples')}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {[
                        { label: t('hero_val_sample_professional'), href: '/sample-report-professional.pdf' },
                        { label: t('hero_val_sample_advanced'), href: '/sample-report-investor-ready.pdf' },
                        { label: t('hero_val_sample_complete'), href: '/sample-report-fundraising.pdf' },
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
                  {t('hero_pitch_subtitle')}
                </p>

                {/* M2: swipe strip on mobile */}
                <div className="flex overflow-x-auto snap-x gap-3 mb-8 -mx-6 px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:mx-0 sm:px-0 sm:overflow-visible sm:justify-center lg:justify-start">
                  {[
                    { icon: Brain,    label: t('hero_pitch_badge_ai'),           color: 'purple' },
                    { icon: LineChart, label: t('hero_pitch_badge_waterfall'),    color: 'indigo' },
                    { icon: Target,   label: t('hero_pitch_badge_tam'),         color: 'purple' },
                    { icon: FileText, label: t('hero_pitch_badge_design'), color: 'indigo' },
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
                    {t('hero_pitch_cta_create')}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <button
                    onClick={() => setHeroProduct('valuation')}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-medium transition-colors duration-200 px-6 py-4 rounded-xl border ${isDark ? 'border-slate-700 text-slate-300 hover:border-purple-500/50 hover:text-purple-400' : 'border-slate-300 text-slate-600 hover:border-purple-400 hover:text-purple-600'}`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    {t('hero_pitch_cta_see_dcf')}
                  </button>
                </div>
                <p className={`text-xs mb-4 text-center lg:text-left ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('hero_pitch_subtext')}
                </p>
                <div className={`lg:hidden flex items-center gap-3 mb-8 p-4 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                    <Briefcase className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('hero_pitch_sample_title')}</p>
                    <a
                      href="/sample-pitchdeck.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs font-medium hover:underline ${isDark ? 'text-purple-400' : 'text-purple-600'}`}
                    >
                      {t('hero_pitch_view_pdf')}
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Trust badges — M4: 2×2 grid on mobile, single row on sm+ */}
          <div className={`grid grid-cols-2 sm:inline-flex sm:items-center sm:justify-center lg:justify-start gap-3 sm:gap-6 md:gap-8 px-5 py-4 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            {[
              { icon: Shield,   label: t('trust_data_protection') },
              { icon: Lock,     label: t('trust_ssl') },
              { icon: Cpu,      label: t('trust_dcf') },
              { icon: Database, label: t('trust_benchmarks') },
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
                      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${isDark ? 'text-purple-400/70' : 'text-purple-500'}`}>{t('mock_pitch_label')}</p>
                      <div className="flex justify-between items-end">
                        <p className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('mock_pitch_round')}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>{t('mock_pitch_slides')}</span>
                      </div>
                    </div>
                    <div className={`rounded-xl p-4 border ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-white'}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('mock_market_size')}</p>
                      <div className="flex items-end gap-4 justify-center">
                        <div className="text-center">
                          <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center mx-auto ${isDark ? 'border-purple-400/40 bg-purple-500/10' : 'border-purple-300 bg-purple-50'}`}>
                            <span className={`text-[9px] font-bold leading-tight text-center ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>TAM<br/>$4.2B</span>
                          </div>
                          <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('mock_tam_total')}</p>
                        </div>
                        <div className="text-center">
                          <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center mx-auto ${isDark ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-indigo-200 bg-indigo-50'}`}>
                            <span className={`text-[9px] font-bold leading-tight text-center ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>SAM<br/>$820M</span>
                          </div>
                          <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('mock_sam_addressable')}</p>
                        </div>
                        <div className="text-center">
                          <div className={`w-9 h-9 rounded-full border-4 flex items-center justify-center mx-auto ${isDark ? 'border-pink-400/40 bg-pink-500/10' : 'border-pink-200 bg-pink-50'}`}>
                            <span className={`text-[9px] font-bold text-center ${isDark ? 'text-pink-300' : 'text-pink-700'}`}>SOM</span>
                          </div>
                          <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('mock_som_obtainable')}</p>
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
                      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>{t('mock_val_equity_label')}</p>
                      <div className="flex justify-between items-end">
                        <p className={`font-bold text-2xl ${isDark ? 'text-white' : 'text-slate-900'}`}>$4.2M</p>
                        <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('mock_val_range')}</span>
                      </div>
                      <div className={`h-2 rounded-full mt-2 ${isDark ? 'bg-slate-700' : 'bg-emerald-100'}`}>
                        <div className="h-full w-[52%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 ml-[24%]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[[t('mock_val_risk_score'),'72/100',0],[t('mock_val_maturity'),'8,4/10',1],[t('mock_val_percentile'),'68%',2]].map(([l,v,ci],i) => (
                        <div key={i} className={`rounded-lg border p-2.5 ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-white'}`}>
                          <p className={`text-[9px] font-semibold uppercase mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{l}</p>
                          <p className={`text-sm font-bold ${ci===0 ? (isDark?'text-emerald-400':'text-emerald-600') : ci===1 ? (isDark?'text-teal-400':'text-teal-600') : (isDark?'text-cyan-400':'text-cyan-600')}`}>{v}</p>
                        </div>
                      ))}
                    </div>
                    <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-white'}`}>
                      <p className={`text-[9px] font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('mock_val_fcfe_proj')}</p>
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
                        <Brain className="w-3 h-3" /> {t('badge_ai_narrative')}
                      </div>
                      <div className={`absolute top-[145px] left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-indigo-950/95 border-indigo-500/50 text-indigo-300' : 'bg-white border-indigo-300 text-indigo-700 shadow-indigo-100'}`}>
                        <Target className="w-3 h-3" /> {t('badge_tam_sam_som')}
                      </div>
                      <div className={`absolute bottom-4 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-slate-800/95 border-slate-600/60 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <BarChart3 className="w-3 h-3" /> {t('badge_kpi_panel')}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-300' : 'bg-white border-emerald-300 text-emerald-700 shadow-emerald-100'}`}>
                        <TrendingUp className="w-3 h-3" /> {t('badge_dcf_gordon')}
                      </div>
                      <div className={`absolute top-[120px] right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-teal-950/95 border-teal-500/50 text-teal-300' : 'bg-white border-teal-300 text-teal-700 shadow-teal-100'}`}>
                        <Database className="w-3 h-3" /> {t('badge_sector_benchmark')}
                      </div>
                      <div className={`absolute bottom-10 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-cyan-950/95 border-cyan-500/50 text-cyan-300' : 'bg-white border-cyan-300 text-cyan-700 shadow-cyan-100'}`}>
                        <LineChart className="w-3 h-3" /> {t('badge_5yr_projection')}
                      </div>
                      <div className={`absolute bottom-3 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-lg ${isDark ? 'bg-slate-800/95 border-slate-600/60 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <Brain className="w-3 h-3" /> {t('badge_ai_analysis')}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 mt-6">
              <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {heroProduct === 'pitch' ? `${t('hero_pitch_sample_title')} · ${t('mock_pitch_slides')} · premium design` : `${t('hero_val_report_samples')} · ~42 pages · ready after filling out`}
              </p>
              {heroProduct !== 'pitch' ? (
                <div className="flex gap-3">
                  {[
                    { label: t('hero_val_sample_professional'), href: '/sample-report-professional.pdf' },
                    { label: t('hero_val_sample_advanced'), href: '/sample-report-investor-ready.pdf' },
                    { label: t('hero_val_sample_complete'), href: '/sample-report-fundraising.pdf' },
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
                  {t('mock_open')}
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
            {t('strip_engine_active')}
          </span>
          <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{t('strip_updated_on')} <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>March 2026</span></span>
          <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{t('strip_treasury')} <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>4.25%</span></span>
          <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{t('strip_beta_damodaran')} <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>2026</span></span>
          <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}><CountUp end={52} duration={900} className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`} /> {t('strip_sectors')}</span>
          <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}><CountUp end={14} suffix="+" duration={900} className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`} /> {t('strip_methods')}</span>
        </div>
      </div>

      {/* ─── Credibilidade ──────────────────────────────── */}
      <section className={`py-10 ${isDark ? 'bg-slate-900/40' : 'bg-slate-50'}`}>
        <div className="max-w-5xl mx-auto px-6">
          <p className={`text-center text-xs font-semibold uppercase tracking-widest mb-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('cred_title')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {[
              { icon: Shield,   label: t('trust_data_protection') },
              { icon: Lock,     label: t('cred_ssl') },
              { icon: Cpu,      label: t('cred_certified_dcf') },
              { icon: Database, label: t('cred_benchmarks') },
              { icon: Globe,    label: t('cred_damodaran') },
            ].map(({ icon: Icon, label }, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <Icon className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
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
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>{t('compare_label')}</p>
            <h2 className={`text-2xl md:text-3xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('compare_title_why')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Valuora</span>{' '}
              {t('compare_title_different')}
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
                <span className={`font-semibold text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('compare_traditional')}</span>
              </div>
            </div>

            {[
              { label: t('compare_time'),        qv: t('compare_time_qv'),          cons: t('compare_time_cons') },
              { label: t('compare_cost'),        qv: t('compare_cost_qv'),           cons: t('compare_cost_cons') },
              { label: t('compare_methods'),     qv: t('compare_methods_qv'),        cons: t('compare_methods_cons') },
              { label: t('compare_complexity'),  qv: t('compare_complexity_qv'),     cons: t('compare_complexity_cons') },
              { label: t('compare_report'),      qv: t('compare_report_qv'),         cons: t('compare_report_cons') },
              { label: t('compare_montecarlo'),  qv: t('compare_montecarlo_qv'),     cons: t('compare_montecarlo_cons') },
              { label: t('compare_available'),   qv: t('compare_available_qv'),      cons: t('compare_available_cons') },
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
              {t('compare_cta')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Problema → Solução ───────────────────────────── */}
      <section className="py-16 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-5xl mx-auto px-6">
          {/* Problem statement */}
          <div className="text-center mb-12">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-red-400/60' : 'text-red-500/60'}`}>{t('problem_label')}</p>
            <h2 className={`text-3xl md:text-4xl font-semibold tracking-tight mb-6 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('problem_title')}{' '}
              <span className="text-red-400">{t('problem_asymmetry')}</span>
            </h2>
            <div className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {[t('problem_case_stake'), t('problem_case_partner'), t('problem_case_fundraising'), t('problem_case_exit')].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className={`max-w-2xl mx-auto leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('problem_desc')}
            </p>
          </div>

          {/* Solution — 3 pillars */}
          <div className="text-center mb-8">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>{t('solution_label')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Cpu,
                title: t('solution_engine_title'),
                desc: t('solution_engine_desc'),
                tag: t('solution_engine_tag'),
              },
              {
                icon: Database,
                title: t('solution_bench_title'),
                desc: t('solution_bench_desc'),
                tag: t('solution_bench_tag'),
              },
              {
                icon: FileText,
                title: t('solution_report_title'),
                desc: t('solution_report_desc'),
                tag: t('solution_report_tag'),
              },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border p-8 text-center transition-all duration-200 ${isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:shadow-lg hover:shadow-black/10' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60'}`}>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <item.icon className={`w-6 h-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-md mb-4 inline-block ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{item.tag}</span>
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
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-teal-400/60' : 'text-teal-600/60'}`}>{t('use_cases_label')}</p>
            <h2 className={`text-3xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('use_cases_title_prefix')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">{t('use_cases_title_highlight')}</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Building2, title: t('use_case_sell_title'), desc: t('use_case_sell_desc') },
              { icon: TrendingUp, title: t('use_case_raise_title'), desc: t('use_case_raise_desc') },
              { icon: Award, title: t('use_case_accounting_title'), desc: t('use_case_accounting_desc') },
              { icon: Users, title: t('use_case_buy_title'), desc: t('use_case_buy_desc') },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border p-6 transition-all duration-200 ${isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:shadow-lg hover:shadow-black/10' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <item.icon className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
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
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>{t('hiw_label')}</p>
            <h2 className={`text-3xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('hiw_title')}
            </h2>
          </div>

          <div className="space-y-0">
            {[
              { step: '01', title: t('hiw_step1_title'), desc: t('hiw_step1_desc'), color: 'from-emerald-500 to-emerald-600' },
              { step: '02', title: t('hiw_step2_title'), desc: t('hiw_step2_desc'), color: 'from-teal-500 to-emerald-500' },
              { step: '03', title: t('hiw_step3_title'), desc: t('hiw_step3_desc'), color: 'from-emerald-500 to-cyan-500' },
              { step: '04', title: t('hiw_step4_title'), desc: t('hiw_step4_desc'), color: 'from-teal-600 to-emerald-500' },
            ].map((item, i) => (
              <div key={i} className={`flex items-start gap-6 py-6 border-b last:border-0 ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                  <span className={`font-bold text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{item.step}</span>
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


      {/* ─── Before vs After — compact strip ────────────── */}
      <section className={`py-16 ${isDark ? '' : ''}`}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className={`text-2xl md:text-3xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('transform_title_prefix')}{' '}
              <span className={`${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('transform_title_highlight')}</span>
            </h2>
          </div>
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            {/* Header row */}
            <div className={`grid grid-cols-[1fr_1fr_1fr] text-xs font-semibold uppercase tracking-wider ${isDark ? 'bg-slate-900 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
              <div className="px-5 py-3" />
              <div className={`px-5 py-3 text-center border-x ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>{t('before_tag')}</div>
              <div className={`px-5 py-3 text-center ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('after_tag')}</div>
            </div>
            {/* Data rows */}
            {[
              { label: t('before_timeframe'), before: t('before_timeframe_val'), after: t('after_timeframe_val') },
              { label: t('compare_cost'), before: t('before_cost_val'), after: t('after_cost_val') },
              { label: t('before_process'), before: t('before_process_val'), after: t('after_process_val') },
              { label: t('before_delivery'), before: t('before_delivery_val'), after: t('after_delivery_val') },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-[1fr_1fr_1fr] text-sm border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className={`px-5 py-3.5 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.label}</div>
                <div className={`px-5 py-3.5 text-center border-x ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>{row.before}</div>
                <div className={`px-5 py-3.5 text-center font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.after}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Products & Features (unified) ─────────────── */}
      <section id="recursos" className="py-24 md:py-32 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/60 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('products_label')}</p>
            <h2 className={`text-3xl md:text-4xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('products_title')}
            </h2>
            <p className={`max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('products_subtitle')}
            </p>
          </div>

          {/* Product cards — shadcn-style with border */}
          <div className="grid md:grid-cols-2 gap-5 mb-16">
            {/* Valuation Card */}
            <div className={`relative rounded-xl border p-7 transition-all duration-200 hover:shadow-lg ${isDark ? 'border-slate-800 bg-slate-900/80 hover:border-slate-700' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-slate-200/60'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'}`}>
                  <BarChart3 className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <div>
                  <h3 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('products_val_title')}</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('products_val_sub')}</p>
                </div>
              </div>
              <p className={`text-sm leading-relaxed mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('products_val_desc')}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-6">
                {[t('products_val_feat_dcf'), t('products_val_feat_bench'), t('products_val_feat_ai'), t('products_val_feat_pages')].map((f, i) => (
                  <span key={i} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium ${isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                    <CheckCircle className={`w-3 h-3 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-bold text-2xl ${isDark ? 'text-white' : 'text-slate-900'}`}>$990</span>
                  <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>to $4,990</span>
                </div>
                <Link to="/register" className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${isDark ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                  {t('products_val_cta_start')} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-3 mt-4">
                {[
                  { label: t('hero_val_sample_professional'), href: '/sample-report-professional.pdf' },
                  { label: t('hero_val_sample_advanced'), href: '/sample-report-investor-ready.pdf' },
                  { label: t('hero_val_sample_complete'), href: '/sample-report-fundraising.pdf' },
                ].map(({ label, href }) => (
                  <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-xs font-medium transition hover:underline ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    <FileText className="w-3 h-3" /> {label} ↗
                  </a>
                ))}
              </div>
            </div>

            {/* Pitch Deck Card */}
            <div className={`relative rounded-xl border p-7 transition-all duration-200 hover:shadow-lg ${isDark ? 'border-slate-800 bg-slate-900/80 hover:border-slate-700' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-slate-200/60'}`}>
              <span className={`absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isDark ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-600 border border-purple-200'}`}>
                {t('products_pitch_new')}
              </span>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/15' : 'bg-purple-50'}`}>
                  <Briefcase className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                </div>
                <div>
                  <h3 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('products_pitch_title')}</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('products_pitch_sub')}</p>
                </div>
              </div>
              <p className={`text-sm leading-relaxed mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('products_pitch_desc')}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-6">
                {[t('products_pitch_feat_a4'), t('products_pitch_feat_tam'), t('products_pitch_feat_matrix'), t('products_pitch_feat_waterfall'), t('products_pitch_feat_kpi'), t('products_pitch_feat_ai')].map((f, i) => (
                  <span key={i} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium ${isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                    <CheckCircle className={`w-3 h-3 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-bold text-2xl ${isDark ? 'text-white' : 'text-slate-900'}`}>$897</span>
                  <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('products_pitch_one_time')}</span>
                </div>
                <Link to="/register" className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${isDark ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                  {t('products_pitch_cta')} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <a href="/sample-pitchdeck.pdf" target="_blank" rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-xs font-medium mt-4 transition hover:underline ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                <FileText className="w-3 h-3" /> {t('products_pitch_view_sample')} ↗
              </a>
            </div>
          </div>

          {/* Features grid — below products */}
          <div className="mb-4">
            <h3 className={`text-lg font-semibold mb-6 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('features_title_full')}</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: BarChart3, title: t('feat_dcf_title'), desc: t('feat_dcf_desc') },
              { icon: FileText, title: t('feat_pdf_title'), desc: t('feat_pdf_desc') },
              { icon: Zap, title: t('feat_sim_title'), desc: t('feat_sim_desc') },
              { icon: Eye, title: t('feat_ai_title'), desc: t('feat_ai_desc') },
              { icon: GitCompareArrows, title: t('feat_compare_title'), desc: t('feat_compare_desc'), isNew: true },
              { icon: Target, title: t('feat_bench_title'), desc: t('feat_bench_desc') },
            ].map((item, i) => (
              <div key={i} className={`group rounded-xl border p-5 transition-all duration-200 ${isDark ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
                {item.isNew && (
                  <span className={`float-right text-[10px] font-bold px-2 py-0.5 rounded-md ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{t('hero_new_badge')}</span>
                )}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <item.icon className={`w-4.5 h-4.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <h4 className={`font-semibold text-sm mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h4>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LazySection minHeight="2800px">
      {/* ─── Methodology (deep dive) ────────────────────── */}
      <section id="metodologia" className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          {/* A2: Big number hero */}
          <div className="text-center mb-12">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>{t('method_label')}</p>
            <div className={`text-7xl md:text-8xl font-bold tracking-tighter mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <CountUp end={14} duration={1000} /><span className="text-emerald-500">+</span>
            </div>
            <h2 className={`text-2xl md:text-3xl font-semibold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('method_title_full')}
            </h2>
            <p className={`text-lg max-w-3xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('method_subtitle')}
            </p>
          </div>

          {/* A1: Grouped by category */}
          {[
            {
              catKey: 'core',
              catLabel: t('method_cat_core'),
              catDesc: t('method_cat_core_desc'),
              color: 'emerald',
              items: [
                { icon: TrendingUp, title: t('method_gordon_title'), badge: t('method_gordon_badge'), desc: t('method_gordon_desc'), tags: t('method_gordon_tags').split(' \u00b7 ') },
                { icon: BarChart3, title: t('method_exit_title'), badge: t('method_gordon_badge'), desc: t('method_exit_desc'), tags: t('method_exit_tags').split(' \u00b7 ') },
                { icon: PieChart, title: t('method_multiples_title'), badge: t('method_multiples_badge'), desc: t('method_multiples_desc'), tags: ['EV/Revenue', 'EV/EBITDA', 'P/E', 'EV/Gross Profit'] },
              ],
            },
            {
              catKey: 'alt',
              catLabel: t('method_cat_alt'),
              catDesc: t('method_cat_alt_desc'),
              color: 'teal',
              items: [
                { icon: Target, title: t('method_scorecard_title'), badge: t('method_scorecard_badge'), desc: t('method_scorecard_desc'), tags: t('method_scorecard_tags').split(' \u00b7 ') },
                { icon: CheckCircle, title: t('method_checklist_title'), badge: t('method_checklist_badge'), desc: t('method_checklist_desc'), tags: t('method_checklist_tags').split(' \u00b7 ') },
                { icon: TrendingUp, title: t('method_vc_title'), badge: t('method_vc_badge'), desc: t('method_vc_desc'), tags: t('method_vc_tags').split(' \u00b7 ') },
                { icon: Layers, title: t('method_chicago_title'), badge: t('method_chicago_badge'), desc: t('method_chicago_desc'), tags: t('method_chicago_tags').split(' \u00b7 ') },
              ],
            },
            {
              catKey: 'adj',
              catLabel: t('method_cat_adj'),
              catDesc: t('method_cat_adj_desc'),
              color: 'slate',
              items: [
                { icon: Lock, title: t('method_dlom_title'), badge: t('method_dlom_badge'), desc: t('method_dlom_desc'), tags: t('method_dlom_tags').split(' \u00b7 ') },
                { icon: Activity, title: t('method_survival_title'), badge: t('method_survival_badge'), desc: t('method_survival_desc'), tags: t('method_survival_tags').split(' \u00b7 ') },
                { icon: Target, title: t('method_qual_title'), badge: t('method_qual_badge'), desc: t('method_qual_desc'), tags: t('method_qual_tags').split(' \u00b7 ') },
                { icon: Dice1, title: t('method_montecarlo_title'), badge: t('method_montecarlo_badge'), desc: t('method_montecarlo_desc'), tags: t('method_montecarlo_tags').split(' \u00b7 ') },
              ],
            },
            {
              catKey: 'intel',
              catLabel: t('method_cat_intel'),
              catDesc: t('method_cat_intel_desc'),
              color: 'emerald',
              items: [
                { icon: Leaf, title: t('method_esg_title'), badge: t('method_esg_badge'), desc: t('method_esg_desc'), tags: t('method_esg_tags').split(' \u00b7 ') },
                { icon: Gauge, title: t('method_rule40_title'), badge: t('method_rule40_badge'), desc: t('method_rule40_desc'), tags: t('method_rule40_tags').split(' \u00b7 ') },
                { icon: BarChart2, title: t('method_revquality_title'), badge: t('method_revquality_badge'), desc: t('method_revquality_desc'), tags: t('method_revquality_tags').split(' \u00b7 ') },
                { icon: Brain, title: t('method_ai_title'), badge: t('method_ai_badge'), desc: t('method_ai_desc'), tags: t('method_ai_tags').split(' \u00b7 ') },
              ],
            },
          ].map((cat, ci) => (
            <div key={ci} className="mb-8 last:mb-0">
              {/* Category header */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs font-bold uppercase tracking-widest ${
                  cat.color === 'emerald' ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                  : cat.color === 'teal' ? (isDark ? 'text-teal-400' : 'text-teal-600')
                  : (isDark ? 'text-slate-400' : 'text-slate-500')
                }`}>{cat.catLabel}</span>
                <div className={`flex-1 h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{cat.catDesc}</span>
              </div>

              {/* Items grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {cat.items.map((item, ii) => {
                  const globalIdx = ci * 10 + ii;
                  const isOpen = openMethod === globalIdx;
                  return (
                    <div key={ii} className={`rounded-xl border overflow-hidden transition-all ${
                      isOpen
                        ? (isDark ? 'border-emerald-500/30 bg-slate-900' : 'border-emerald-200 bg-emerald-50/20')
                        : (isDark ? 'border-slate-800 hover:border-slate-700' : 'border-slate-200 hover:border-slate-300')
                    }`}>
                      <button
                        onClick={() => setOpenMethod(isOpen ? null : globalIdx)}
                        className={`w-full text-left px-4 py-3.5 transition ${isDark ? 'hover:bg-slate-900/80' : 'hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                            <item.icon className={`w-3.5 h-3.5 ${
                              cat.color === 'emerald' ? 'text-emerald-500'
                              : cat.color === 'teal' ? 'text-teal-500'
                              : (isDark ? 'text-slate-400' : 'text-slate-500')
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`font-semibold text-sm block truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</span>
                            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.badge}</span>
                          </div>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-400'} ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {isOpen && (
                        <div className={`px-4 pb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          <p className="text-xs leading-relaxed mb-2">{item.desc}</p>
                          <div className="flex flex-wrap gap-1">
                            {item.tags.map((tag, j) => (
                              <span key={j} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* D1+D2: Pipeline summary — 3 phases */}
          <div className={`mt-10 rounded-xl p-5 border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {[
                { label: t('pipeline_phase_core'), count: '8', color: 'emerald' },
                { label: t('pipeline_phase_adj'), count: '4', color: 'teal' },
                { label: t('pipeline_phase_final'), count: '', color: 'emerald' },
              ].map((phase, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className={`whitespace-nowrap font-medium px-4 py-1.5 rounded-lg flex items-center gap-2 ${
                    phase.color === 'emerald' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700') :
                    (isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-100 text-teal-700')
                  }`}>
                    {phase.label}
                    {phase.count && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600'}`}><CountUp end={Number(phase.count)} duration={700} /></span>}
                  </span>
                  {i < 2 && <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />}
                </span>
              ))}
            </div>
            <p className={`text-xs text-center mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('pipeline_result')}
            </p>
          </div>

        </div>
      </section>

      {/* ─── Plans ─────────────────────────────────────── */}
      <section id="planos" className="py-24 md:py-32 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>{t('plans_label')}</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('plans_title_full')}</h2>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>{t('plans_stripe')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-6 items-stretch">
            {[
              {
                name: t('plan_pro_name'), price: '$990', desc: t('plan_pro_desc'),
                pages: t('plan_pro_pages'), installment12: '83',
                samplePdf: '/sample-report-professional.pdf',
                features: [t('plan_pro_f1'), t('plan_pro_f2'), t('plan_pro_f3'), t('plan_pro_f4'), t('plan_pro_f5')],
                popular: false,
              },
              {
                name: t('plan_adv_name'), price: '$2,490', desc: t('plan_adv_desc'),
                pages: t('plan_adv_pages'), installment12: '208',
                samplePdf: '/sample-report-investor-ready.pdf',
                features: [t('plan_adv_f1'), t('plan_adv_f2'), t('plan_adv_f3'), t('plan_adv_f4'), t('plan_adv_f5'), t('plan_adv_f6'), t('plan_adv_f7')],
                popular: false,
              },
              {
                name: t('plan_comp_name'), price: '$4,990', desc: t('plan_comp_desc'),
                pages: t('plan_comp_pages'), installment12: '416',
                samplePdf: '/sample-report-fundraising.pdf',
                features: [t('plan_comp_f1'), t('plan_comp_f2'), t('plan_comp_f3'), t('plan_comp_f4'), t('plan_comp_f5'), t('plan_comp_f6'), t('plan_comp_f7'), t('plan_comp_f8'), t('plan_comp_f9'), t('plan_comp_f10')],
                popular: true,
              },
            ].map((plan, i) => (
              <div key={i} className={`relative rounded-xl border transition-all duration-200 flex flex-col ${
                plan.popular
                  ? isDark
                    ? 'border-emerald-500/60 bg-slate-900 shadow-lg shadow-emerald-500/5'
                    : 'border-emerald-500 bg-white shadow-lg shadow-emerald-100/60'
                  : isDark ? 'border-slate-800 hover:border-slate-700 bg-slate-900' : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}>
                {plan.popular && (
                  <div className={`text-center py-2 text-xs font-semibold uppercase tracking-wider rounded-t-[11px] ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                    {t('plan_recommended')}
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
                    {t('plan_installment_prefix')} <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>12× of ${plan.installment12}</span> {t('plan_installment_suffix')}
                  </p>
                  <p className={`text-xs font-medium mb-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('plan_pdf_report_with')} {plan.pages}</p>
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
                    {t('plan_cta')}
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
                    {t('plan_view_sample')}
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Satisfaction guarantee */}
          <p className={`text-center text-sm mt-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('plan_guarantee')}
          </p>
          <p className={`text-center text-xs mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            {t('plan_installment_note')}
          </p>

          {/* Trust & payment badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-6">
            {[
              { icon: Lock,         label: t('pay_secure_ssl') },
              { icon: Shield,       label: t('pay_privacy') },
              { icon: FileText,     label: t('pay_stripe') },
              { icon: CheckCircle,  label: t('pay_one_time') },
              { icon: Clock,        label: t('pay_no_sub') },
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
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>{t('partners_label')}</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('partners_title')}
            </h2>
            <p className={`max-w-2xl mx-auto text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('partners_subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { icon: DollarIcon, title: t('partners_comm_title'), desc: t('partners_comm_desc') },
              { icon: Users, title: t('partners_mgmt_title'), desc: t('partners_mgmt_desc') },
              { icon: Briefcase, title: t('partners_portfolio_title'), desc: t('partners_portfolio_desc') },
              { icon: TrendingUp, title: t('partners_link_title'), desc: t('partners_link_desc') },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border p-6 transition-all duration-200 ${isDark ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:shadow-lg hover:shadow-black/10' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60'}`}>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <item.icon className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* How it works partner */}
          <div className={`rounded-xl border p-8 md:p-10 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className={`text-lg font-bold mb-6 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('partners_hiw_title')}</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', title: t('partners_hiw_step1_title'), desc: t('partners_hiw_step1_desc') },
                { step: '02', title: t('partners_hiw_step2_title'), desc: t('partners_hiw_step2_desc') },
                { step: '03', title: t('partners_hiw_step3_title'), desc: t('partners_hiw_step3_desc') },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
                    <span className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{s.step}</span>
                  </div>
                  <h4 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.title}</h4>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA partner */}
          <div className={`rounded-xl border p-10 md:p-14 mt-12 text-center relative overflow-hidden ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <div className="relative">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold mb-6 ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                <DollarIcon className="w-3.5 h-3.5" />
                {t('partners_cta_badge')}
              </div>
              <h3 className={`text-3xl md:text-4xl font-semibold tracking-tight mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('partners_cta_title').split('50/50')[0]}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400"> 50/50</span>
              </h3>
              <p className={`text-lg md:text-xl mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {t('partners_cta_subtitle')}
              </p>
              <p className={`text-sm mb-8 max-w-xl mx-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {t('partners_cta_desc')}
              </p>
              <Link
                to="/partner/register"
                className="group inline-flex items-center gap-3 bg-emerald-600 text-white px-10 py-4 rounded-xl text-base font-semibold hover:brightness-110 transition-all"
              >
                <Briefcase className="w-6 h-6" />
                {t('partners_cta_button')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <p className={`text-xs mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {t('partners_cta_checks')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Perguntas Frequentes ──────────────────────────── */}
      <section className="py-24 md:py-32 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('faq_label')}</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>FAQ</h2>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('faq_subtitle')}</p>
          </div>
          <div className="space-y-2">
            {[
              {
                icon: Lock,
                color: 'emerald',
                q: t('faq_q1'),
                a: t('faq_a1'),
              },
              {
                icon: TrendingUp,
                color: 'teal',
                q: t('faq_q2'),
                a: t('faq_a2'),
              },
              {
                icon: Clock,
                color: 'emerald',
                q: t('faq_q3'),
                a: t('faq_a3'),
              },
              {
                icon: Building2,
                color: 'teal',
                q: t('faq_q4'),
                a: t('faq_a4'),
              },
              {
                icon: DollarIcon,
                color: 'emerald',
                q: t('faq_q5'),
                a: t('faq_a5'),
              },
              {
                icon: Database,
                color: 'teal',
                q: t('faq_q6'),
                a: t('faq_a6'),
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
            {t('cta_title_line1')}
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
              {t('cta_title_line2')}
            </span>
          </h2>
          <p className={`mb-6 text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('cta_subtitle')}
          </p>
          <div>
            <Link to="/register" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:brightness-110 transition-all">
              {t('cta_button')}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('cta_subtext')}
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
                {t('footer_desc')}
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
              <h4 className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('footer_col_product')}</h4>
              <ul className="space-y-2">
                {[
                  { label: t('footer_link_valuation'), href: '#planos' },
                  { label: t('footer_link_pitch'), href: '#planos' },
                  { label: t('footer_link_methodology'), href: '#metodologia' },
                  { label: t('footer_link_features'), href: '#recursos' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className={`text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Legal */}
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('footer_col_legal')}</h4>
              <ul className="space-y-2">
                {[
                  { label: t('footer_terms'), to: '/terms-of-use' },
                  { label: t('footer_privacy'), to: '/privacy-policy' },
                ].map(({ label, to }) => (
                  <li key={label}>
                    <Link to={to} className={`text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Contact */}
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('footer_col_contact')}</h4>
              <ul className="space-y-2">
                <li>
                  <a href="mailto:contact@valuora.online" className={`flex items-center gap-1.5 text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
                    <Mail className="w-3.5 h-3.5" />
                    contact@valuora.online
                  </a>
                </li>
                <li>
                  <Link to="/partner/register" className={`text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>{t('footer_become_partner')}</Link>
                </li>
                <li>
                  <Link to="/partner/login" className={`text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>{t('footer_partner_login')}</Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className={`pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              &copy; {new Date().getFullYear()} Valuora. {t('footer_rights').replace('\u00a9 {year} Valuora. ', '')}
            </p>
            <div className={`flex items-center gap-4 text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                {t('footer_data_compliance')}
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
          <span>{heroProduct === 'pitch' ? t('mobile_cta_pitch') : t('mobile_cta_valuation')}</span>
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
