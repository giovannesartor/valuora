import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, BarChart3, Shield, FileText, TrendingUp,
  Zap, Target, Mail, ChevronRight, Lock,
  Cpu, Database, LineChart, CheckCircle, Activity,
  Building2, Users, Award, Clock, Eye, Briefcase,
  ChevronDown, Layers, PieChart, Gauge, Menu, X, DollarSign as DollarIcon,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import ExitIntentPopup from '../components/ExitIntentPopup';
import DiagnosticoModal from '../components/DiagnosticoModal';
import { useTheme } from '../context/ThemeContext';

// ─── Animated counter (triggers on scroll into view) ──────
function Counter({ end, suffix = '', prefix = '' }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const duration = 2000;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [end, started]);

  return <span ref={ref}>{prefix}{count.toLocaleString('pt-BR')}{suffix}</span>;
}

// ─── Word swap animation ──────────────────────────────────
function WordSwap({ words }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('visible');

  useEffect(() => {
    if (phase === 'visible') {
      const timer = setTimeout(() => setPhase('exit'), 2800);
      return () => clearTimeout(timer);
    }
    if (phase === 'exit') {
      const timer = setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setPhase('enter');
      }, 500);
      return () => clearTimeout(timer);
    }
    if (phase === 'enter') {
      const timer = setTimeout(() => setPhase('visible'), 50);
      return () => clearTimeout(timer);
    }
  }, [phase, words.length]);

  const animClass = phase === 'exit'
    ? 'opacity-0 translate-y-4 blur-sm'
    : phase === 'enter'
    ? 'opacity-0 -translate-y-4 blur-sm'
    : 'opacity-100 translate-y-0 blur-0';

  return (
    <span className="relative inline-block overflow-visible pb-3">
      <span className={`inline-block transition-all duration-500 ease-out text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400 ${animClass}`}>
        {words[index]}
      </span>
      <span className="ml-0.5 inline-block w-[3px] h-[0.85em] bg-gradient-to-b from-emerald-400 to-teal-400 rounded-full animate-pulse align-middle" />
    </span>
  );
}

// ─── SVG icon paths for hero particles ────────────────────
// Premium financial SVG paths (24×24 viewBox) — chart bars, trend line, coin stack, pie chart, candlestick, diamond, target, shield
const PARTICLE_ICONS = [
  // Bar chart rising
  'M3 20h2v-8H3v8zm4 0h2V9H7v11zm4 0h2v-6h-2v6zm4 0h2V4h-2v16z',
  // Trend line up
  'M3 17l5-5 4 4 8-10 1.4 1.4L13 17l-4-4-4.6 4.6z',
  // Coin / dollar circle
  'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 14h-2v-1h-1a2 2 0 0 1-2-2h2a1 1 0 0 0 1 1h2a1 1 0 0 0 0-2h-2a3 3 0 0 1 0-6h1V5h2v1h1a2 2 0 0 1 2 2h-2a1 1 0 0 0-1-1h-2a1 1 0 0 0 0 2h2a3 3 0 0 1 0 6h-1v1z',
  // Pie chart
  'M11 2v10H2a10 10 0 0 0 9 10 10 10 0 0 0 10-10A10 10 0 0 0 11 2zm2 0v8h8a10 10 0 0 0-8-8z',
  // Candlestick
  'M9 4v3H7v10h2v3h2v-3h-2V7h2V4H9zm6 2v3h-2v6h2v3h2v-3h-2v-6h2V6h-2z',
  // Gem / diamond
  'M6 3l-3 7 9 11 9-11-3-7H6zm2.5 1h7l2 5H6.5l2-5zM12 18.5L5.5 11h13L12 18.5z',
  // Target / bullseye
  'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  // Shield check
  'M12 2L3 7v5c0 5 3.8 9.7 9 11 5.2-1.3 9-6 9-11V7l-9-5zm-1.5 14.5l-3.5-3.5 1.4-1.4 2.1 2.1 5.1-5.1 1.4 1.4-6.5 6.5z',
];

const HERO_PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  path: PARTICLE_ICONS[i % PARTICLE_ICONS.length],
  size: `${20 + (i % 5) * 6}px`,
  left: `${3 + ((i * 6.2) % 90)}%`,
  top: `${8 + ((i * 11.7) % 75)}%`,
  dur: 7 + (i % 5) * 2.4,
  delay: i * 0.9,
}));

