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

// ─── Emerald Neural Network — premium animated background ────
function EmeraldParticles({ isDark }) {
  const canvasRef = useRef(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 });
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ── DPR-aware resize ─────────────────────────────────────
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    // ── Build nodes ──────────────────────────────────────────
    // ~55 nodes total; ~15% are "hub" nodes (larger, brighter)
    const baseCount = Math.min(65, Math.max(30, Math.floor((W() * H()) / 10000)));
    const nodes = Array.from({ length: baseCount }, (_, i) => {
      const isHub = i < Math.floor(baseCount * 0.14);
      return {
        x:     Math.random() * W(),
        y:     Math.random() * H(),
        vx:    (Math.random() - 0.5) * (isHub ? 0.18 : 0.28),
        vy:    (Math.random() - 0.5) * (isHub ? 0.18 : 0.28),
        r:     isHub ? 3.5 + Math.random() * 2   : 1.2 + Math.random() * 1.8,
        pulse: Math.random() * Math.PI * 2,
        pSpeed:isHub ? 0.022 : 0.038 + Math.random() * 0.022,
        isHub,
        // depth: 0=back … 1=front — affects opacity
        depth: Math.random(),
      };
    });

    // ── Signal packets that travel along edges ───────────────
    // A packet travels from node A → node B over ~120 frames
    const packets = [];
    const spawnPacket = () => {
      const viable = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < 140) viable.push([i, j, d]);
        }
      }
      if (!viable.length) return;
      const [ai, bi] = viable[Math.floor(Math.random() * viable.length)];
      packets.push({ ai, bi, t: 0, speed: 0.006 + Math.random() * 0.008 });
    };
    // Seed initial packets
    for (let k = 0; k < 6; k++) spawnPacket();

    // ── Connection distance threshold ────────────────────────
    const MAX_DIST = 145;

    // ── Colour helpers ───────────────────────────────────────
    // emerald-400 → 160°, emerald-500 → 158°, teal-400 → 172°
    const nodeHue = (n) => n.isHub ? 162 : 152 + Math.random() * 16;
    const SAT = 80;
    const bright = isDark
      ? (d) => 55 + d * 22          // dark: 55%–77%
      : (d) => 20 + d * 10;         // light: 20%–30% (darker, more visible)

    const frame = { n: 0 };

    const draw = () => {
      frame.n++;
      const w = W();
      const h = H();
      ctx.clearRect(0, 0, w, h);

      // ── Move nodes + soft mouse attraction ──────────────────
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      for (const n of nodes) {
        // gentle drift toward mouse within 200 px (attraction, not repulsion)
        const dx = mx - n.x;
        const dy = my - n.y;
        const md = Math.hypot(dx, dy);
        if (md < 200 && md > 1) {
          n.vx += (dx / md) * 0.006;
          n.vy += (dy / md) * 0.006;
        }
        // speed cap
        const spd = Math.hypot(n.vx, n.vy);
        const cap = n.isHub ? 0.5 : 0.7;
        if (spd > cap) { n.vx = (n.vx / spd) * cap; n.vy = (n.vy / spd) * cap; }

        n.x += n.vx;
        n.y += n.vy;
        n.pulse += n.pSpeed;

        // bounce within bounds
        if (n.x < 0) { n.x = 0; n.vx = Math.abs(n.vx); }
        if (n.x > w) { n.x = w; n.vx = -Math.abs(n.vx); }
        if (n.y < 0) { n.y = 0; n.vy = Math.abs(n.vy); }
        if (n.y > h) { n.y = h; n.vy = -Math.abs(n.vy); }
      }

      // ── Draw edges ───────────────────────────────────────────
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist >= MAX_DIST) continue;

          const proximity = 1 - dist / MAX_DIST;          // 0…1
          const depthAlpha = (a.depth + b.depth) / 2;
          const baseAlpha  = proximity * depthAlpha * (isDark ? 0.40 : 0.45);

          // gradient edge: fade from node A colour → node B colour
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          const bA = bright(a.depth), bB = bright(b.depth);
          grad.addColorStop(0,   `hsla(158,${SAT}%,${bA}%,${baseAlpha})`);
          grad.addColorStop(0.5, `hsla(162,${SAT}%,${Math.round((bA+bB)/2)}%,${baseAlpha * 1.3})`);
          grad.addColorStop(1,   `hsla(166,${SAT}%,${bB}%,${baseAlpha})`);

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth   = proximity * (isDark ? 1.1 : 1.2);
          ctx.stroke();
        }
      }

      // ── Draw + advance signal packets ────────────────────────
      const dead = [];
      for (let k = 0; k < packets.length; k++) {
        const p  = packets[k];
        p.t     += p.speed;
        if (p.t >= 1) { dead.push(k); continue; }

        const a  = nodes[p.ai], b = nodes[p.bi];
        const px = a.x + (b.x - a.x) * p.t;
        const py = a.y + (b.y - a.y) * p.t;

        // glowing dot on the edge
        const gr = ctx.createRadialGradient(px, py, 0, px, py, 5);
        gr.addColorStop(0,   isDark ? 'rgba(52,211,153,0.95)' : 'rgba(16,185,129,0.85)');
        gr.addColorStop(0.4, isDark ? 'rgba(16,185,129,0.40)' : 'rgba(5,150,105,0.30)');
        gr.addColorStop(1,   'transparent');
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = gr;
        ctx.fill();

        // tiny bright core
        ctx.beginPath();
        ctx.arc(px, py, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(167,243,208,0.9)' : 'rgba(6,95,70,0.8)';
        ctx.fill();
      }
      // remove finished packets + spawn replacements
      for (let k = dead.length - 1; k >= 0; k--) packets.splice(dead[k], 1);
      if (frame.n % 18 === 0) spawnPacket();

      // ── Draw nodes ───────────────────────────────────────────
      for (const n of nodes) {
        const glow  = 0.65 + Math.abs(Math.sin(n.pulse)) * 0.35;
        const alpha = glow * (0.45 + n.depth * 0.55) * (isDark ? 1 : 1.10);
        const bri   = bright(n.depth);
        const hue   = 152 + n.depth * 14;

        if (n.isHub) {
          // outer aura
          const aura = ctx.createRadialGradient(n.x, n.y, n.r, n.x, n.y, n.r * 3.8);
          aura.addColorStop(0,   `hsla(${hue},${SAT}%,${bri}%,${alpha * 0.28})`);
          aura.addColorStop(1,   'transparent');
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 3.8, 0, Math.PI * 2);
          ctx.fillStyle = aura;
          ctx.fill();
        }

        // core glow ring
        const ring = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2.2);
        ring.addColorStop(0,   `hsla(${hue},${SAT}%,${bri}%,${alpha * 0.18})`);
        ring.addColorStop(1,   'transparent');
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = ring;
        ctx.fill();

        // solid core
        const core = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        core.addColorStop(0,   `hsla(${hue + 8},${SAT}%,${Math.min(bri + 20, 92)}%,${alpha})`);
        core.addColorStop(0.6, `hsla(${hue},${SAT}%,${bri}%,${alpha})`);
        core.addColorStop(1,   `hsla(${hue - 6},${SAT - 10}%,${bri - 10}%,${alpha * 0.7})`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = core;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    const onMove  = (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => { mouseRef.current = { x: -9999, y: -9999 }; };
    canvas.addEventListener('mousemove',  onMove);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove',  onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'auto' }}
    />
  );
}

