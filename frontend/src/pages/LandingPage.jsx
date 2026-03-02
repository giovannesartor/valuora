import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ArrowRight, BarChart3, Shield, FileText, TrendingUp,
  Zap, Target, Mail, ChevronRight, Lock,
  Cpu, Database, LineChart, CheckCircle, Activity,
  Building2, Users, Award, Clock, Eye, Briefcase,
  ChevronDown, PieChart, Menu, X, DollarSign as DollarIcon,
  Instagram, Brain, GitCompareArrows,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import DiagnosticoModal from '../components/DiagnosticoModal';
import WhatsAppButton from '../components/WhatsAppButton';
import EmeraldParticles from '../components/EmeraldParticles';
import Counter from '../components/Counter';
import LazySection from '../components/LazySection';
import GlowDivider from '../components/GlowDivider';
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

  // Barra de preço fixa — exibir ao passar do hero
  useEffect(() => {
    const onScroll = () => setShowStickyBar(window.scrollY > 600);
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

  return (
    <div className={`min-h-screen overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>

      {/* ─── Navbar ──────────────────────────────────────── */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-colors duration-300 ${isDark ? 'bg-slate-950/80 border-slate-800/50' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg?v=2" alt="QV" className="w-8 h-8" />
            <span className={`font-bold text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Quanto Vale</span>
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
                className={`text-sm transition border-b-2 pb-0.5 ${
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
            <Link to="/login" className={`hidden md:inline-block text-sm font-medium transition px-4 py-2 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              Entrar
            </Link>
            <Link to="/parceiro/login" className={`hidden md:inline-block text-sm font-medium transition px-3 py-2 rounded-lg ${isDark ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}>
              Parceiro
            </Link>
            <Link to="/cadastro" className="hidden sm:inline-block bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 md:px-5 py-2 rounded-lg text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-600/25">
              Iniciar avaliação
            </Link>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className={`md:hidden p-3 rounded-xl transition-all duration-500 ease-out hover:scale-110 hover:shadow-lg hover:shadow-emerald-500/20 ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              {mobileNavOpen ? <X className="w-6 h-6 transition-transform duration-300 hover:rotate-90" /> : <Menu className="w-6 h-6 transition-transform duration-300 hover:rotate-90" />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileNavOpen && (
          <div className={`md:hidden border-t ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="px-4 py-4 space-y-2">
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
                  className={`block px-6 py-4 sm:px-4 sm:py-2.5 rounded-xl text-base sm:text-sm font-medium transition-all duration-500 ease-out hover:scale-105 hover:-translate-y-0.5 hover:shadow-lg ${isDark ? 'text-slate-300 hover:bg-slate-800 hover:border-emerald-500/30 border border-transparent' : 'text-slate-600 hover:bg-slate-50 hover:border-emerald-500/20 border border-transparent'}`}
                >
                  {item.label}
                </a>
              ))}
              <div className={`h-px my-2 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <Link
                to="/login"
                onClick={() => setMobileNavOpen(false)}
                className={`block px-6 py-4 sm:px-4 sm:py-2.5 rounded-xl text-base sm:text-sm font-medium transition-all duration-500 ease-out hover:scale-105 hover:-translate-y-0.5 hover:shadow-lg ${isDark ? 'text-slate-300 hover:bg-slate-800 hover:border-emerald-500/30 border border-transparent' : 'text-slate-600 hover:bg-slate-50 hover:border-emerald-500/20 border border-transparent'}`}
              >
                Entrar
              </Link>
              <Link
                to="/parceiro/login"
                onClick={() => setMobileNavOpen(false)}
                className={`block px-6 py-4 sm:px-4 sm:py-2.5 rounded-xl text-base sm:text-sm font-medium transition-all duration-500 ease-out hover:scale-105 hover:-translate-y-0.5 hover:shadow-lg ${isDark ? 'text-emerald-400 hover:bg-slate-800 hover:border-emerald-500/30 border border-transparent' : 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-500/20 border border-transparent'}`}
              >
                Login Parceiro
              </Link>
              <Link
                to="/cadastro"
                onClick={() => setMobileNavOpen(false)}
                className="block text-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 sm:px-4 sm:py-2.5 rounded-xl text-base sm:text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all duration-500 ease-out hover:scale-105 hover:shadow-xl hover:shadow-emerald-600/30"
              >
                Iniciar avaliação
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Barra fixa ──────────────────────────────────── */}
      {showStickyBar && (
        <div className={`fixed top-16 left-0 right-0 z-40 flex items-center justify-center gap-3 py-2 text-xs font-medium backdrop-blur-xl border-b transition-all ${
          isDark ? 'bg-slate-900/95 border-slate-800 text-slate-400' : 'bg-white/95 border-slate-200 text-slate-600'
        }`}>
          <span className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Valuation a partir de R$ 997</span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
          <span className={`font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Pitch Deck R$ 697</span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>·</span>
          <span>Pagamento único</span>
          <Link to="/cadastro" className="ml-1 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 transition">
            Iniciar →
          </Link>
        </div>
      )}

      {/* ─── Hero ────────────────────────────────────────── */}
      <section className="relative pt-20 pb-20 md:pt-28 md:pb-28">
        <div className="absolute inset-0 overflow-hidden">
          <EmeraldParticles isDark={isDark} />
        </div>
        <div className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${isDark ? 'from-slate-950/88 via-slate-950/75 to-slate-950/88' : 'from-white/90 via-white/78 to-white/90'}`} />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-[160px] pointer-events-none transition-all duration-700"
          style={{ background: heroProduct === 'pitch'
            ? isDark
              ? 'radial-gradient(ellipse, rgba(168,85,247,0.15) 0%, transparent 68%)'
              : 'radial-gradient(ellipse, rgba(168,85,247,0.18) 0%, transparent 68%)'
            : isDark
              ? 'radial-gradient(ellipse, rgba(16,185,129,0.18) 0%, transparent 68%)'
              : 'radial-gradient(ellipse, rgba(16,185,129,0.20) 0%, transparent 68%)'
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 text-center">
          {/* ─── P2+P3: Product switcher badge ─── */}
          <div className={`inline-flex items-center gap-1 p-1 rounded-xl border mb-8 ${isDark ? 'bg-slate-900/80 border-slate-700/60' : 'bg-slate-100 border-slate-200'}`}>
            <button
              onClick={() => setHeroProduct('valuation')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
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
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                heroProduct === 'pitch'
                  ? isDark ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white text-purple-700 border border-purple-200 shadow-sm'
                  : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Investor Pitch Deck
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>NOVO</span>
            </button>
          </div>

          <h1 className={`text-4xl md:text-5xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-[1.05] mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Quanto vale
            <br />
            <span className={`text-transparent bg-clip-text bg-gradient-to-r ${heroProduct === 'pitch' ? 'from-purple-500 to-indigo-400' : 'from-emerald-500 to-teal-400'} transition-all duration-500`}>sua empresa?</span>
            <br />
            <span className={`text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {twText}
              <span
                className={`inline-block w-[2px] h-[0.8em] align-middle ml-0.5 translate-y-[-0.05em] ${isDark ? 'bg-slate-400' : 'bg-slate-500'}`}
                style={{ animation: twDone ? 'blink 1s step-end infinite' : 'none', opacity: twDone ? undefined : 1 }}
              />
            </span>
          </h1>

          {/* ─── Dynamic hero content ─── */}
          <div key={heroProduct} style={{ animation: 'fadeIn 0.35s ease-out' }}>

            {heroProduct === 'valuation' ? (
              <>
                <p className={`text-base md:text-lg lg:text-xl max-w-3xl mx-auto mb-4 leading-relaxed font-normal md:font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Valuation profissional em minutos — não em semanas.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                  {[
                    { icon: Cpu,      label: 'Motor DCF Institucional',          border: 'emerald' },
                    { icon: Brain,    label: 'Análise por Inteligência Artificial', border: 'teal' },
                    { icon: FileText, label: 'Até 25 páginas de relatório',       border: 'emerald' },
                  ].map(({ icon: Icon, label, border }, i) => (
                    <div key={i} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold tracking-wide ${
                      border === 'teal'
                        ? isDark ? 'bg-slate-900/80 border-teal-500/30 text-teal-400' : 'bg-teal-50 border-teal-200 text-teal-700'
                        : isDark ? 'bg-slate-900/80 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </div>
                  ))}
                </div>

                <p className={`text-sm md:text-base lg:text-lg max-w-3xl mx-auto mb-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  O rigor do DCF com a interpretação da IA — dados IBGE, até 25 páginas de relatório e o mesmo padrão de M&A por{' '}
                  <span className={isDark ? 'text-emerald-400 font-bold' : 'text-emerald-600 font-bold'}>30x menos</span>.
                </p>

                <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-lg mb-10 text-sm font-medium border ${isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  <span className="line-through opacity-50">R$ 15.000</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>a partir de R$ 997</span>
                  <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>pagamento único</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                  <Link to="/cadastro" className="group flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-10 py-4 md:py-5 rounded-xl text-base md:text-lg font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all duration-500 ease-out shadow-2xl shadow-emerald-600/40 ring-4 ring-emerald-500/30 hover:scale-105">
                    Iniciar valuation
                    <ArrowRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform duration-500" />
                  </Link>
                  <button
                    onClick={() => setDiagnosticoOpen(true)}
                    className={`flex items-center gap-2 text-sm font-medium transition-all duration-500 ease-out px-6 py-4 rounded-xl border ${isDark ? 'border-slate-700 text-slate-300 hover:border-emerald-500 hover:text-emerald-400 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-105' : 'border-slate-300 text-slate-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-105'}`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Diagnóstico Gratuito
                  </button>
                </div>
                <p className={`text-xs mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Grátis para começar • Resultado em 5 minutos
                </p>
                <a
                  href="/relatorio-exemplo.pdf?v=5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 text-sm font-medium mb-10 px-4 py-2 rounded-lg border transition-all duration-300 hover:scale-105 ${
                    isDark
                      ? 'border-slate-700 text-slate-300 bg-slate-900/60 hover:border-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/5'
                      : 'border-slate-300 text-slate-600 bg-white/80 hover:border-emerald-500 hover:text-emerald-600 hover:shadow-md hover:shadow-emerald-500/10'
                  }`}
                >
                  <FileText className="w-4 h-4 text-emerald-500" />
                  Ver exemplo de relatório estratégico
                  <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                </a>
              </>
            ) : (
              <>
                <p className={`text-base md:text-lg lg:text-xl max-w-3xl mx-auto mb-4 leading-relaxed font-normal md:font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Pitch deck profissional para investidores — em minutos.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                  {[
                    { icon: Brain,    label: 'Narrativa gerada por IA',    color: 'purple' },
                    { icon: LineChart, label: 'Gráficos e projeções',       color: 'indigo' },
                    { icon: Users,    label: 'Equipe com foto e LinkedIn', color: 'purple' },
                    { icon: FileText, label: 'Design premium — 13 seções', color: 'indigo' },
                  ].map(({ icon: Icon, label, color }, i) => (
                    <div key={i} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold tracking-wide ${
                      color === 'purple'
                        ? isDark ? 'bg-slate-900/80 border-purple-500/30 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-700'
                        : isDark ? 'bg-slate-900/80 border-indigo-500/30 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </div>
                  ))}
                </div>

                <p className={`text-sm md:text-base lg:text-lg max-w-3xl mx-auto mb-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  13 seções completas — problema, mercado, modelo de negócios, equipe, projeções financeiras e mais.{' '}
                  <span className={isDark ? 'text-purple-400 font-bold' : 'text-purple-600 font-bold'}>Pronto para captar investimento</span>.
                </p>

                <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-lg mb-10 text-sm font-medium border ${isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  <span className="line-through opacity-50">R$ 3.000</span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-500" />
                  <span className={`font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>R$ 697</span>
                  <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>pagamento único</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                  <Link to="/cadastro" className="group flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-10 py-4 md:py-5 rounded-xl text-base md:text-lg font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all duration-500 ease-out shadow-2xl shadow-purple-600/40 ring-4 ring-purple-500/30 hover:scale-105">
                    Criar meu pitch deck
                    <ArrowRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform duration-500" />
                  </Link>
                  <button
                    onClick={() => setHeroProduct('valuation')}
                    className={`flex items-center gap-2 text-sm font-medium transition-all duration-500 ease-out px-6 py-4 rounded-xl border ${isDark ? 'border-slate-700 text-slate-300 hover:border-purple-500 hover:text-purple-400 hover:bg-slate-800/50 hover:scale-105' : 'border-slate-300 text-slate-600 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50/50 hover:scale-105'}`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Ver Valuation DCF
                  </button>
                </div>
                <p className={`text-xs mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Resultado em minutos • Sem design necessário
                </p>
                <a
                  href="/pitchdeck-exemplo.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 text-sm font-medium mb-10 px-4 py-2 rounded-lg border transition-all duration-300 hover:scale-105 ${
                    isDark
                      ? 'border-slate-700 text-slate-300 bg-slate-900/60 hover:border-purple-500 hover:text-purple-400 hover:bg-purple-500/5'
                      : 'border-slate-300 text-slate-600 bg-white/80 hover:border-purple-400 hover:text-purple-600 hover:shadow-md hover:shadow-purple-500/10'
                  }`}
                >
                  <Briefcase className="w-4 h-4 text-purple-500" />
                  Ver exemplo de pitch deck
                  <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                </a>
              </>
            )}
          </div>

          {/* Metrics bar */}
          <div className={`inline-flex items-center justify-center divide-x rounded-2xl px-2 py-4 border ${isDark ? 'bg-slate-900/80 border-emerald-500/20 shadow-lg shadow-emerald-600/10 divide-slate-800' : 'bg-white shadow-xl shadow-slate-200 border-slate-200 divide-slate-200'}`}>
            {[
              { end: 100, suffix: '+', label: 'empresas' },
              { end: 35,  suffix: '+', label: 'setores'  },
              { end: 98,  suffix: '%', label: 'satisfação'},
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center px-6 sm:px-8 md:px-10">
                <span className={`text-xl sm:text-2xl font-bold tabular-nums leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <Counter end={item.end} suffix={item.suffix} />
                </span>
                <span className={`text-[10px] uppercase tracking-wider font-medium mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</span>
              </div>
            ))}
          </div>

        </div>
      </section>

      <GlowDivider isDark={isDark} />

      {/* ─── L1: Comparison Table ───────────────────────────── */}
      <section className="py-14 relative">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// comparação</p>
            <h2 className={`text-2xl md:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Por que o{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Quanto Vale</span>{' '}
              é diferente?
            </h2>
          </div>

          <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200 shadow-sm'}`}>
            {/* Header row */}
            <div className={`grid grid-cols-[minmax(100px,auto)_1fr_1fr] ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
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
              { label: 'Disponib.',     qv: '24h por dia, qualquer lugar',     cons: 'Horário comercial, presencial' },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-[minmax(100px,auto)_1fr_1fr] border-b last:border-b-0 ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
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

          <div className="text-center mt-7">
            <Link to="/cadastro" className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-7 py-3.5 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/20 hover:scale-105">
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
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-red-400/60' : 'text-red-500/60'}`}>// o problema</p>
            <h2 className={`text-3xl md:text-4xl font-bold mb-6 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// a solução</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Cpu,
                title: 'Motor Institucional',
                desc: 'DCF com FCFE projetado por 10 anos, WACC, beta setorial Damodaran e Selic atualizada — mesma metodologia de consultorias de M&A.',
                tag: 'Motor DCF v5',
              },
              {
                icon: Database,
                title: 'Dados Oficiais IBGE',
                desc: 'Benchmarks calibrados em tempo real pelas APIs CNAE v2 e SIDRA v3 do IBGE. Seu valuation reflete o mercado real do seu setor.',
                tag: 'IBGE SIDRA API',
              },
              {
                icon: FileText,
                title: 'Relatório Defensável',
                desc: 'Até 25 páginas com memória de cálculo, hipóteses, cenários e análise por IA — pronto para investidores, sócios ou bancos.',
                tag: 'PDF Premium',
              },
            ].map((item, i) => (
              <div key={i} className={`rounded-2xl border p-8 text-center transition-all hover:-translate-y-1 hover:shadow-xl ${isDark ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/30 hover:shadow-emerald-500/5' : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-emerald-100'}`}>
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
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-teal-400/60' : 'text-teal-600/60'}`}>// use cases</p>
            <h2 className={`text-3xl md:text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Feito para quem precisa de{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">respostas concretas</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Building2, title: 'Empresário que quer vender', desc: 'Saiba exatamente quanto pedir antes de iniciar qualquer negociação de venda.', color: 'from-emerald-500 to-emerald-600' },
              { icon: TrendingUp, title: 'Startup em captação', desc: 'Apresente um valuation profissional e defensável para investidores e fundos.', color: 'from-teal-500 to-emerald-500' },
              { icon: Award, title: 'Contabilidade / Consultoria', desc: 'Ofereça valuation como serviço adicional para seus clientes. Seja parceiro.', color: 'from-cyan-500 to-teal-500' },
              { icon: Users, title: 'Quem quer comprar', desc: 'Avalie a empresa-alvo antes de fazer uma oferta e negocie com dados reais.', color: 'from-teal-500 to-emerald-500' },
            ].map((item, i) => (
              <div key={i} className={`rounded-2xl border p-6 transition-all hover:shadow-lg hover:-translate-y-1 ${isDark ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <GlowDivider isDark={isDark} />

      {/* ─── Como funciona ────────────────────────────────── */}
      <section id="como-funciona" className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// como funciona</p>
            <h2 className={`text-3xl md:text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
      <section className="py-16 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// nossos produtos</p>
            <h2 className={`text-3xl md:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
            <div className={`relative group rounded-2xl border-2 p-8 transition-all hover:shadow-2xl ${isDark ? 'border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 hover:border-emerald-500/50' : 'border-emerald-200 bg-gradient-to-br from-white via-emerald-50/30 to-white hover:border-emerald-400'}`}>
              <div className="absolute -top-3 left-6">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                  Core
                </span>
              </div>
              <div className="flex items-center gap-3 mb-4 mt-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Valuation DCF</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Motor institucional + IA</p>
                </div>
              </div>
              <p className={`text-sm leading-relaxed mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Relatório profissional de até 25 páginas com DCF, benchmark setorial IBGE, análise de risco, simulador estratégico e narrativa por inteligência artificial.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['DCF Gordon + Exit Multiple', 'Benchmark IBGE', 'Análise IA', 'Até 25 páginas'].map((f, i) => (
                  <span key={i} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    <CheckCircle className="w-3 h-3" />
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-extrabold text-2xl ${isDark ? 'text-white' : 'text-slate-900'}`}>R$997</span>
                  <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>a R$3.997</span>
                </div>
                <Link to="/cadastro" className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/25 hover:scale-105">
                  Iniciar <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <a
                href="/relatorio-exemplo.pdf?v=5"
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
            <div className={`relative group rounded-2xl border-2 p-8 transition-all hover:shadow-2xl ${isDark ? 'border-purple-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/20 hover:border-purple-500/50' : 'border-purple-200 bg-gradient-to-br from-white via-purple-50/30 to-white hover:border-purple-400'}`}>
              <div className="absolute -top-3 left-6">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${isDark ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-600 border border-purple-200'}`}>
                  Novo
                </span>
              </div>
              <div className="flex items-center gap-3 mb-4 mt-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Investor Pitch Deck</h3>
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>PDF pronto para investidores</p>
                </div>
              </div>
              <p className={`text-sm leading-relaxed mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                PDF profissional com 13 seções: problema, solução, mercado, concorrência, modelo de negócios, projeções financeiras, equipe com foto e LinkedIn, roadmap e mais.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Narrativa por IA', 'Gráficos e projeções', 'Equipe com foto', 'Design premium'].map((f, i) => (
                  <span key={i} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium ${isDark ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                    <CheckCircle className="w-3 h-3" />
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-extrabold text-2xl ${isDark ? 'text-white' : 'text-slate-900'}`}>R$697</span>
                  <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ único</span>
                </div>
                <Link to="/cadastro" className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-600/25 hover:scale-105">
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
      <section id="recursos" className="py-16 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-teal-400/60' : 'text-teal-600/60'}`}>// funcionalidades</p>
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3.5 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-600/25 hover:scale-105"
            >
              Comece grátis
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <GlowDivider isDark={isDark} />

      <LazySection minHeight="2800px">
      {/* ─── Metodologia (deep dive) ────────────────────── */}
      <section id="metodologia" className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// metodologia</p>
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
                badge: 'SEBRAE + IBGE',
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
                tags: ['QV Intelligence', 'Executive Summary', 'Contexto setorial', 'Análise de risco', 'Benchmark IBGE'],
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
      <section id="planos" className="py-16 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// pricing</p>
            <h2 className={`text-3xl md:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Pagamento único. Sem assinatura.</h2>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>PIX, boleto ou cartão de crédito</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-6 items-end">
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
              <div key={i} className={`relative rounded-2xl border transition-all flex flex-col ${
                plan.popular
                  ? isDark
                    ? 'border-emerald-500/50 shadow-[0_0_60px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/30'
                    : 'border-emerald-400/50 shadow-[0_0_60px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/30'
                  : isDark ? 'border-slate-800 hover:border-slate-700' : 'border-slate-200 hover:border-emerald-200'
              }`}>
                {plan.popular && (
                  <>
                    <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-emerald-500/15 via-transparent to-teal-500/10 -z-10 blur-sm" />
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold px-5 py-1.5 rounded-full shadow-lg shadow-emerald-600/40 whitespace-nowrap">
                      <Award className="w-3 h-3" /> Mais popular — Mais completo
                    </div>
                  </>
                )}
                <div className={`rounded-2xl flex flex-col flex-1 ${
                  plan.popular
                    ? `p-8 pt-12 ${isDark ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950' : 'bg-gradient-to-b from-emerald-50 via-white to-white'}`
                    : `p-8 ${isDark ? 'bg-slate-900' : 'bg-white'}`
                }`}>
                  <h3 className={`font-bold text-lg ${plan.popular ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-white' : 'text-slate-900')}`}>{plan.name}</h3>
                  <p className={`text-sm mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{plan.desc}</p>
                  <div className="mb-2">
                    <span className={`font-extrabold ${plan.popular ? 'text-5xl' : 'text-4xl'} ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
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
                  <Link to="/cadastro" className={`block text-center rounded-xl font-semibold text-sm transition mt-auto ${
                    plan.popular
                      ? 'py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/40 hover:scale-[1.02]'
                      : `py-3 ${isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`
                  }`}>
                    Iniciar avaliação
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Trust & payment badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-10">
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
      <section id="parceiros" className="py-16 relative">
        {isDark && (
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[300px] bg-teal-600/5 rounded-full blur-[100px]" />
        )}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// parceiros</p>
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
              <div key={i} className={`rounded-2xl border p-6 transition-all hover:shadow-lg ${isDark ? 'bg-slate-900/50 border-slate-800 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
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
              <h3 className={`text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
                className="group inline-flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-10 py-5 rounded-2xl text-lg font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-2xl shadow-emerald-600/30 hover:shadow-emerald-500/40 hover:scale-[1.02]"
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
      <section className="py-16 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>// dúvidas frequentes</p>
            <h2 className={`text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Perguntas frequentes</h2>
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
                a: 'APIs oficiais IBGE CNAE v2 e SIDRA v3, atualizadas automaticamente. Nenhum dado manual ou estimativa — só fontes oficiais.',
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

      <GlowDivider isDark={isDark} />

      {/* ─── CTA Final ───────────────────────────────────── */}
      <section className="py-16 relative">
        {isDark ? (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-600/10 rounded-full blur-[120px]" />
          </>
        ) : (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-100/60 rounded-full blur-[120px]" />
        )}

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className={`text-3xl md:text-5xl font-bold mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
            <Link to="/cadastro" className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-2xl shadow-emerald-600/20">
              Iniciar valuation
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Grátis para começar • Resultado em 5 minutos
          </p>
        </div>
      </section>

      {/* ─── Diagnóstico Modal ───────────────────────────── */}
      <DiagnosticoModal isOpen={diagnosticoOpen} onClose={() => setDiagnosticoOpen(false)} />

      {/* ─── Footer ──────────────────────────────────────── */}
      <footer className={`py-12 pb-24 md:pb-12 border-t ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center gap-3">
              <img src="/favicon.svg?v=2" alt="QV" className="w-8 h-8" />
              <span className={`font-bold text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Quanto Vale</span>
            </div>

            <div className="flex items-center gap-3">
              {[
                { href: 'https://instagram.com/quantovale.online', icon: Instagram, label: 'Instagram' },
              ].map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={`p-2 rounded-lg transition ${isDark ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>

            <div className={`flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <Link to="/termos-de-uso" className={`transition hover:underline ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                Termos de Uso
              </Link>
              <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
              <Link to="/politica-de-privacidade" className={`transition hover:underline ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                Política de Privacidade
              </Link>
              <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
              <Link to="/parceiro/cadastro" className={`transition hover:underline ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                Seja um Parceiro
              </Link>
              <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
              <Link to="/parceiro/login" className={`transition hover:underline ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                Login Parceiro
              </Link>
              <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span>
              <a href="mailto:quantovalehoje@gmail.com" className={`transition flex items-center gap-1.5 ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                <Mail className="w-3.5 h-3.5" />
                quantovalehoje@gmail.com
              </a>
            </div>

            <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>&copy; {new Date().getFullYear()} Quanto Vale. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
      <WhatsAppButton />
    </div>
  );
}