export default function LandingPage() {
  const { isDark } = useTheme();
  const [openFaq, setOpenFaq] = useState(null);
  const [openMethod, setOpenMethod] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [diagnosticoOpen, setDiagnosticoOpen] = useState(false);

  // Smooth scroll for anchor links
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
            <a href="#como-funciona" className={`text-sm transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Como funciona</a>
            <a href="#metodologia" className={`text-sm transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Metodologia</a>
            <a href="#recursos" className={`text-sm transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Recursos</a>
            <a href="#planos" className={`text-sm transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Planos</a>
            <a href="#parceiros" className={`text-sm transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Parceiros</a>
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
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className={`md:hidden p-2 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileNavOpen && (
          <div className={`md:hidden border-t ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="px-4 py-4 space-y-2">
              {[
                { href: '#como-funciona', label: 'Como funciona' },
                { href: '#metodologia', label: 'Metodologia' },
                { href: '#recursos', label: 'Recursos' },
                { href: '#planos', label: 'Planos' },
                { href: '#parceiros', label: 'Parceiros' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {item.label}
                </a>
              ))}
              <div className={`h-px my-2 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <Link
                to="/login"
                onClick={() => setMobileNavOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Entrar
              </Link>
              <Link
                to="/parceiro/login"
                onClick={() => setMobileNavOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition ${isDark ? 'text-emerald-400 hover:bg-slate-800' : 'text-emerald-600 hover:bg-emerald-50'}`}
              >
                Login Parceiro
              </Link>
              <Link
                to="/cadastro"
                onClick={() => setMobileNavOpen(false)}
                className="block text-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition"
              >
                Iniciar avaliação
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Hero ────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 md:pt-44 md:pb-36">
        {/* Animated gradient mesh background */}
        {isDark ? (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] rounded-full blur-[160px]" style={{ background: 'radial-gradient(ellipse, rgba(5,150,105,0.08) 0%, rgba(13,148,136,0.04) 50%, transparent 70%)', animation: 'meshPulse 12s ease-in-out infinite' }} />
            <div className="absolute top-[20%] right-[15%] w-[400px] h-[400px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)', animation: 'meshDrift 15s ease-in-out infinite' }} />
            <div className="absolute bottom-[15%] left-[10%] w-[350px] h-[350px] rounded-full blur-[130px]" style={{ background: 'radial-gradient(circle, rgba(5,150,105,0.05) 0%, transparent 70%)', animation: 'meshDrift 18s ease-in-out infinite reverse' }} />
            <div className="absolute top-[60%] right-[30%] w-[250px] h-[250px] rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.04) 0%, transparent 70%)', animation: 'meshPulse 10s ease-in-out infinite 3s' }} />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.04)_1px,transparent_1px)] bg-[size:64px_64px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full blur-[140px]" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, rgba(13,148,136,0.06) 50%, transparent 70%)', animation: 'meshPulse 12s ease-in-out infinite' }} />
            <div className="absolute top-[25%] right-[10%] w-[450px] h-[450px] rounded-full blur-[130px]" style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)', animation: 'meshDrift 15s ease-in-out infinite' }} />
            <div className="absolute bottom-[20%] left-[15%] w-[350px] h-[350px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)', animation: 'meshDrift 18s ease-in-out infinite reverse' }} />
          </>
        )}
        {/* Floating SVG financial icon particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {HERO_PARTICLES.map((p, i) => (
            <svg
              key={i}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`absolute ${isDark ? 'text-emerald-400/[0.07]' : 'text-emerald-500/[0.08]'}`}
              style={{
                width: p.size,
                height: p.size,
                left: p.left,
                top: p.top,
                animation: `floatParticle ${p.dur}s ease-in-out infinite`,
                animationDelay: `${p.delay}s`,
              }}
            >
              <path d={p.path} />
            </svg>
          ))}
        </div>
        <style>{`
          @keyframes floatParticle {
            0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
            25% { transform: translateY(-25px) rotate(6deg); opacity: 1; }
            50% { transform: translateY(-40px) rotate(-4deg); opacity: 0.8; }
            75% { transform: translateY(-18px) rotate(3deg); opacity: 1; }
          }
          @keyframes meshPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.08); opacity: 0.7; }
          }
          @keyframes meshDrift {
            0%, 100% { transform: translate(0, 0); }
            33% { transform: translate(30px, -20px); }
            66% { transform: translate(-20px, 15px); }
          }
        `}</style>

        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 backdrop-blur-sm border ${isDark ? 'bg-slate-800/80 border-slate-700/50 text-slate-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Sistema profissional de valuation • DCF + IBGE
          </div>

          <h1 className={`text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.3] mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Descubra quanto
            <br />
            <WordSwap words={['sua startup', 'seu negócio', 'sua empresa']} />
            <br />
            realmente vale
          </h1>

          <p className={`text-lg md:text-xl max-w-3xl mx-auto mb-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Antes de negociar. Antes de vender. Antes de decidir.
          </p>
          <p className={`text-base md:text-lg max-w-3xl mx-auto mb-10 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            O Quanto Vale é um sistema profissional de valuation baseado em{' '}
            <span className={isDark ? 'text-white font-medium' : 'text-slate-900 font-medium'}>DCF (Gordon Growth + Exit Multiple)</span>, múltiplos
            de mercado Damodaran, DLOM, análise de risco e relatório executivo de ~20 páginas.
          </p>

          <div className={`max-w-xl mx-auto rounded-2xl px-8 py-5 mb-10 border ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-emerald-50/60 border-emerald-100'}`}>
            <p className={`text-base italic ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              "Você construiu um patrimônio.<br />Agora saiba quanto ele vale."
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link to="/cadastro" className="group flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-2xl shadow-emerald-600/20">
              Iniciar valuation
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button
              onClick={() => setDiagnosticoOpen(true)}
              className={`flex items-center gap-2 text-sm font-medium transition px-6 py-4 rounded-xl border ${isDark ? 'border-slate-700 text-slate-300 hover:border-emerald-500 hover:text-emerald-400' : 'border-slate-300 text-slate-600 hover:border-emerald-500 hover:text-emerald-600'}`}
            >
              <BarChart3 className="w-4 h-4" />
              Diagnóstico Gratuito
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-16">
            {[
              { icon: Lock, label: 'SSL Seguro' },
              { icon: Shield, label: 'LGPD' },
              { icon: Database, label: 'Dados IBGE Oficiais' },
              { icon: CheckCircle, label: 'Método DCF Internacional' },
            ].map((badge, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <badge.icon className="w-3.5 h-3.5" />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>

          <div className={`inline-flex flex-wrap items-center justify-center gap-6 md:gap-8 lg:gap-12 rounded-2xl px-6 md:px-8 py-5 backdrop-blur-sm border ${isDark ? 'bg-slate-900/80 border-slate-800/50' : 'bg-slate-50 border-slate-200'}`}>
            {[
              { value: <Counter end={500} suffix="+" />, label: 'Empresas avaliadas' },
              { value: <Counter end={35} suffix="+" />, label: 'Setores IBGE' },
              { value: <Counter end={98} suffix="%" />, label: 'Precisão DCF' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-8 md:gap-12">
                {i > 0 && <div className={`w-px h-10 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />}
                <div className="text-center">
                  <p className={`text-2xl md:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.value}</p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Problem ─────────────────────────────────────── */}
      <section className="py-24 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-red-400 text-xs font-semibold mb-4 uppercase tracking-wider">
                <div className="w-6 h-px bg-red-400" />
                A maioria dos empresários decide no escuro
              </div>
              <h2 className={`text-3xl md:text-4xl font-bold mb-6 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Sem valuation estruturado, qualquer negociação começa com{' '}
                <span className="text-red-400">assimetria de informação</span>
              </h2>
              <div className={`space-y-3 mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {['Venda de participação.', 'Entrada de sócio.', 'Captação de investimento.', 'Planejamento de saída.'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <p className={`leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Consultorias tradicionais levam semanas e custam entre{' '}
                <span className={isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>R$ 5.000 a R$ 50.000</span>.
              </p>
              <p className={`mt-3 font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                O Quanto Vale entrega uma análise técnica, fundamentada e documentada em minutos.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Cpu, title: 'Motor DCF', desc: 'Projeção de fluxo de caixa livre por 5 a 10 anos com WACC setorial' },
                { icon: Database, title: 'Dados Oficiais', desc: 'Parâmetros calibrados com dados IBGE via CNAE e SIDRA' },
                { icon: LineChart, title: 'Score de Risco', desc: 'Avaliação multidimensional baseada em dados reais do mercado' },
                { icon: Lock, title: 'Sigilo Total', desc: 'Criptografia ponta a ponta e conformidade com LGPD' },
              ].map((item, i) => (
                <div key={i} className={`rounded-2xl p-5 border transition ${isDark ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-200 shadow-sm'}`}>
                  <item.icon className="w-5 h-5 text-emerald-500 mb-3" />
                  <h3 className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Methodology ────────────────────────────────── */}
      <section id="metodologia" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-emerald-500 text-xs font-semibold mb-4 uppercase tracking-wider">
              <div className="w-6 h-px bg-emerald-500" />
              Metodologia de Cálculo
              <div className="w-6 h-px bg-emerald-500" />
            </div>
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              6 camadas de análise para um valuation defensável
            </h2>
            <p className={`text-lg max-w-3xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Combinamos <span className={isDark ? 'text-white font-medium' : 'text-slate-900 font-medium'}>três métodos de avaliação</span> com{' '}
              <span className={isDark ? 'text-white font-medium' : 'text-slate-900 font-medium'}>três camadas de ajuste</span> — a mesma abordagem usada por consultorias de M&A.
            </p>
          </div>

          {/* Accordion items */}
          <div className="space-y-3">
            {[
              {
                icon: TrendingUp,
                title: 'DCF — Gordon Growth',
                badge: '60% do DCF',
                badgeColor: 'emerald',
                desc: 'Projeta o fluxo de caixa livre (FCL) por 5 a 10 anos e calcula o Terminal Value pela fórmula de crescimento perpétuo de Gordon. Utiliza WACC como taxa de desconto, com beta setorial Damodaran e Selic atualizada.',
                tags: ['FCL projetado', 'Terminal Value', 'WACC', 'Beta setorial'],
              },
              {
                icon: BarChart3,
                title: 'DCF — Exit Multiple',
                badge: '40% do DCF',
                badgeColor: 'emerald',
                desc: 'Mesmo fluxo de caixa projetado, porém o Terminal Value é calculado aplicando um múltiplo EV/EBITDA setorial ao EBITDA do último ano projetado. Reduz dependência de premissas de crescimento perpétuo.',
                tags: ['EV/EBITDA', 'Terminal Value', 'Múltiplo de saída', 'EBITDA projetado'],
              },
              {
                icon: PieChart,
                title: 'Múltiplos Setoriais',
                badge: 'Peso configurável',
                badgeColor: 'emerald',
                desc: 'Avaliação independente por EV/Receita e EV/EBITDA do setor, com dados reais de Damodaran/NYU Stern. Triangulado com o DCF para maior robustez.',
                tags: ['EV/Receita', 'EV/EBITDA', 'Damodaran', 'Triangulação'],
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
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border overflow-hidden transition ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  onClick={() => setOpenMethod(openMethod === i ? null : i)}
                  className={`w-full flex items-center justify-between px-5 py-4 text-left transition ${isDark ? 'hover:bg-slate-900/80' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 bg-gradient-to-br ${item.badgeColor === 'emerald' ? 'from-emerald-500 to-teal-500' : 'from-teal-500 to-cyan-500'} rounded-lg flex items-center justify-center shadow`}>
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
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 text-sm">
              {[
                { label: 'DCF Gordon', color: 'emerald' },
                { label: 'DCF Exit Multiple', color: 'emerald' },
                { label: 'Múltiplos', color: 'emerald' },
                { label: 'DLOM', color: 'teal' },
                { label: 'Sobrevivência', color: 'teal' },
                { label: 'Qualitativo', color: 'teal' },
                { label: 'Equity Final', color: 'purple' },
              ].map((step, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className={`font-medium px-3 py-1 rounded-lg ${
                    step.color === 'emerald' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700') :
                    step.color === 'teal' ? (isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-100 text-teal-700') :
                    (isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-100 text-purple-700')
                  }`}>{step.label}</span>
                  {i < 6 && <ChevronRight className={`w-3.5 h-3.5 hidden md:block ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />}
                </span>
              ))}
            </div>
            <p className={`text-xs text-center mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Resultado: um valuation técnico, consistente e <span className="font-semibold">defensável</span>.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Features / O que você recebe ────────────────── */}
      <section id="recursos" className="py-24 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-teal-500 text-xs font-semibold mb-4 uppercase tracking-wider">
              <div className="w-6 h-px bg-teal-500" />
              O que você recebe
              <div className="w-6 h-px bg-teal-500" />
            </div>
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
              { icon: BarChart3, title: 'Valuation DCF Completo', desc: 'Valor estimado da empresa com DCF Gordon + Exit Multiple, DLOM e análise de sobrevivência.', gradient: 'from-emerald-500 to-emerald-600' },
              { icon: Database, title: 'Ajuste Setorial Oficial', desc: 'Comparação com indicadores econômicos do seu setor usando dados oficiais do IBGE.', gradient: 'from-teal-500 to-emerald-500' },
              { icon: Target, title: 'Benchmark Estratégico', desc: 'Descubra se sua margem, crescimento e eficiência estão acima ou abaixo do mercado.', gradient: 'from-emerald-500 to-cyan-500' },
              { icon: Shield, title: 'Score de Risco Empresarial', desc: 'Avaliação multidimensional: margem operacional, endividamento, crescimento, volatilidade setorial.', gradient: 'from-purple-500 to-emerald-500' },
              { icon: Layers, title: 'Índice de Maturidade', desc: 'Classificação objetiva: Inicial → Estruturado → Escalável → Vendável.', gradient: 'from-orange-500 to-amber-500' },
              { icon: Zap, title: 'Simulador Interativo', desc: 'Altere crescimento, margem, taxa de desconto e veja o valuation recalcular instantaneamente.', gradient: 'from-pink-500 to-rose-500' },
              { icon: Activity, title: 'Linha do Tempo', desc: 'Visualize o valor projetado: Hoje → Em 3 anos → Em 5 a 10 anos.', gradient: 'from-violet-500 to-purple-500' },
              { icon: FileText, title: 'Relatório PDF Premium', desc: 'Documento institucional com gráficos, projeções, benchmark e análise estratégica por IA.', gradient: 'from-indigo-500 to-emerald-500' },
              { icon: Eye, title: 'Análise IA Estratégica', desc: 'Análise narrativa automatizada com recomendações estratégicas gerada por inteligência artificial.', gradient: 'from-teal-500 to-emerald-500' },
            ].map((item, i) => (
              <div key={i} className={`group relative rounded-2xl p-7 border transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-200 hover:shadow-lg'}`}>
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-gradient-to-br from-emerald-500/5 to-transparent' : 'bg-gradient-to-br from-emerald-50 to-transparent'}`} />
                <div className={`relative w-11 h-11 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center mb-5 shadow-lg`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className={`relative font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                <p className={`relative text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────── */}
      <section id="como-funciona" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-emerald-500 text-xs font-semibold mb-4 uppercase tracking-wider">
              <div className="w-6 h-px bg-emerald-500" />
              Como Funciona
              <div className="w-6 h-px bg-emerald-500" />
            </div>
            <h2 className={`text-3xl md:text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              4 passos para o seu valuation
            </h2>
          </div>

          <div className="space-y-0">
            {[
              { step: '01', title: 'Crie sua conta', desc: 'Cadastro com confirmação por e-mail. Ambiente seguro.', color: 'from-emerald-500 to-emerald-600' },
              { step: '02', title: 'Envie seus dados financeiros', desc: 'Inserção manual ou upload de DRE em PDF/Excel. A IA extrai e estrutura automaticamente.', color: 'from-teal-500 to-emerald-500' },
              { step: '03', title: 'Veja a prévia', desc: 'Receba indicadores principais antes de desbloquear o relatório.', color: 'from-emerald-500 to-cyan-500' },
              { step: '04', title: 'Desbloqueie o relatório completo', desc: 'Escolha o plano e receba o PDF executivo por e-mail.', color: 'from-purple-500 to-emerald-500' },
            ].map((item, i) => (
              <div key={i} className={`flex items-start gap-6 py-8 border-b last:border-0 ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
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

      {/* ─── Pricing ─────────────────────────────────────── */}
      <section id="planos" className="py-24 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-emerald-500 text-xs font-semibold mb-4 uppercase tracking-wider">
              <div className="w-6 h-px bg-emerald-500" />
              Planos
              <div className="w-6 h-px bg-emerald-500" />
            </div>
            <h2 className={`text-3xl md:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Pagamento único. Sem assinatura.</h2>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>PIX, boleto ou cartão de crédito</p>
            <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm ${isDark ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <span>Consultoria tradicional:</span>
              <span className="line-through font-medium">R$ 15.000–50.000</span>
              <span className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>→ a partir de R$ 499</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                name: 'Essencial', price: 'R$499', desc: 'Valuation DCF completo',
                pages: '~8 páginas',
                features: ['Valuation DCF Gordon Growth', 'Score de risco e maturidade', 'Relatório executivo básico', 'Envio por e-mail'],
                popular: false,
              },
              {
                name: 'Profissional', price: 'R$899', desc: 'Análise completa com benchmark',
                pages: '~15 páginas',
                features: ['Tudo do Essencial', 'DCF Exit Multiple + Múltiplos', 'Benchmark setorial oficial', 'DLOM + Sobrevivência + P&L', 'Tabela de sensibilidade', 'Simulador estratégico'],
                popular: false,
              },
              {
                name: 'Estratégico', price: 'R$1.999', desc: 'Máximo nível de análise',
                pages: '~25 páginas',
                features: ['Tudo do Profissional', 'Análise estratégica avançada por IA', 'Avaliação qualitativa radar', 'Simulação de rodada de investimento', 'Relatório mais completo do Brasil'],
                popular: true,
              },
            ].map((plan, i) => (
              <div key={i} className={`relative rounded-2xl border transition-all ${plan.popular ? 'border-emerald-500/50 scale-[1.03] shadow-2xl shadow-emerald-600/10' : isDark ? 'border-slate-800 hover:border-slate-700' : 'border-slate-200 hover:border-emerald-200'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold px-4 py-1 rounded-full shadow-lg">
                    Mais popular
                  </div>
                )}
                <div className={`p-8 rounded-2xl ${plan.popular ? (isDark ? 'bg-gradient-to-b from-slate-900 to-slate-950' : 'bg-gradient-to-b from-emerald-50 to-white') : (isDark ? 'bg-slate-900' : 'bg-white')}`}>
                  <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                  <p className={`text-sm mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{plan.desc}</p>
                  <div className="mb-2">
                    <span className={`text-4xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                    <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ único</span>
                  </div>
                  <p className={`text-xs font-medium mb-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Relatório PDF com {plan.pages}</p>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f, j) => (
                      <li key={j} className={`flex items-center gap-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/cadastro" className={`block text-center py-3 rounded-xl font-semibold text-sm transition ${plan.popular ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/25' : isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}>
                    Iniciar avaliação
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────── */}
      <section className="py-24 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Perguntas frequentes</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: 'O que é um valuation por DCF?', a: 'O Fluxo de Caixa Descontado (DCF) é o método mais utilizado por bancos de investimento para estimar o valor de uma empresa. Ele projeta os fluxos de caixa futuros e os traz a valor presente usando uma taxa de desconto (WACC) que reflete o risco do negócio.' },
              { q: 'De onde vêm os dados setoriais?', a: 'Utilizamos duas APIs oficiais do IBGE: a API CNAE v2 para classificação da atividade econômica e a API de Dados Agregados (SIDRA) v3 para indicadores setoriais como receita média, crescimento histórico e número de empresas. Os dados são atualizados automaticamente e calibram nosso motor DCF.' },
              { q: 'O valuation é confiável para apresentar a investidores?', a: 'Sim. Nosso motor utiliza a mesma metodologia e premissas financeiras adotadas por consultorias de M&A. O relatório PDF inclui memória de cálculo, premissas, cenários e benchmark setorial — pronto para apresentação profissional.' },
              { q: 'Meus dados estão seguros?', a: 'Absolutamente. Utilizamos criptografia ponta a ponta, armazenamento isolado e estamos em conformidade com a LGPD. Seus dados financeiros não são compartilhados com terceiros.' },
              { q: 'Preciso saber finanças para usar?', a: 'Não. Basta inserir os dados básicos da empresa (receita, margem, crescimento) ou fazer upload da sua DRE em PDF/Excel. O sistema extrai, calcula e gera o relatório automaticamente.' },
              { q: 'O pagamento é recorrente?', a: 'Não. É um pagamento único por análise. Sem assinatura, sem mensalidade. Você paga apenas pelo relatório que gerar.' },
            ].map((faq, i) => (
              <div key={i} className={`rounded-xl border overflow-hidden transition ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className={`w-full flex items-center justify-between px-6 py-4 text-left transition ${isDark ? 'hover:bg-slate-900/80' : 'hover:bg-slate-50'}`}
                >
                  <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ml-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className={`px-6 pb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <p className="text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Parceiros ───────────────────────────────────── */}
      <section id="parceiros" className="py-24 relative">
        {isDark && (
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[300px] bg-teal-600/5 rounded-full blur-[100px]" />
        )}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className={`inline-block text-xs font-semibold tracking-widest uppercase mb-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Programa de Parceiros
            </span>
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Transforme indicações em receita
            </h2>
            <p className={`max-w-2xl mx-auto text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Ideal para contabilidades, consultorias e assessorias que querem oferecer valuation profissional como serviço adicional aos seus clientes.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { icon: DollarIcon, title: '50% — meio a meio', desc: 'Dividimos o valor de cada venda no meio. Metade é sua. Sem teto, sem complicação.' },
              { icon: Users, title: 'Gestão completa', desc: 'Painel exclusivo para acompanhar clientes, status e comissões em tempo real.' },
              { icon: Briefcase, title: 'Seu portfólio cresce', desc: 'Ofereça valuation profissional sem investir em equipe ou tecnologia.' },
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

          {/* How it works mini */}
          <div className={`rounded-2xl border p-8 md:p-10 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className={`text-lg font-bold mb-6 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>Como funciona</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Cadastre-se como parceiro', desc: 'Crie sua conta e ative o Modo Parceiro em segundos. Você recebe um link exclusivo de indicação.' },
                { step: '02', title: 'Indique seus clientes', desc: 'Compartilhe o link ou cadastre clientes diretamente no painel. Cada valuation feito é rastreado.' },
                { step: '03', title: 'Receba suas comissões', desc: 'A cada pagamento confirmado do seu cliente, 50% do valor é creditado automaticamente para você. Meio a meio.' },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-sm font-bold mb-4">{s.step}</div>
                  <h4 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.title}</h4>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA apelativo parceiro — dividimos meio a meio */}
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
                Sem burocracia. Sem investimento. Sem limite de ganhos.<br />
                Você indica, o cliente paga, e o dinheiro cai na sua conta via PIX.
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

      {/* ─── CTA Final ───────────────────────────────────── */}
      <section className="py-24 relative">
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
          <p className={`mb-4 text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Valuation profissional. Baseado em dados oficiais. Em minutos.
          </p>
          <Link to="/cadastro" className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-2xl shadow-emerald-600/20">
            Iniciar valuation
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ─── Floating CTA Mobile ────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          to="/cadastro"
          className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl text-sm font-semibold shadow-2xl shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition"
        >
          Iniciar valuation
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ─── Exit Intent Popup ────────────────────────── */}
      <ExitIntentPopup />

      {/* ─── Diagnóstico Modal ───────────────────────────── */}
      <DiagnosticoModal isOpen={diagnosticoOpen} onClose={() => setDiagnosticoOpen(false)} />

      {/* ─── Footer ──────────────────────────────────────── */}
      <footer className={`py-12 pb-24 md:pb-12 border-t ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col items-center gap-6 text-center">
            {/* Logo + marca */}
            <div className="flex items-center gap-3">
              <img src="/favicon.svg?v=2" alt="QV" className="w-7 h-7" />
              <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Quanto Vale</span>
            </div>

            {/* Links legais + contato */}
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

            {/* Copyright */}
            <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>&copy; 2026 Quanto Vale. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