// ─── Horizontal glow divider ──────────────────────────────
function GlowDivider({ isDark }) {
  return (
    <div className="relative h-px w-full max-w-5xl mx-auto">
      <div className={`absolute inset-0 ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/80'}`} />
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-1/3 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
    </div>
  );
}

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
                { href: '#metodologia', label: 'Metodologia' },
                { href: '#recursos', label: 'Recursos' },
                { href: '#planos', label: 'Planos' },
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

      {/* ─── Hero ────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 md:pt-44 md:pb-36">
        {/* Emerald Orbs + Sparkles */}
        <div className="absolute inset-0 overflow-hidden">
          <EmeraldParticles isDark={isDark} />
        </div>
        {/* Gradient overlay — keeps text readable */}
        <div className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${isDark ? 'from-slate-950/88 via-slate-950/75 to-slate-950/88' : 'from-white/90 via-white/78 to-white/90'}`} />
        {/* Central radial glow — pulls focus to headline */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-[160px] pointer-events-none"
          style={{ background: isDark
            ? 'radial-gradient(ellipse, rgba(16,185,129,0.18) 0%, transparent 68%)'
            : 'radial-gradient(ellipse, rgba(16,185,129,0.20) 0%, transparent 68%)'
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 text-center">
          {/* Anti-objection badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs mb-8 border tracking-wide ${isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
            Sem assinatura <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span> Sem espera <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>·</span> Pagamento único
          </div>

          <h1 className={`text-4xl md:text-5xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-[1.15] mb-6 md:leading-[1.1] ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Descubra o
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">valor real</span>
            <br />
            da sua empresa
          </h1>

          <p className={`text-base md:text-lg lg:text-xl max-w-3xl mx-auto mb-3 leading-relaxed md:leading-relaxed lg:leading-relaxed font-normal md:font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Valuation profissional com DCF, dados IBGE e relatório executivo — em minutos, não semanas.
          </p>
          <p className={`text-sm md:text-base lg:text-lg max-w-3xl mx-auto mb-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            O mesmo método das grandes consultorias de M&A — com dados oficiais, relatório de ~20 páginas e por{' '}
            <span className={isDark ? 'text-emerald-400 font-bold' : 'text-emerald-600 font-bold'}>30x menos</span>.
          </p>

          {/* Price anchor — minimal */}
          <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-lg mb-10 text-sm font-medium border ${isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <span className="line-through opacity-50">R$ 15.000</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
            <span className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>a partir de R$ 997</span>
            <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>pagamento único</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Link to="/cadastro" className="group flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all duration-500 ease-out shadow-4xl shadow-emerald-600/40 ring-4 ring-emerald-500/30 hover:scale-105">
              Iniciar valuation
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-500" />
            </Link>
            <button
              onClick={() => setDiagnosticoOpen(true)}
              className={`flex items-center gap-2 text-sm font-medium transition-all duration-500 ease-out px-6 py-4 rounded-xl border ${isDark ? 'border-slate-700 text-slate-300 hover:border-emerald-500 hover:text-emerald-400 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-105' : 'border-slate-300 text-slate-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-105'}`}
            >
              <BarChart3 className="w-4 h-4" />
              Diagnóstico Gratuito
            </button>
          </div>
          {/* Microcopy de reforço */}
          <p className={`text-xs mb-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Grátis para começar • Resultado em 5 minutos
          </p>

          {/* Tech stack badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-16">
            {[
              { icon: Lock, label: 'TLS 1.3' },
              { icon: Shield, label: 'LGPD Compliant' },
              { icon: Database, label: 'IBGE SIDRA API' },
              { icon: Cpu, label: 'DCF Engine' },
              { icon: Activity, label: 'Real-time' },
            ].map((badge, i) => (
              <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono tracking-wide border ${isDark ? 'border-slate-800 text-slate-500 bg-slate-900/50' : 'border-slate-200 text-slate-400 bg-slate-50'}`}>
                <badge.icon className="w-3 h-3" />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>

          {/* Metrics bar - Visual progress bar */}
          <div className={`inline-flex items-center justify-center gap-2 sm:gap-4 md:gap-6 lg:gap-8 rounded-2xl px-4 sm:px-6 md:px-8 py-4 md:py-5 backdrop-blur-sm border ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white/80 border-slate-200'}`}>
            {/* Empresas avaliadas */}
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${isDark ? 'bg-emerald-500' : 'bg-emerald-600'}`} />
              <div className="flex flex-col sm:flex-row items-baseline gap-1 md:gap-1.5">
                <span className={`text-lg md:text-xl lg:text-2xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>500+</span>
                <span className={`text-[10px] md:text-[11px] uppercase tracking-wider font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>empresas</span>
              </div>
            </div>

            {/* Separator */}
            <div className={`hidden sm:block w-px h-8 md:h-10 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

            {/* Setores IBGE */}
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${isDark ? 'bg-emerald-500' : 'bg-emerald-600'}`} />
              <div className="flex flex-col sm:flex-row items-baseline gap-1 md:gap-1.5">
                <span className={`text-lg md:text-xl lg:text-2xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>35+</span>
                <span className={`text-[10px] md:text-[11px] uppercase tracking-wider font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>setores</span>
              </div>
            </div>

            {/* Separator */}
            <div className={`hidden sm:block w-px h-8 md:h-10 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

            {/* Precisão DCF */}
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${isDark ? 'bg-emerald-500' : 'bg-emerald-600'}`} />
              <div className="flex flex-col sm:flex-row items-baseline gap-1 md:gap-1.5">
                <span className={`text-lg md:text-xl lg:text-2xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>98%</span>
                <span className={`text-[10px] md:text-[11px] uppercase tracking-wider font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>satisfação</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <GlowDivider isDark={isDark} />

      {/* ─── Benchmark comparison ────────────────────────── */}
      <section className="py-20 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/50 to-white" />}
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// benchmark</p>
            <h2 className={`text-3xl md:text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Consultoria tradicional <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>vs</span> Quanto Vale
            </h2>
          </div>
          {/* Comparison table — clean tech style */}
          <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
            <table className="w-full">
              <thead>
                <tr className={isDark ? 'border-b border-slate-800' : 'border-b border-slate-200'}>
                  <th className={`text-left px-6 py-4 text-xs font-mono uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Critério</th>
                  <th className={`text-center px-6 py-4 text-xs font-mono uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Tradicional</th>
                  <th className={`text-center px-6 py-4 text-xs font-mono uppercase tracking-wider text-emerald-500`}>Quanto Vale</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
                {[
                  { label: 'Custo', old: 'R$ 5k–50k', now: 'R$ 997–3.997' },
                  { label: 'Prazo de entrega', old: '2–8 semanas', now: '5 minutos' },
                  { label: 'Metodologia', old: 'Varia por analista', now: 'DCF padronizado' },
                  { label: 'Dados setoriais', old: 'Manual / parcial', now: 'IBGE SIDRA em tempo real' },
                  { label: 'Relatório', old: '5–10 páginas', now: 'Até 25 páginas + gráficos' },
                  { label: 'Simulador', old: 'Não incluso', now: 'Interativo' },
                ].map((row, i) => (
                  <tr key={i} className={`transition ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                    <td className={`px-6 py-3.5 text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.label}</td>
                    <td className={`px-6 py-3.5 text-sm text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{row.old}</td>
                    <td className={`px-6 py-3.5 text-sm text-center font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{row.now}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <GlowDivider isDark={isDark} />

      {/* ─── Para quem é ─────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
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
              { icon: Users, title: 'Quem quer comprar', desc: 'Avalie a empresa-alvo antes de fazer uma oferta e negocie com dados reais.', color: 'from-purple-500 to-emerald-500' },
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

      {/* ─── Problem ─────────────────────────────────────── */}
      <section className="py-24 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-red-400/60' : 'text-red-500/60'}`}>// o problema</p>
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

      <GlowDivider isDark={isDark} />

      {/* ─── Methodology ────────────────────────────────── */}
      <section id="metodologia" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// methodology</p>
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

      <GlowDivider isDark={isDark} />

      {/* ─── Features / O que você recebe ────────────────── */}
      <section id="recursos" className="py-24 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-teal-400/60' : 'text-teal-600/60'}`}>// features</p>
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

      <GlowDivider isDark={isDark} />

      {/* ─── How it works ────────────────────────────────── */}
      <section id="como-funciona" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// workflow</p>
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

      <GlowDivider isDark={isDark} />

      {/* ─── Pricing ─────────────────────────────────────── */}
      <section id="planos" className="py-24 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// pricing</p>
            <h2 className={`text-3xl md:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Pagamento único. Sem assinatura.</h2>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>PIX, boleto ou cartão de crédito</p>
            <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm ${isDark ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <span>Consultoria tradicional:</span>
              <span className="line-through font-medium">R$ 15.000–50.000</span>
              <span className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>→ a partir de R$ 997</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5 items-stretch">
            {[
              {
                name: 'Essencial', price: 'R$997', desc: 'Valuation DCF completo',
                pages: '~8 páginas',
                features: ['Valuation DCF Gordon Growth', 'Score de risco e maturidade', 'Relatório executivo básico', 'Envio por e-mail'],
                popular: false,
              },
              {
                name: 'Profissional', price: 'R$1.797', desc: 'Análise completa com benchmark',
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
              <div key={i} className={`relative rounded-2xl border transition-all flex flex-col ${plan.popular ? 'border-emerald-500/50 shadow-2xl shadow-emerald-600/10' : isDark ? 'border-slate-800 hover:border-slate-700' : 'border-slate-200 hover:border-emerald-200'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold px-4 py-1 rounded-full shadow-lg">
                    Mais popular
                  </div>
                )}
                <div className={`p-8 rounded-2xl flex flex-col flex-1 ${plan.popular ? (isDark ? 'bg-gradient-to-b from-slate-900 to-slate-950' : 'bg-gradient-to-b from-emerald-50 to-white') : (isDark ? 'bg-slate-900' : 'bg-white')}`}>
                  <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                  <p className={`text-sm mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{plan.desc}</p>
                  <div className="mb-2">
                    <span className={`text-4xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                    <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ único</span>
                  </div>
                  <p className={`text-xs font-medium mb-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Relatório PDF com {plan.pages}</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className={`flex items-center gap-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/cadastro" className={`block text-center py-3 rounded-xl font-semibold text-sm transition mt-auto ${plan.popular ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/25' : isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}>
                    Iniciar avaliação
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <GlowDivider isDark={isDark} />

      {/* ─── FAQ ──────────────────────────────────────────── */}
      <section className="py-24 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>// FAQ</p>
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

      <GlowDivider isDark={isDark} />

      {/* ─── Parceiros ───────────────────────────────────── */}
      <section id="parceiros" className="py-24 relative">
        {isDark && (
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[300px] bg-teal-600/5 rounded-full blur-[100px]" />
        )}
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className={`text-xs font-mono uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>// partners</p>
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

      <GlowDivider isDark={isDark} />

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
          <p className={`mb-2 text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Valuation profissional. Baseado em dados oficiais. Em minutos.
          </p>
          <div className={`inline-flex items-center gap-2 mb-6 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className="line-through">R$ 15.000</span>
            <ArrowRight className="w-3 h-3 text-emerald-500" />
            <span className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>a partir de R$ 997</span>
          </div>
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
