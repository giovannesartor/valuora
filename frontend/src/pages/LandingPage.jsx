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
  const TW_TARGET = 'Tenha a resposta agora.';
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
    const ids = ['como-funciona', 'recursos', 'planos', 'metodologia', 'parceiros'];
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
    setTwText('');
    const delay = setTimeout(() => {
      const timer = setInterval(() => {
        i++;
        setTwText(TW_TARGET.slice(0, i));
        if (i >= TW_TARGET.length) clearInterval(timer);
      }, 65);
      return () => clearInterval(timer);
    }, 600);
    return () => clearTimeout(delay);
  }, []);

  // F5: Schema.org structured data
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          'name': 'Quanto Vale',
          'applicationCategory': 'BusinessApplication',
          'operatingSystem': 'Web',
          'offers': { '@type': 'Offer', 'price': '997', 'priceCurrency': 'BRL' },
          'description': 'Plataforma de valuation empresarial profissional com metodologia DCF, benchmarks setoriais calibrados e inteligência artificial.',
          'url': 'https://quantovale.online',
        },
        {
          '@type': 'FAQPage',
          'mainEntity': [
            { '@type': 'Question', 'name': 'O que é valuation empresarial?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'Valuation é o processo de determinar o valor econômico de uma empresa. O método mais robusto é o DCF (Discounted Cash Flow), que projeta fluxos de caixa futuros e os desconta pelo custo de capital.' } },
            { '@type': 'Question', 'name': 'Quanto custa um valuation profissional?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'Consultorias tradicionais cobram entre R$ 5.000 e R$ 50.000. O Quanto Vale oferece valuation profissional a partir de R$ 997, com entrega em minutos.' } },
            { '@type': 'Question', 'name': 'O relatório é aceito por investidores?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'Sim. O relatório PDF contém memória de cálculo completa, hipóteses, análise de sensibilidade, cenários e análise por IA — seguindo padrões de M&A.' } },
            { '@type': 'Question', 'name': 'Como funciona o motor DCF?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'O motor calcula o FCFE projetado por 5–10 anos, aplica WACC com beta setorial Damodaran, Selic atual e CRP. Benchmarks setoriais calibrados por base proprietária com +50 segmentos CNAE.' } },
          ],
        },
      ],
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'qv-schema';
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
            <img src="/favicon.svg?v=2" alt="QV" className={`transition-all duration-300 ${scrolled ? 'w-7 h-7' : 'w-8 h-8'}`} />
            <span className={`font-semibold text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Quanto Vale<sup className="text-[9px] ml-0.5 opacity-50">®</sup>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[
              { href: '#como-funciona', id: 'como-funciona', label: 'Como funciona' },
              { href: '#recursos',      id: 'recursos',      label: 'Recursos' },
              { href: '#planos',        id: 'planos',        label: 'Planos' },
              { href: '#metodologia',   id: 'metodologia',   label: 'Metodologia' },
              { href: '#parceiros',     id: 'parceiros',     label: 'Parceiros' },
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
              Entrar
            </Link>
            <Link to="/parceiro/login" className={`hidden lg:inline-block text-xs font-medium uppercase tracking-wide transition px-3 py-2 rounded-lg ${isDark ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}>
              Parceiro
            </Link>
            <Link to="/cadastro" className="hidden sm:inline-block bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition-all">
              INICIAR AVALIAÇÃO
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
                { href: '#como-funciona', label: 'Como funciona' },
                { href: '#recursos', label: 'Recursos' },
                { href: '#planos', label: 'Planos' },
                { href: '#metodologia', label: 'Metodologia' },
                { href: '#parceiros', label: 'Parceiros' },
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
                Entrar
              </Link>
              <Link
                to="/parceiro/login"
                onClick={() => setMobileNavOpen(false)}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${isDark ? 'text-emerald-400 hover:bg-slate-800' : 'text-emerald-600 hover:bg-emerald-50'}`}
              >
                Login Parceiro
              </Link>
              <Link
                to="/cadastro"
                onClick={() => setMobileNavOpen(false)}
                className="block text-center bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm font-semibold hover:brightness-110 transition-all"
              >
                INICIAR AVALIAÇÃO
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
          <span className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Valuation a partir de R$ 997</span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
          <span className={`font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Pitch Deck R$ 697</span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
          <span>Pagamento único</span>
          <Link to="/cadastro" className="ml-1 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600 text-white hover:brightness-110 transition">
            Iniciar →
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
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>NOVO</span>
            </button>
          </div>

          <h1 className={`text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1] mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Quanto vale
            <br />
            <span className={`text-transparent bg-clip-text bg-gradient-to-r ${heroProduct === 'pitch' ? 'from-purple-500 to-indigo-400' : 'from-emerald-500 to-teal-400'} transition-all duration-500`}>sua empresa?</span>
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
                  Valuation profissional em minutos — não em semanas.
                  O rigor do DCF com a interpretação da IA, benchmarks setoriais calibrados e o mesmo padrão de M&A por uma fração do custo.
                </p>

                {/* M2: swipe strip on mobile */}
                <div className="flex overflow-x-auto snap-x gap-3 mb-8 -mx-6 px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:mx-0 sm:px-0 sm:overflow-visible sm:justify-center lg:justify-start">
                  {[
                    { icon: Cpu,      label: 'Motor DCF Institucional',           border: 'emerald' },
                    { icon: Brain,    label: 'Análise por Inteligência Artificial', border: 'teal' },
                    { icon: FileText, label: 'Até 25 páginas de relatório',        border: 'emerald' },
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
                  <Link to="/cadastro" className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-10 py-4 rounded-xl text-base font-semibold hover:brightness-110 transition-all">
                    Iniciar valuation
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <button
                    onClick={() => setDiagnosticoOpen(true)}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-medium transition-colors duration-200 px-6 py-4 rounded-xl border ${isDark ? 'border-slate-700 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400' : 'border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-600'}`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Diagnóstico Gratuito
                  </button>
                </div>
                <p className={`text-xs mb-4 text-center lg:text-left ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Sem assinatura · Resultado em minutos · A partir de R$ 997
                </p>
                <a
                  href="/relatorio-exemplo.pdf?v=6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`lg:hidden flex items-center gap-3 mb-8 p-4 rounded-xl border transition-all ${isDark ? 'bg-slate-900/80 border-slate-700 hover:border-emerald-500/40' : 'bg-white border-slate-200 hover:border-emerald-300 shadow-sm'}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <FileText className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Ver exemplo de relatório</p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>25 páginas · PDF executivo completo</p>
                  </div>
                  <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </a>
              </>
            ) : (
              <>
                <p className={`text-base md:text-lg max-w-2xl mx-auto lg:mx-0 mb-6 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Pitch deck profissional para investidores — em minutos.
                  Layout landscape A4 com narrativa por IA, KPI panel, gráficos de cenários, TAM/SAM/SOM visual e matriz competitiva.
                </p>

                {/* M2: swipe strip on mobile */}
                <div className="flex overflow-x-auto snap-x gap-3 mb-8 -mx-6 px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:mx-0 sm:px-0 sm:overflow-visible sm:justify-center lg:justify-start">
                  {[
                    { icon: Brain,    label: 'Narrativa por IA',           color: 'purple' },
                    { icon: LineChart, label: 'Waterfall + 3 Cenários',    color: 'indigo' },
                    { icon: Target,   label: 'TAM/SAM/SOM Visual',         color: 'purple' },
                    { icon: FileText, label: 'Landscape A4 — Design Premium', color: 'indigo' },
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
                  <Link to="/cadastro" className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-purple-600 text-white px-10 py-4 rounded-xl text-base font-semibold hover:brightness-110 transition-all">
                    Criar meu pitch deck
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <button
                    onClick={() => setHeroProduct('valuation')}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-medium transition-colors duration-200 px-6 py-4 rounded-xl border ${isDark ? 'border-slate-700 text-slate-300 hover:border-purple-500/50 hover:text-purple-400' : 'border-slate-300 text-slate-600 hover:border-purple-400 hover:text-purple-600'}`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Ver Valuation DCF
                  </button>
                </div>
                <p className={`text-xs mb-4 text-center lg:text-left ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Sem assinatura · Resultado em minutos · R$ 697 pagamento único
                </p>
                <a
                  href="/pitchdeck-exemplo.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`lg:hidden flex items-center gap-3 mb-8 p-4 rounded-xl border transition-all ${isDark ? 'bg-slate-900/80 border-slate-800 hover:border-purple-500/40' : 'bg-white border-slate-200 hover:border-purple-300 shadow-sm'}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                    <Briefcase className="w-5 h-5 text-purple-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Ver exemplo de pitch deck</p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Slides A4 · design premium · narrativa por IA</p>
                  </div>
                  <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </a>
              </>
            )}
          </div>

          {/* Trust badges — M4: 2×2 grid on mobile, single row on sm+ */}
          <div className={`grid grid-cols-2 sm:inline-flex sm:items-center sm:justify-center lg:justify-start gap-3 sm:gap-6 md:gap-8 px-5 py-4 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            {[
              { icon: Shield,   label: 'LGPD Compliant' },
              { icon: Lock,     label: 'SSL 256-bit' },
              { icon: Cpu,      label: 'Metodologia DCF' },
              { icon: Database, label: 'Benchmarks setoriais' },
            ].map(({ icon: Icon, label }, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs font-medium">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {label}
              </div>
            ))}
          </div>

          </div>{/* /content-column */}

          {/* Live mock preview right column — desktop only, switches between valuation and pitch */}
          <div className="hidden lg:block w-80 xl:w-96 flex-shrink-0 mt-8 lg:mt-0 relative">
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
                  {heroProduct === 'pitch' ? 'pitchdeck-quantovale.pdf' : 'relatorio-quantovale.pdf'}
                </span>
              </div>

              {heroProduct === 'pitch' ? (
                /* ── Pitch Deck: single slide with stack effect ── */
                <a
                  href="/pitchdeck-exemplo.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block p-5 group"
                >
                  {/* Stack layers behind — sugggest a deck of slides */}
                  <div className={`absolute inset-5 bottom-3 -rotate-3 rounded-lg shadow-md ${isDark ? 'bg-slate-700' : 'bg-purple-100'}`} />
                  <div className={`absolute inset-5 bottom-3 -rotate-1 rounded-lg shadow-sm ${isDark ? 'bg-slate-600' : 'bg-purple-50'}`} />
                  {/* Main slide */}
                  <div className="relative rounded-lg overflow-hidden shadow-xl ring-1 ring-black/10 transition-transform duration-300 group-hover:-translate-y-1">
                    <iframe
                      src="/pitchdeck-exemplo.pdf#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH"
                      className="w-full h-[320px] block pointer-events-none"
                      loading="lazy"
                      title="Pitch Deck — slide 1"
                    />
                  </div>
                  {/* Slide count badge */}
                  <span className={`absolute top-7 right-7 text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm shadow ${
                    isDark ? 'bg-purple-500/80 text-white' : 'bg-purple-600/90 text-white'
                  }`}>12 slides</span>
                </a>
              ) : (
                /* ── Valuation: full iframe ── */
                <iframe
                  key="val"
                  src="/relatorio-exemplo.pdf?v=6#toolbar=0&navpanes=0&scrollbar=0&view=FitH"
                  title="Exemplo de relatório Quanto Vale"
                  className="w-full h-[400px] block"
                  loading="lazy"
                />
              )}
            </div>

            {/* ── KPI cards flutuantes — apenas no valuation ── */}
            {heroProduct === 'valuation' && (
              <>
                {/* EV — bottom-left */}
                <div className={`absolute bottom-5 left-3 z-10 px-3 py-2 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-500 ${`
                  isDark ? 'bg-slate-900/85 border-emerald-500/30' : 'bg-white/95 border-emerald-200'
                }`}>
                  <p className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/60'}`}>EV estimado</p>
                  <p className={`text-sm font-bold leading-tight ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>R$ 3,2M – 5,1M</p>
                </div>
                {/* WACC — top-right */}
                <div className={`absolute top-10 right-3 z-10 px-3 py-2 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-500 ${`
                  isDark ? 'bg-slate-900/85 border-slate-700' : 'bg-white/95 border-slate-200'
                }`}>
                  <p className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>WACC</p>
                  <p className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>14,8%</p>
                </div>
                {/* Múltiplo — bottom-right */}
                <div className={`absolute bottom-5 right-3 z-10 px-3 py-2 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-500 ${`
                  isDark ? 'bg-slate-900/85 border-amber-500/25' : 'bg-white/95 border-amber-200'
                }`}>
                  <p className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-amber-400/70' : 'text-amber-600/60'}`}>Múltiplo</p>
                  <p className={`text-sm font-bold leading-tight ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>7,2× EBITDA</p>
                </div>
              </>
            )}

            <div className="flex items-center justify-center gap-3 mt-6">
              <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {heroProduct === 'pitch' ? 'Exemplo real · 12 slides · narrativa por IA' : 'Exemplo real · 25 páginas · pronto após preenchimento'}
              </p>
              <a
                href={heroProduct === 'pitch' ? '/pitchdeck-exemplo.pdf' : '/relatorio-exemplo.pdf?v=6'}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs font-medium transition ${
                  heroProduct === 'pitch'
                    ? isDark ? 'text-purple-400/60 hover:text-purple-400' : 'text-purple-600/60 hover:text-purple-600'
                    : isDark ? 'text-emerald-400/60 hover:text-emerald-400' : 'text-emerald-600/60 hover:text-emerald-600'
                }`}
              >
                Abrir ↗
              </a>
            </div>
          </div>

          </div>{/* /flex-wrapper */}
        </div>
      </section>

      {/* ─── Credibilidade ──────────────────────────────── */}
      <section className={`py-10 ${isDark ? 'bg-slate-900/40' : 'bg-slate-50'}`}>
        <div className="max-w-5xl mx-auto px-6">
          <p className={`text-center text-xs font-semibold uppercase tracking-widest mb-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Metodologia reconhecida pelo mercado
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {[
              { icon: Shield,   label: 'LGPD Compliant' },
              { icon: Lock,     label: 'Criptografia SSL 256-bit' },
              { icon: Cpu,      label: 'DCF Certificada' },
              { icon: Database, label: 'Benchmarks setoriais' },
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
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Comparação</p>
            <h2 className={`text-2xl md:text-3xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Por que o{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Quanto Vale</span>{' '}
              é diferente?
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
                  <img src="/favicon.svg?v=2" alt="QV" className="w-4 h-4" />
                  <span className={`font-bold text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Quanto Vale</span>
                </div>
              </div>
              <div className={`py-4 px-5 text-center border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <span className={`font-semibold text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Consultoria Tradicional</span>
              </div>
            </div>

            {[
              { label: 'Tempo',         qv: 'Resultado em 5 minutos',          cons: 'Semanas a meses' },
              { label: 'Custo',         qv: 'A partir de R$997',               cons: 'R$5.000 a R$50.000+' },
              { label: 'Complexidade',  qv: 'Preencha e receba — simples',     cons: 'Reuniões, entrevistas, planilhas' },
              { label: 'Relatório PDF', qv: 'Até 25 páginas incluídas',        cons: 'Cobrado à parte ou não incluso' },
              { label: 'Disponível',    qv: '24h por dia, qualquer lugar',     cons: 'Horário comercial, presencial' },
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
            <Link to="/cadastro" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-7 py-3.5 rounded-xl text-sm font-semibold hover:brightness-110 transition-all">
              Começar agora — grátis
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── L2: Sector Ticker ──────────────────────────────── */}
      <div className={`py-4 overflow-hidden border-y ${isDark ? 'border-slate-800/50' : 'border-slate-100'}`}>
        <div style={{ display: 'flex', width: 'max-content', animation: 'ticker 30s linear infinite' }}>
          {['Varejo', 'Tecnologia', 'Saúde', 'Logística', 'Indústria', 'Educação', 'Imóveis', 'Agronegócio', 'Finanças', 'Construção', 'Alimentação', 'E-commerce', 'Consultoria', 'Serviços', 'Manufatura',
            'Varejo', 'Tecnologia', 'Saúde', 'Logística', 'Indústria', 'Educação', 'Imóveis', 'Agronegócio', 'Finanças', 'Construção', 'Alimentação', 'E-commerce', 'Consultoria', 'Serviços', 'Manufatura',
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
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-red-400/60' : 'text-red-500/60'}`}>O problema</p>
            <h2 className={`text-3xl md:text-4xl font-semibold tracking-tight mb-6 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Sem valuation estruturado, qualquer negociação começa com{' '}
              <span className="text-red-400">assimetria de informação</span>
            </h2>
            <div className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {['Venda de participação', 'Entrada de sócio', 'Captação de investimento', 'Planejamento de saída'].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className={`max-w-2xl mx-auto leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Consultorias tradicionais levam semanas e custam entre{' '}
              <span className={isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>R$ 5.000 a R$ 50.000</span>.
              {' '}O Quanto Vale entrega uma análise técnica, fundamentada e documentada em minutos.
            </p>
          </div>

          {/* Solution — 3 pillars */}
          <div className="text-center mb-8">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>A solução</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Cpu,
                title: 'Motor Institucional',
                desc: 'DCF com FCFE projetado por 10 anos, WACC, beta setorial Damodaran e Selic atualizada — mesma metodologia de consultorias de M&A.',
                tag: 'Motor DCF v6',
              },
              {
                icon: Database,
                title: 'Benchmarks Setoriais',
                desc: 'Base proprietária com +50 segmentos CNAE, calibrada com metodologia Damodaran e dados de mercado. Seu valuation reflete o cenário real do seu setor.',
                tag: 'Base Setorial',
              },
              {
                icon: FileText,
                title: 'Relatório Defensável',
                desc: 'Até 25 páginas com memória de cálculo, hipóteses, cenários e análise por IA — pronto para investidores, sócios ou bancos.',
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
              Feito para quem precisa de{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">respostas concretas</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Building2, title: 'Empresário que quer vender', desc: 'Saiba exatamente quanto pedir antes de iniciar qualquer negociação de venda.' },
              { icon: TrendingUp, title: 'Startup em captação', desc: 'Apresente um valuation profissional e defensável para investidores e fundos.' },
              { icon: Award, title: 'Contabilidade / Consultoria', desc: 'Ofereça valuation como serviço adicional para seus clientes. Seja parceiro.' },
              { icon: Users, title: 'Quem quer comprar', desc: 'Avalie a empresa-alvo antes de fazer uma oferta e negocie com dados reais.' },
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

      {/* ─── Como funciona ────────────────────────────────── */}
      <section id="como-funciona" className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Como funciona</p>
            <h2 className={`text-3xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              4 passos para o seu valuation
            </h2>
          </div>

          <div className="space-y-0">
            {[
              { step: '01', title: 'Crie sua conta', desc: 'Cadastro com confirmação por e-mail. Ambiente seguro.', color: 'from-emerald-500 to-emerald-600' },
              { step: '02', title: 'Envie seus dados financeiros', desc: 'Inserção manual ou upload de DRE em PDF/Excel. A IA extrai e estrutura automaticamente.', color: 'from-teal-500 to-emerald-500' },
              { step: '03', title: 'Veja a prévia', desc: 'Receba indicadores principais antes de desbloquear o relatório.', color: 'from-emerald-500 to-cyan-500' },
              { step: '04', title: 'Desbloqueie o relatório completo', desc: 'Escolha o plano e receba o PDF executivo por e-mail.', color: 'from-teal-600 to-emerald-500' },
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


      {/* ─── Nossos Produtos ──────────────────────────────── */}
      <section className="py-24 md:py-32 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Nossos produtos</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Duas ferramentas para{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
                valorizar e apresentar
              </span>{' '}
              sua empresa
            </h2>
            <p className={`max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Valuation profissional e pitch deck para investidores — tudo numa única plataforma.
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
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Motor institucional + IA</p>
                </div>
              </div>
              <p className={`text-sm leading-relaxed mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Relatório profissional de até 25 páginas com DCF, benchmark setorial calibrado, análise de risco, simulador estratégico e narrativa por inteligência artificial.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['DCF Gordon + Exit Multiple', 'Benchmark setorial', 'Análise IA', 'Até 25 páginas'].map((f, i) => (
                  <span key={i} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    <CheckCircle className="w-3 h-3" />
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-bold text-2xl ${isDark ? 'text-white' : 'text-slate-900'}`}>R$997</span>
                  <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>a R$3.997</span>
                </div>
                <Link to="/cadastro" className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:brightness-110 transition-all">
                  Iniciar <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <a
                href="/relatorio-exemplo.pdf?v=6"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 text-xs font-medium mt-4 transition hover:underline ${isDark ? 'text-emerald-400/70 hover:text-emerald-400' : 'text-emerald-600/70 hover:text-emerald-600'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                Ver exemplo de relatório
                <ArrowRight className="w-3 h-3 opacity-60" />
              </a>
            </div>

            {/* Pitch Deck Card */}
            <div className={`relative group rounded-2xl border-2 p-8 transition-colors duration-200 ${isDark ? 'border-purple-500/30 bg-slate-900 hover:border-purple-500/50' : 'border-purple-200 bg-white hover:border-purple-400'}`}>
              <span className={`absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${isDark ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-600 border border-purple-200'}`}>
                NOVO
              </span>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Pitch Deck</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>PDF pronto para investidores</p>
                </div>
              </div>
              <p className={`text-sm leading-relaxed mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Landscape A4 premium com TAM/SAM/SOM visual, matriz competitiva 2×2, waterfall de receita, KPI panel, 3 cenários financeiros, equipe com foto e narrativa por IA.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Landscape A4', 'TAM/SAM/SOM Visual', 'Matriz 2×2', 'Waterfall + Cenários', 'KPI Panel', 'Narrativa IA'].map((f, i) => (
                  <span key={i} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium ${isDark ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                    <CheckCircle className="w-3 h-3" />
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-bold text-2xl ${isDark ? 'text-white' : 'text-slate-900'}`}>R$697</span>
                  <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ único</span>
                </div>
                <Link to="/cadastro" className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:brightness-110 transition-all">
                  Criar <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <a
                href="/pitchdeck-exemplo.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 text-xs font-medium mt-4 transition hover:underline ${isDark ? 'text-purple-400/70 hover:text-purple-400' : 'text-purple-600/70 hover:text-purple-600'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                Ver exemplo de pitch deck
                <ArrowRight className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Funcionalidades ────────────────────────────── */}
      <section id="recursos" className="py-24 md:py-32 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-teal-400/60' : 'text-teal-600/60'}`}>Funcionalidades</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Tudo para{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
                avaliar e defender
              </span>{' '}
              o valor da sua empresa
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: BarChart3, title: 'Valuation DCF Completo', desc: 'Valor estimado com DCF Gordon + Exit Multiple, DLOM e análise de sobrevivência.', gradient: 'from-emerald-500 to-emerald-600' },
              { icon: FileText, title: 'Relatório PDF Premium', desc: 'Documento institucional com gráficos, projeções, benchmark e análise estratégica por IA.', gradient: 'from-teal-600 to-emerald-500' },
              { icon: Zap, title: 'Simulador Interativo', desc: 'Altere crescimento, margem e taxa de desconto. O valuation recalcula instantaneamente.', gradient: 'from-teal-600 to-teal-400' },
              { icon: Eye, title: 'Análise IA Estratégica', desc: 'Análise narrativa com recomendações estratégicas gerada por inteligência artificial.', gradient: 'from-teal-500 to-emerald-500' },
              { icon: GitCompareArrows, title: 'Comparar Análises', desc: 'Compare até 4 empresas lado a lado — valuation, risco, receita e múltiplos num único painel.', gradient: 'from-cyan-500 to-teal-500', isNew: true },
              { icon: Target, title: 'Benchmark Estratégico', desc: 'Descubra se sua margem, crescimento e eficiência estão acima ou abaixo do mercado.', gradient: 'from-emerald-500 to-cyan-500' },
            ].map((item, i) => (
              <div key={i} className={`group relative rounded-2xl p-5 border transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-200 hover:shadow-lg'}`}>
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-gradient-to-br from-emerald-500/5 to-transparent' : 'bg-gradient-to-br from-emerald-50 to-transparent'}`} />
                {item.isNew && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white tracking-wide">NOVO</span>
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
              to="/cadastro"
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-3.5 rounded-xl text-sm font-semibold hover:brightness-110 transition-all"
            >
              Comece grátis
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <LazySection minHeight="2800px">
      {/* ─── Metodologia (deep dive) ────────────────────── */}
      <section id="metodologia" className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Metodologia</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              6 camadas de análise para um valuation defensável
            </h2>
            <p className={`text-lg max-w-3xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Combinamos <span className={isDark ? 'text-white font-medium' : 'text-slate-900 font-medium'}>três métodos de avaliação</span> com{' '}
              <span className={isDark ? 'text-white font-medium' : 'text-slate-900 font-medium'}>três camadas de ajuste</span> — a mesma abordagem usada por consultorias de M&A.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                icon: TrendingUp,
                title: 'DCF — Gordon Growth',
                badge: 'Peso por maturidade',
                badgeColor: 'emerald',
                desc: 'Projeta o FCFE (fluxo ao acionista) por 10 anos e calcula o Terminal Value pela fórmula de Gordon. Utiliza Ke (QuantoVale) como taxa de desconto, com beta setorial Damodaran e Selic atualizada.',
                tags: ['FCFE projetado', 'Terminal Value', 'Ke', 'Beta QuantoVale'],
              },
              {
                icon: BarChart3,
                title: 'DCF — Exit Multiple',
                badge: 'Peso por maturidade',
                badgeColor: 'emerald',
                desc: 'Mesmo fluxo de caixa projetado, porém o Terminal Value é calculado aplicando um múltiplo EV/EBITDA setorial ao EBITDA do último ano projetado. Reduz dependência de premissas de crescimento perpétuo.',
                tags: ['EV/EBITDA', 'Terminal Value', 'Múltiplo de saída', 'EBITDA projetado'],
              },
              {
                icon: PieChart,
                title: 'Múltiplos Setoriais',
                badge: 'Informativo',
                badgeColor: 'emerald',
                desc: 'Avaliação informativa por EV/Receita e EV/EBITDA do setor, com dados reais de Damodaran/NYU Stern. No v4, múltiplos não compõem o valor final.',
                tags: ['EV/Receita', 'EV/EBITDA', 'Damodaran', 'Informativo'],
              },
              {
                icon: Lock,
                title: 'DLOM',
                badge: '10–35%',
                badgeColor: 'teal',
                desc: 'Desconto de 10% a 35% para empresas de capital fechado (sem liquidez de mercado). Ajustado por porte, maturidade e liquidez do setor.',
                tags: ['Discount for Lack of Marketability', 'Capital fechado'],
              },
              {
                icon: Activity,
                title: 'Taxa de Sobrevivência',
                badge: 'SEBRAE',
                badgeColor: 'teal',
                desc: 'Desconto baseado na probabilidade real de sobrevivência da empresa no horizonte de projeção, com dados do SEBRAE e bônus por anos de operação.',
                tags: ['Probabilidade real', 'Horizonte de projeção'],
              },
              {
                icon: Target,
                title: 'Score Qualitativo',
                badge: '±15%',
                badgeColor: 'teal',
                desc: 'Avaliação de equipe, mercado, produto, tração e operação. Ajusta ±15% o valor final com base em fatores não financeiros que impactam o risco.',
                tags: ['10 perguntas', '5 dimensões', 'Fatores não financeiros'],
              },
              {
                icon: Brain,
                title: 'QV Intelligence',
                badge: 'IA Proprietária',
                badgeColor: 'teal',
                desc: 'Após o motor DCF calcular todos os números, o QV Intelligence — nossa camada de IA especializada em finanças — interpreta os resultados. Contextualiza o valuation no seu setor, aponta inconsistências, compara com benchmarks de mercado e redige o Executive Summary do relatório, transformando números em insights acionáveis.',
                tags: ['QV Intelligence', 'Executive Summary', 'Contexto setorial', 'Análise de risco', 'Benchmark setorial'],
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
                { label: 'Múltiplos', color: 'emerald' },
                { label: 'DLOM', color: 'teal' },
                { label: 'Sobrevivência', color: 'teal' },
                { label: 'Qualitativo', color: 'teal' },
                { label: 'QV Intelligence', color: 'blue' },
                { label: 'Equity Final', color: 'emerald' },
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
              Resultado: um valuation técnico, consistente e <span className="font-semibold">defensável</span>.
            </p>
          </div>

        </div>
      </section>

      {/* ─── Planos ─────────────────────────────────────── */}
      <section id="planos" className="py-24 md:py-32 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Pricing</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Pagamento único. Sem assinatura.</h2>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>PIX, boleto ou cartão de crédito</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-6 items-stretch">
            {[
              {
                name: 'Essencial', price: 'R$997', desc: 'Valuation DCF completo',
                pages: '~8 páginas',
                features: ['Valuation DCF Gordon Growth', 'Score de risco e maturidade', 'Relatório executivo básico', 'Envio por e-mail'],
                popular: false,
              },
              {
                name: 'Profissional', price: 'R$1.997', desc: 'Análise completa com benchmark',
                pages: '~15 páginas',
                features: ['Tudo do Essencial', 'DCF Exit Multiple + Múltiplos', 'Benchmark setorial oficial', 'DLOM + Sobrevivência + P&L', 'Tabela de sensibilidade', 'Simulador estratégico'],
                popular: false,
              },
              {
                name: 'Estratégico', price: 'R$3.997', desc: 'Máximo nível de análise',
                pages: '~25 páginas',
                features: ['Tudo do Profissional', 'Análise estratégica avançada por IA', 'Avaliação qualitativa radar', 'Simulação de rodada de investimento', 'Relatório mais completo do Brasil'],
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
                    Recomendado
                  </div>
                )}
                <div className={`flex flex-col flex-1 p-8 ${plan.popular ? 'pt-6' : ''}`}>
                  <h3 className={`font-semibold text-lg ${plan.popular ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-white' : 'text-slate-900')}`}>{plan.name}</h3>
                  <p className={`text-sm mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{plan.desc}</p>
                  <div className="mb-2">
                    <span className={`font-bold text-4xl ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                    <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ único</span>
                  </div>
                  <p className={`text-xs font-medium mb-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Relatório PDF com {plan.pages}</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className={`flex items-center gap-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${plan.popular ? 'text-emerald-400' : 'text-emerald-500'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/cadastro" className={`block text-center rounded-xl font-semibold text-sm py-3.5 transition-all mt-auto ${
                    plan.popular
                      ? 'bg-emerald-600 text-white hover:brightness-110'
                      : `border ${isDark ? 'border-slate-700 text-white hover:border-emerald-500/50' : 'border-slate-300 text-slate-900 hover:border-emerald-400'}`
                  }`}>
                    INICIAR AVALIAÇÃO
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Satisfaction guarantee */}
          <p className={`text-center text-sm mt-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Satisfação garantida · Pagamento seguro · Suporte por e-mail
          </p>

          {/* Trust & payment badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-6">
            {[
              { icon: Lock,         label: 'SSL Seguro' },
              { icon: Shield,       label: 'LGPD Compliant' },
              { icon: FileText,     label: 'Boleto / PIX / Cartão' },
              { icon: CheckCircle,  label: 'Pagamento Único' },
              { icon: Clock,        label: 'Sem Assinatura' },
            ].map((b, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <b.icon className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-500/60' : 'text-emerald-500/70'}`} />
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Parceiros ───────────────────────────────────── */}
      <section id="parceiros" className="py-24 md:py-32 relative">
        {isDark && (
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[300px] bg-teal-600/5 rounded-full blur-[100px]" />
        )}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Parceiros</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Transforme indicações em receita
            </h2>
            <p className={`max-w-2xl mx-auto text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Ideal para contabilidades, consultorias e assessorias que querem oferecer <strong>valuation profissional e pitch deck para investidores</strong> como serviço adicional — e ganhar 50% de cada venda.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { icon: DollarIcon, title: '50% — Valuation e Pitch Deck', desc: 'Comissão em ambos os produtos. Cada venda — valuation ou pitch deck — você recebe metade. Sem teto.' },
              { icon: Users, title: 'Gestão completa', desc: 'Painel exclusivo para acompanhar clientes, status e comissões em tempo real.' },
              { icon: Briefcase, title: 'Seu portfólio cresce', desc: 'Ofereça valuation e pitch deck para investidores sem investir em equipe ou tecnologia.' },
              { icon: TrendingUp, title: 'Link de indicação', desc: 'Compartilhe seu link. Cada cadastro é rastreado automaticamente.' },
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

          {/* Como funciona parceiro */}
          <div className={`rounded-2xl border p-8 md:p-10 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className={`text-lg font-bold mb-6 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>Como funciona</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Cadastre-se como parceiro', desc: 'Crie sua conta e ative o Modo Parceiro em segundos. Você recebe um link exclusivo de indicação.' },
                { step: '02', title: 'Indique seus clientes', desc: 'Compartilhe o link ou cadastre clientes diretamente no painel. Cada valuation ou pitch deck feito é rastreado automaticamente.' },
                { step: '03', title: 'Receba suas comissões', desc: 'A cada pagamento confirmado — seja do valuation ou do pitch deck — 50% do valor é creditado automaticamente para você via PIX.' },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-sm font-bold mb-4">{s.step}</div>
                  <h4 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.title}</h4>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA parceiro */}
          <div className={`rounded-3xl border-2 p-10 md:p-14 mt-12 text-center relative overflow-hidden ${isDark ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-teal-500/10' : 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50'}`}>
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6 ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                <DollarIcon className="w-3.5 h-3.5" />
                COMISSÃO DE 50%
              </div>
              <h3 className={`text-3xl md:text-4xl font-semibold tracking-tight mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Dividimos
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400"> meio a meio</span>
              </h3>
              <p className={`text-lg md:text-xl mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Cada venda que você indicar, <strong className="text-emerald-500">metade é sua</strong>.
              </p>
              <p className={`text-sm mb-8 max-w-xl mx-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Valuation profissional (<strong>R$997+</strong>) ou Pitch Deck para investidores (<strong>R$697</strong>).<br />
                Você indica, o cliente paga, e o dinheiro cai na sua conta via PIX. Sem limite de ganhos.
              </p>
              <Link
                to="/parceiro/cadastro"
                className="group inline-flex items-center gap-3 bg-emerald-600 text-white px-10 py-5 rounded-2xl text-lg font-semibold hover:brightness-110 transition-all"
              >
                <Briefcase className="w-6 h-6" />
                Quero ser parceiro e ganhar 50%
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <p className={`text-xs mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                ✓ Cadastro em 30 segundos &nbsp; ✓ Link exclusivo &nbsp; ✓ Painel com dashboard completo
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
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Dúvidas frequentes</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Perguntas frequentes</h2>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tudo que você precisa saber antes de começar</p>
          </div>
          <div className="space-y-2">
            {[
              {
                icon: Lock,
                color: 'emerald',
                q: 'Meu valuation é confidencial?',
                a: 'Sim. Seus dados financeiros são criptografados ponta a ponta e nunca são compartilhados com terceiros. Conformidade total com a LGPD.',
              },
              {
                icon: TrendingUp,
                color: 'teal',
                q: 'Serve para captar investimento?',
                a: 'Sim. O relatório utiliza a mesma metodologia DCF de consultorias de M&A, com memória de cálculo, premissas e benchmark setorial — pronto para apresentar a investidores e fundos.',
              },
              {
                icon: Clock,
                color: 'emerald',
                q: 'Em quanto tempo recebo o resultado?',
                a: 'O valuation é gerado em minutos. Após o pagamento, o relatório PDF completo é enviado para o seu e-mail automaticamente.',
              },
              {
                icon: Building2,
                color: 'teal',
                q: 'Posso usar para negociar a venda da empresa?',
                a: 'Com certeza. O relatório inclui faixa de valor, cenários pessimista/otimista e benchmark setorial — documentação que fortalece sua posição em qualquer negociação.',
              },
              {
                icon: DollarIcon,
                color: 'emerald',
                q: 'O pagamento é recorrente?',
                a: 'Não. É pagamento único por análise. Sem assinatura, sem mensalidade. PIX, boleto ou cartão de crédito.',
              },
              {
                icon: Database,
                color: 'teal',
                q: 'De onde vêm os dados setoriais?',
                a: 'Base setorial proprietária com +50 segmentos CNAE, calibrada com metodologia Damodaran e dados de mercado atualizados regularmente.',
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
            Você construiu sua empresa.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
              Agora descubra quanto ela realmente vale.
            </span>
          </h2>
          <p className={`mb-6 text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Valuation profissional. Baseado em dados oficiais. Em minutos.
          </p>
          <div>
            <Link to="/cadastro" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:brightness-110 transition-all">
              Iniciar valuation
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Sem assinatura · Resultado em minutos
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
                <img src="/favicon.svg?v=2" alt="QV" className="w-7 h-7" />
                <span className={`font-semibold text-base tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Quanto Vale<sup className="text-[8px] ml-0.5 opacity-50">®</sup>
                </span>
              </div>
              <p className={`text-sm leading-relaxed mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Valuation profissional com metodologia DCF e benchmarks setoriais calibrados.
              </p>
              <div className="flex items-center gap-2">
                <a
                  href="https://instagram.com/quantovale.online"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className={`p-2 rounded-lg transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
                >
                  <Instagram className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Column 2: Produto */}
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Produto</h4>
              <ul className="space-y-2">
                {[
                  { label: 'Valuation DCF', href: '#planos' },
                  { label: 'Pitch Deck', href: '#planos' },
                  { label: 'Metodologia', href: '#metodologia' },
                  { label: 'Funcionalidades', href: '#recursos' },
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
                  { label: 'Termos de Uso', to: '/termos-de-uso' },
                  { label: 'Política de Privacidade', to: '/politica-de-privacidade' },
                ].map(({ label, to }) => (
                  <li key={label}>
                    <Link to={to} className={`text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Contato */}
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Contato</h4>
              <ul className="space-y-2">
                <li>
                  <a href="mailto:quantovalehoje@gmail.com" className={`flex items-center gap-1.5 text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
                    <Mail className="w-3.5 h-3.5" />
                    quantovalehoje@gmail.com
                  </a>
                </li>
                <li>
                  <Link to="/parceiro/cadastro" className={`text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>Seja um Parceiro</Link>
                </li>
                <li>
                  <Link to="/parceiro/login" className={`text-sm transition-colors duration-200 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>Login Parceiro</Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className={`pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              &copy; {new Date().getFullYear()} Quanto Vale. Todos os direitos reservados.
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
          to="/cadastro"
          className={`flex items-center justify-between w-full px-5 py-3.5 rounded-xl text-sm font-semibold transition-all ${
            heroProduct === 'pitch'
              ? 'bg-purple-600 text-white hover:brightness-110'
              : 'bg-emerald-600 text-white hover:brightness-110'
          }`}
        >
          <span>{heroProduct === 'pitch' ? 'Criar meu pitch deck' : 'Iniciar valuation'}</span>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-normal opacity-80`}>{heroProduct === 'pitch' ? 'R$ 697' : 'a partir de R$ 997'}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      <WhatsAppButton />
    </div>
  );
}
