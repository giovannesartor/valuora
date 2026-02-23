import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ArrowRight, BarChart3, Shield, FileText, TrendingUp,
  Zap, Target, Mail, ChevronRight, Star, Lock,
  Cpu, Database, LineChart, CheckCircle, Activity,
  Building2, Users, Award, Clock, Eye,
  ChevronDown, Layers, PieChart, Gauge, Menu, X,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import ExitIntentPopup from '../components/ExitIntentPopup';
import DiagnosticoModal from '../components/DiagnosticoModal';
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
    <span className="relative inline-block">
      <span className={`inline-block transition-all duration-500 ease-out text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400 ${animClass}`}>
        {words[index]}
      </span>
      <span className="ml-0.5 inline-block w-[3px] h-[0.85em] bg-gradient-to-b from-emerald-400 to-teal-400 rounded-full animate-pulse align-middle" />
    </span>
  );
}

export default function LandingPage() {
  const { isDark } = useTheme();
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [diagnosticoOpen, setDiagnosticoOpen] = useState(false);

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
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle />
            <Link to="/login" className={`hidden md:inline-block text-sm font-medium transition px-4 py-2 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              Entrar
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
        {isDark ? (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] bg-emerald-600/8 rounded-full blur-[140px]" />
            <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] bg-teal-500/5 rounded-full blur-[100px]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.04)_1px,transparent_1px)] bg-[size:64px_64px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-emerald-100/50 rounded-full blur-[120px]" />
          </>
        )}

        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 backdrop-blur-sm border ${isDark ? 'bg-slate-800/80 border-slate-700/50 text-slate-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Sistema profissional de valuation • DCF + IBGE
          </div>

          <h1 className={`text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.05] mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Descubra quanto
            <br />
            <WordSwap words={['sua empresa', 'seu negócio', 'sua startup', 'seu SaaS']} />
            <br />
            realmente vale
          </h1>

          <p className={`text-lg md:text-xl max-w-3xl mx-auto mb-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Antes de negociar. Antes de vender. Antes de decidir.
          </p>
          <p className={`text-base md:text-lg max-w-3xl mx-auto mb-10 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            O Quanto Vale é um sistema profissional de valuation baseado em{' '}
            <span className={isDark ? 'text-white font-medium' : 'text-slate-900 font-medium'}>Fluxo de Caixa Descontado (DCF)</span>, com
            ajuste setorial oficial, análise de risco e relatório executivo estratégico.
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
                { icon: Cpu, title: 'Motor DCF', desc: 'Projeção de fluxo de caixa livre por 5 anos com WACC setorial' },
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
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-emerald-500 text-xs font-semibold mb-4 uppercase tracking-wider">
              <div className="w-6 h-px bg-emerald-500" />
              Metodologia Financeira
              <div className="w-6 h-px bg-emerald-500" />
            </div>
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Método internacionalmente adotado por bancos de investimento
            </h2>
            <p className={`text-lg max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Utilizamos o <span className={isDark ? 'text-white font-medium' : 'text-slate-900 font-medium'}>Fluxo de Caixa Descontado (DCF)</span> — o mesmo método usado em fusões, aquisições e IPOs.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: TrendingUp, title: 'Projeção FCL', items: ['Fluxo de caixa livre por 5 anos', 'Crescimento com desaceleração gradual', 'CAPEX e capital de giro projetados'] },
              { icon: PieChart, title: 'WACC & Estrutura', items: ['Cálculo WACC ajustado', 'Beta setorial calibrado', 'Prêmio de risco-país', 'Estrutura de capital'] },
              { icon: Gauge, title: 'Dados Oficiais IBGE', items: ['Classificação CNAE automática', 'Dados agregados SIDRA', 'Receita média por setor', 'Crescimento histórico oficial'] },
            ].map((item, i) => (
              <div key={i} className={`rounded-2xl p-7 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mb-5 shadow-lg">
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className={`font-semibold text-lg mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
                <ul className="space-y-2.5">
                  {item.items.map((itm, j) => (
                    <li key={j} className={`flex items-start gap-2.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {itm}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className={`mt-8 rounded-2xl p-6 border text-center ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-emerald-50/60 border-emerald-100'}`}>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <span className="font-semibold">Resultado:</span> um valuation técnico, consistente e{' '}
              <span className="font-semibold">defensável</span> — pronto para apresentar a investidores, sócios ou compradores.
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
              { icon: BarChart3, title: 'Valuation DCF Completo', desc: 'Valor estimado da empresa baseado em fundamentos financeiros com projeção de 5 anos.', gradient: 'from-emerald-500 to-emerald-600' },
              { icon: Database, title: 'Ajuste Setorial Oficial', desc: 'Comparação com indicadores econômicos do seu setor usando dados oficiais do IBGE.', gradient: 'from-teal-500 to-emerald-500' },
              { icon: Target, title: 'Benchmark Estratégico', desc: 'Descubra se sua margem, crescimento e eficiência estão acima ou abaixo do mercado.', gradient: 'from-emerald-500 to-cyan-500' },
              { icon: Shield, title: 'Score de Risco Empresarial', desc: 'Avaliação multidimensional: margem operacional, endividamento, crescimento, volatilidade setorial.', gradient: 'from-purple-500 to-emerald-500' },
              { icon: Layers, title: 'Índice de Maturidade', desc: 'Classificação objetiva: Inicial → Estruturado → Escalável → Vendável.', gradient: 'from-orange-500 to-amber-500' },
              { icon: Zap, title: 'Simulador Interativo', desc: 'Altere crescimento, margem, taxa de desconto e veja o valuation recalcular instantaneamente.', gradient: 'from-pink-500 to-rose-500' },
              { icon: Activity, title: 'Linha do Tempo', desc: 'Visualize o valor projetado: Hoje → Em 3 anos → Em 5 anos.', gradient: 'from-violet-500 to-purple-500' },
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

      {/* ─── Security ────────────────────────────────────── */}
      <section className="py-20 relative">
        {isDark ? <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" /> : <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />}
        <div className="relative max-w-4xl mx-auto px-6">
          <div className={`rounded-2xl p-8 md:p-12 border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-start gap-5 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Segurança e Confidencialidade</h2>
                <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Valuation envolve dados sensíveis. Implementamos:</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {['Criptografia ponta a ponta', 'Armazenamento seguro', 'Ambiente isolado', 'Conformidade com LGPD', 'Dados não compartilhados', 'Confidencialidade absoluta'].map((item, i) => (
                <div key={i} className={`flex items-center gap-3 py-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── When to valuation ───────────────────────────── */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className={`text-3xl md:text-4xl font-bold mb-10 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Quando você deve fazer seu valuation?
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              'Antes de captar investimento',
              'Antes de vender participação',
              'Antes de negociar sociedade',
              'Antes de planejar sucessão',
              'Antes de escalar',
              'Para entender seu patrimônio',
            ].map((item, i) => (
              <div key={i} className={`rounded-xl p-5 border text-center transition ${isDark ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-200 shadow-sm'}`}>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item}</p>
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
                features: ['Valuation DCF completo', 'Score de risco', 'Relatório executivo básico', 'Envio por e-mail'],
                popular: false,
              },
              {
                name: 'Profissional', price: 'R$899', desc: 'Análise completa com benchmark',
                features: ['Tudo do Essencial', 'Benchmark setorial oficial', 'Índice de maturidade', 'Simulador estratégico', 'Relatório completo com gráficos detalhados'],
                popular: true,
              },
              {
                name: 'Estratégico', price: 'R$1.999', desc: 'Máximo nível de análise',
                features: ['Tudo do Profissional', 'Análise estratégica avançada por IA', 'Linha do tempo de valorização', 'Simulações ilimitadas', 'Suporte prioritário'],
                popular: false,
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
                  <Link to="/cadastro" className={`block text-center py-3 rounded-xl font-semibold text-sm transition ${plan.popular ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/25' : isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}>
                    Iniciar avaliação
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Confiado por empreendedores</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: 'Ricardo M.', role: 'CEO — Logística', text: 'Precisava de um valuation para negociar com investidores. Em 10 minutos tinha o relatório completo com dados setoriais do IBGE.' },
              { name: 'Ana Paula S.', role: 'Sócia — E-commerce', text: 'A análise setorial foi surpreendente. Descobri que minha margem está acima da média do mercado usando dados oficiais.' },
              { name: 'Carlos H.', role: 'Fundador — SaaS', text: 'O simulador estratégico me ajudou a entender quanto minha empresa valeria com 20% mais de crescimento. Documento impecável.' },
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
