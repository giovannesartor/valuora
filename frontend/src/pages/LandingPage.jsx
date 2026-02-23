import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ArrowRight, BarChart3, Shield, FileText, TrendingUp,
  Zap, Target, Mail, ChevronRight, Star, Lock,
  Cpu, Database, LineChart, CheckCircle,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

// ─── Animated counter ─────────────────────────────────────
function Counter({ end, suffix = '', prefix = '' }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [end]);
  return <span>{prefix}{count.toLocaleString('pt-BR')}{suffix}</span>;
}

// ─── Improved word animation ──────────────────────────────
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
    <span className="relative inline-block">
      <span
        className={`inline-block transition-all duration-500 ease-out text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400 ${animClass}`}
      >
        {words[index]}
      </span>
      <span className="ml-0.5 inline-block w-[3px] h-[0.85em] bg-gradient-to-b from-blue-400 to-cyan-400 rounded-full animate-pulse align-middle" />
    </span>
  );
}

export default function LandingPage() {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
      {/* ─── Navbar ──────────────────────────────────────── */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-colors duration-300 ${isDark ? 'bg-slate-950/80 border-slate-800/50' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="QV" className="w-8 h-8" />
            <span className={`font-bold text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Quanto Vale</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#como-funciona" className={`text-sm transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Como funciona</a>
            <a href="#recursos" className={`text-sm transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Recursos</a>
            <a href="#planos" className={`text-sm transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Planos</a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login" className={`text-sm font-medium transition px-4 py-2 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              Entrar
            </Link>
            <Link
              to="/cadastro"
              className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:from-blue-500 hover:to-cyan-500 transition shadow-lg shadow-blue-600/25"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32">
        {isDark && (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
            <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[80px]" />
          </>
        )}
        {!isDark && (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.04)_1px,transparent_1px)] bg-[size:64px_64px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-100/50 rounded-full blur-[120px]" />
          </>
        )}

        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 backdrop-blur-sm border ${isDark ? 'bg-slate-800/80 border-slate-700/50 text-slate-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Motor de valuation DCF em tempo real
          </div>

          <h1 className={`text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.05] mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Descubra quanto
            <br />
            <WordSwap words={['sua empresa', 'seu negócio', 'sua startup', 'seu SaaS']} />
            <br />
            vale hoje
          </h1>

          <p className={`text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Valuation profissional baseado em{' '}
            <span className={isDark ? 'text-white font-medium' : 'text-slate-900 font-medium'}>Fluxo de Caixa Descontado</span> com
            ajuste setorial, análise de risco e relatório com IA — em minutos, não semanas.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/cadastro"
              className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:from-blue-500 hover:to-cyan-500 transition shadow-2xl shadow-blue-600/20"
            >
              Calcular meu valuation
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#como-funciona"
              className={`flex items-center gap-2 text-sm transition px-6 py-4 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Como funciona
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <div className={`inline-flex items-center gap-8 md:gap-12 rounded-2xl px-8 py-5 backdrop-blur-sm border ${isDark ? 'bg-slate-900/80 border-slate-800/50' : 'bg-slate-50 border-slate-200'}`}>
            {[
              { value: <Counter end={500} suffix="+" />, label: 'Empresas avaliadas' },
              { value: <Counter end={17} />, label: 'Setores cobertos' },
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

      {/* ─── Problem / Trust ─────────────────────────────── */}
      <section className="py-24 relative">
        {isDark && <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950" />}
        {!isDark && <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-red-400 text-xs font-semibold mb-4 uppercase tracking-wider">
                <div className="w-6 h-px bg-red-400" />
                O problema
              </div>
              <h2 className={`text-3xl md:text-4xl font-bold mb-6 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Sem valuation, decisões estratégicas são tomadas <span className="text-red-400">no escuro</span>
              </h2>
              <p className={`leading-relaxed mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Negociações, investimentos, fusões, planejamento de saída — todas dependem
                de um número que a maioria dos empreendedores brasileiros ainda não tem.
              </p>
              <p className={`leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Consultorias tradicionais cobram de <span className={isDark ? 'text-white font-medium' : 'text-slate-900 font-medium'}>R$ 5.000 a R$ 50.000</span> e
                levam semanas. Com o Quanto Vale, você tem uma análise profissional em minutos.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Cpu, title: 'Motor DCF', desc: 'Fluxo de caixa descontado com 5 anos de projeção' },
                { icon: Database, title: '17 Setores', desc: 'Beta e múltiplos calibrados por setor brasileiro' },
                { icon: LineChart, title: 'Score de Risco', desc: 'Avaliação multidimensional de risco e maturidade' },
                { icon: Lock, title: 'Dados seguros', desc: 'Criptografia e proteção total de seus dados' },
              ].map((item, i) => (
                <div key={i} className={`rounded-2xl p-5 border transition ${isDark ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-blue-200 shadow-sm'}`}>
                  <item.icon className="w-5 h-5 text-blue-500 mb-3" />
                  <h3 className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features / Recursos ─────────────────────────── */}
      <section id="recursos" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-blue-500 text-xs font-semibold mb-4 uppercase tracking-wider">
              <div className="w-6 h-px bg-blue-500" />
              Recursos
              <div className="w-6 h-px bg-blue-500" />
            </div>
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Tudo que você precisa para
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400">
                avaliar seu negócio
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: BarChart3, title: 'Método DCF Completo', desc: 'Projeção de fluxo de caixa livre, WACC setorial, valor terminal por perpetuidade e valor equity.', gradient: 'from-blue-500 to-blue-600' },
              { icon: Target, title: 'Ajuste por Setor', desc: 'Beta setorial, prêmio de risco-país, custo de capital e múltiplos EV/EBITDA específicos.', gradient: 'from-cyan-500 to-blue-500' },
              { icon: TrendingUp, title: 'Benchmark Real', desc: 'Compare margens, crescimento e eficiência da sua empresa com referências do setor.', gradient: 'from-emerald-500 to-cyan-500' },
              { icon: Shield, title: 'Score de Risco', desc: 'Avaliação multidimensional considerando margem, endividamento, crescimento e concentração.', gradient: 'from-purple-500 to-blue-500' },
              { icon: Zap, title: 'Simulador Estratégico', desc: 'Ajuste parâmetros chave e recalcule o valuation em tempo real para ver cenários.', gradient: 'from-orange-500 to-red-500' },
              { icon: FileText, title: 'Relatório PDF + IA', desc: 'Relatório institucional com gráficos, projeções, benchmark e análise estratégica por IA.', gradient: 'from-pink-500 to-purple-500' },
            ].map((item, i) => (
              <div key={i} className={`group relative rounded-2xl p-7 border transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-lg'}`}>
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-gradient-to-br from-blue-500/5 to-transparent' : 'bg-gradient-to-br from-blue-50 to-transparent'}`} />
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
      <section id="como-funciona" className="py-24 relative">
        {isDark && <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" />}
        {!isDark && <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-cyan-500 text-xs font-semibold mb-4 uppercase tracking-wider">
              <div className="w-6 h-px bg-cyan-500" />
              Processo
              <div className="w-6 h-px bg-cyan-500" />
            </div>
            <h2 className={`text-3xl md:text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              4 passos para o seu valuation
            </h2>
          </div>

          <div className="space-y-0">
            {[
              { step: '01', title: 'Crie sua conta', desc: 'Cadastro rápido com confirmação por e-mail. Sem cartão de crédito.', color: 'from-blue-500 to-blue-600' },
              { step: '02', title: 'Envie seus dados financeiros', desc: 'Insira manualmente ou faça upload da DRE em PDF/Excel. O motor extrai automaticamente.', color: 'from-cyan-500 to-blue-500' },
              { step: '03', title: 'Receba a análise prévia', desc: 'Em segundos, o motor DCF calcula valuation, score de risco e benchmark setorial.', color: 'from-emerald-500 to-cyan-500' },
              { step: '04', title: 'Desbloqueie o relatório completo', desc: 'Escolha um plano e receba o PDF premium por e-mail com análise completa + IA.', color: 'from-purple-500 to-blue-500' },
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
      <section id="planos" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-emerald-500 text-xs font-semibold mb-4 uppercase tracking-wider">
              <div className="w-6 h-px bg-emerald-500" />
              Planos
              <div className="w-6 h-px bg-emerald-500" />
            </div>
            <h2 className={`text-3xl md:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Pagamento único. Sem assinatura.</h2>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Pague com PIX, boleto ou cartão de crédito via Asaas</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                name: 'Essencial', price: 'R$97', desc: 'Valuation básico por DCF',
                features: ['Valuation DCF completo', 'Score de risco', 'Relatório PDF básico', 'Envio por e-mail'],
                popular: false,
              },
              {
                name: 'Profissional', price: 'R$197', desc: 'Análise completa com benchmark',
                features: ['Tudo do Essencial', 'Benchmark setorial', 'Índice de maturidade', 'Simulador estratégico', 'Relatório PDF completo'],
                popular: true,
              },
              {
                name: 'Estratégico', price: 'R$397', desc: 'Máximo nível de análise',
                features: ['Tudo do Profissional', 'Análise estratégica IA', 'Timeline de valorização', 'Suporte prioritário', 'Múltiplas simulações'],
                popular: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl border transition-all ${
                  plan.popular
                    ? 'border-blue-500/50 scale-[1.03] shadow-2xl shadow-blue-600/10'
                    : isDark ? 'border-slate-800 hover:border-slate-700' : 'border-slate-200 hover:border-blue-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-semibold px-4 py-1 rounded-full shadow-lg">
                    Mais popular
                  </div>
                )}
                <div className={`p-8 rounded-2xl ${
                  plan.popular
                    ? isDark ? 'bg-gradient-to-b from-slate-900 to-slate-950' : 'bg-gradient-to-b from-blue-50 to-white'
                    : isDark ? 'bg-slate-900' : 'bg-white'
                }`}>
                  <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                  <p className={`text-sm mb-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{plan.desc}</p>
                  <div className="mb-8">
                    <span className={`text-4xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                    <span className={`text-sm ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ único</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f, j) => (
                      <li key={j} className={`flex items-center gap-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/cadastro"
                    className={`block text-center py-3 rounded-xl font-semibold text-sm transition ${
                      plan.popular
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-600/25'
                        : isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    Começar agora
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ────────────────────────────────── */}
      <section className="py-24 relative">
        {isDark && <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" />}
        {!isDark && <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Confiado por empreendedores</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: 'Ricardo M.', role: 'CEO — Logística', text: 'Precisava de um valuation para negociar com investidores. Em 10 minutos tinha o relatório completo.' },
              { name: 'Ana Paula S.', role: 'Sócia — E-commerce', text: 'A análise setorial foi surpreendente. Descobri que minha margem está acima da média do mercado.' },
              { name: 'Carlos H.', role: 'Fundador — SaaS', text: 'O simulador estratégico me ajudou a entender quanto minha empresa valeria com 20% mais de crescimento.' },
            ].map((t, i) => (
              <div key={i} className={`rounded-2xl p-6 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className={`text-sm leading-relaxed mb-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>"{t.text}"</p>
                <div>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.name}</p>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Final ───────────────────────────────────── */}
      <section className="py-24 relative">
        {isDark && (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
          </>
        )}
        {!isDark && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-100/60 rounded-full blur-[120px]" />
        )}

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className={`text-3xl md:text-5xl font-bold mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Você construiu sua empresa.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400">
              Agora descubra quanto ela vale.
            </span>
          </h2>
          <p className={`mb-10 text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Valuation profissional em minutos — não em semanas.
          </p>
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:from-blue-500 hover:to-cyan-500 transition shadow-2xl shadow-blue-600/20"
          >
            Calcular valuation agora
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────── */}
      <footer className={`py-12 border-t ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/favicon.svg" alt="QV" className="w-7 h-7" />
              <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Quanto Vale</span>
            </div>
            <div className={`flex items-center gap-6 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <a href="mailto:quantovalehoje@gmail.com" className={`transition flex items-center gap-1.5 ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                <Mail className="w-3.5 h-3.5" />
                quantovalehoje@gmail.com
              </a>
              <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>|</span>
              <span>quantovale.online</span>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>&copy; 2025 Quanto Vale. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
