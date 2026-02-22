import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Shield, FileText, TrendingUp, Zap, Target, Mail } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-extrabold text-sm">QV</span>
            </div>
            <span className="font-bold text-lg text-navy-900 tracking-tight">Quanto Vale</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-navy-900 transition">
              Entrar
            </Link>
            <Link
              to="/cadastro"
              className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-700 transition shadow-sm"
            >
              Calcular agora
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-brand-100/30 rounded-full blur-3xl" />
        
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-navy-900 text-white px-4 py-1.5 rounded-full text-xs font-semibold mb-8 tracking-wide">
              <Zap className="w-3.5 h-3.5" />
              PLATAFORMA DE VALUATION EMPRESARIAL
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold text-navy-900 tracking-tight leading-[1.1] mb-6">
              QUANTO VALE
            </h1>
          </div>

          <p className="animate-fade-in-delay text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto mb-4 leading-relaxed">
            Descubra quanto sua empresa vale hoje.
          </p>

          <p className="animate-fade-in-delay-2 text-base text-slate-500 max-w-xl mx-auto mb-10">
            Valuation profissional baseado em Fluxo de Caixa Descontado com ajuste setorial real.
          </p>

          <div className="animate-fade-in-delay-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/cadastro"
              className="group bg-brand-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-brand-700 transition shadow-lg shadow-brand-600/25 flex items-center gap-2 animate-pulse-glow"
            >
              Calcular agora
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="mailto:quantovalehoje@gmail.com"
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-navy-900 transition"
            >
              <Mail className="w-4 h-4" />
              quantovalehoje@gmail.com
            </a>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 bg-navy-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Você sabe quanto sua empresa <span className="text-brand-400">realmente vale</span>?
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Sem valuation profissional, decisões estratégicas são tomadas no escuro.
            Negociações, investimentos e planejamento — tudo depende de um número que você ainda não tem.
          </p>
        </div>
      </section>

      {/* Solution */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">
              Metodologia financeira real
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              O Quanto Vale utiliza metodologia financeira real para calcular o valor do seu negócio.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: BarChart3, title: 'Método DCF', desc: 'Fluxo de Caixa Descontado com projeção de 5 anos e valor terminal.' },
              { icon: Target, title: 'Ajuste por Setor', desc: 'Beta setorial, prêmio de risco e múltiplos específicos do seu mercado.' },
              { icon: TrendingUp, title: 'Benchmark Real', desc: 'Compare sua empresa com referências do setor e descubra seu percentil.' },
              { icon: Shield, title: 'Score de Risco', desc: 'Avaliação multidimensional de risco considerando margem, dívida e crescimento.' },
              { icon: Zap, title: 'Simulador Estratégico', desc: 'Ajuste parâmetros e recalcule o valuation em tempo real.' },
              { icon: FileText, title: 'Relatório PDF Premium', desc: 'Relatório institucional completo com gráficos, projeções e análise IA.' },
            ].map((item, i) => (
              <div
                key={i}
                className="group p-6 bg-white border border-slate-200 rounded-2xl hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/50 transition-all duration-300"
              >
                <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-100 transition">
                  <item.icon className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="font-semibold text-navy-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-navy-900 text-center mb-16">
            Como funciona
          </h2>

          <div className="space-y-0">
            {[
              { step: '01', title: 'Crie sua conta', desc: 'Cadastro rápido com confirmação por e-mail.' },
              { step: '02', title: 'Envie seus dados ou DRE', desc: 'Insira manualmente ou faça upload de PDF/Excel.' },
              { step: '03', title: 'Receba sua análise prévia', desc: 'Valuation calculado instantaneamente pelo motor financeiro.' },
              { step: '04', title: 'Desbloqueie o relatório completo', desc: 'Escolha um plano e receba o PDF premium por e-mail.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-6 py-8 border-b border-slate-200 last:border-0">
                <div className="flex-shrink-0 w-12 h-12 bg-navy-900 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{item.step}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-navy-900 text-lg mb-1">{item.title}</h3>
                  <p className="text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-navy-900 text-center mb-4">Planos</h2>
          <p className="text-slate-500 text-center mb-16">Pagamento único. Sem assinatura.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Essencial',
                price: 'R$79',
                desc: 'Valuation básico por DCF',
                features: ['Valuation DCF completo', 'Score de risco', 'Relatório PDF básico', 'Envio por e-mail'],
                popular: false,
              },
              {
                name: 'Profissional',
                price: 'R$149',
                desc: 'Análise completa com benchmark',
                features: [
                  'Tudo do Essencial',
                  'Benchmark setorial',
                  'Índice de maturidade',
                  'Simulador estratégico',
                  'Relatório PDF completo',
                ],
                popular: true,
              },
              {
                name: 'Estratégico',
                price: 'R$299',
                desc: 'Máximo nível de análise',
                features: [
                  'Tudo do Profissional',
                  'Análise estratégica IA',
                  'Timeline de valorização',
                  'Suporte prioritário',
                  'Múltiplas simulações',
                ],
                popular: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`relative p-8 rounded-2xl border-2 transition-all ${
                  plan.popular
                    ? 'border-brand-600 shadow-xl shadow-brand-100/50 scale-[1.02]'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-semibold px-4 py-1 rounded-full">
                    Mais popular
                  </div>
                )}
                <h3 className="font-bold text-navy-900 text-lg">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-6">{plan.desc}</p>
                <div className="mb-8">
                  <span className="text-4xl font-extrabold text-navy-900">{plan.price}</span>
                  <span className="text-slate-400 text-sm ml-1">/ único</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-slate-600">
                      <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/cadastro"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition ${
                    plan.popular
                      ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md'
                      : 'bg-slate-100 text-navy-900 hover:bg-slate-200'
                  }`}
                >
                  Começar agora
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 bg-navy-900">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            Você construiu sua empresa.
            <br />
            <span className="text-brand-400">Agora descubra quanto ela vale.</span>
          </h2>
          <p className="text-slate-400 mb-10">
            Valuation profissional em minutos, não em semanas.
          </p>
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-brand-500 transition shadow-lg shadow-brand-600/25"
          >
            Calcular valuation agora
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-navy-950 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-navy-800 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">QV</span>
              </div>
              <span className="text-white font-semibold">Quanto Vale</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href="mailto:quantovalehoje@gmail.com" className="hover:text-white transition">
                quantovalehoje@gmail.com
              </a>
              <span>quantovale.online</span>
            </div>
            <p className="text-xs text-slate-600">&copy; 2026 Quanto Vale. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
