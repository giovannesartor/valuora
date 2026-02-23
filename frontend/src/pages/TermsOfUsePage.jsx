import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Scale, CreditCard, AlertTriangle, ShieldCheck, Gavel, RefreshCw, Mail, BookOpen } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function TermsOfUsePage() {
  const { isDark } = useTheme();

  const sectionClass = `rounded-2xl border p-6 md:p-8 ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`;
  const h2Class = `text-xl font-bold mb-4 flex items-center gap-3 ${isDark ? 'text-white' : 'text-slate-900'}`;
  const pClass = `text-sm leading-relaxed mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`;
  const liClass = `flex items-start gap-2.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`;
  const strongClass = isDark ? 'text-slate-200' : 'text-slate-800';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-colors duration-300 ${isDark ? 'bg-slate-950/80 border-slate-800/50' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className={`flex items-center gap-1.5 text-sm font-medium transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="QV" className="w-7 h-7" />
            <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Quanto Vale</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* Header */}
      <div className="pt-28 pb-12 md:pt-36 md:pb-16 relative">
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-emerald-600/5 to-transparent' : 'bg-gradient-to-b from-emerald-50 to-transparent'}`} />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6 border ${isDark ? 'bg-slate-800/80 border-slate-700/50 text-slate-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            <Scale className="w-3.5 h-3.5" />
            Documento Legal
          </div>
          <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Termos de Uso
          </h1>
          <p className={`text-base md:text-lg max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Leia atentamente antes de utilizar nossa plataforma. Ao se cadastrar, você concorda com estes termos.
          </p>
          <p className={`text-xs mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Última atualização: 23 de fevereiro de 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 pb-24 space-y-6">

        {/* 1. Aceitação */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <FileText className="w-4.5 h-4.5 text-white" />
            </div>
            1. Aceitação dos Termos
          </h2>
          <p className={pClass}>
            Ao acessar ou utilizar a plataforma <strong className={strongClass}>Quanto Vale</strong> ("Plataforma"), disponível em{' '}
            <strong className={strongClass}>quantovale.online</strong>, você declara que leu, compreendeu e concorda com estes Termos de Uso 
            e com a nossa <Link to="/politica-de-privacidade" className="text-emerald-500 hover:underline font-medium">Política de Privacidade</Link>.
          </p>
          <p className={pClass}>
            Caso não concorde com qualquer disposição destes termos, você não deverá utilizar a Plataforma.
          </p>
        </div>

        {/* 2. Descrição do serviço */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <BookOpen className="w-4.5 h-4.5 text-white" />
            </div>
            2. Descrição do Serviço
          </h2>
          <p className={pClass}>
            O <strong className={strongClass}>Quanto Vale</strong> é uma plataforma de valuation empresarial que utiliza o método de 
            Fluxo de Caixa Descontado (DCF) para estimar o valor de empresas com base em dados financeiros fornecidos pelo usuário e 
            indicadores setoriais oficiais do IBGE.
          </p>
          <p className={pClass}>O serviço inclui:</p>
          <ul className="space-y-2.5 mt-3">
            {[
              'Cálculo de valuation por DCF (Discounted Cash Flow)',
              'Ajuste setorial com dados oficiais do IBGE (CNAE + SIDRA)',
              'Score de risco e índice de maturidade empresarial',
              'Benchmark setorial',
              'Simulador interativo de cenários',
              'Relatório executivo em PDF',
              'Análise estratégica por inteligência artificial',
            ].map((item, i) => (
              <li key={i} className={liClass}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Cadastro */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <ShieldCheck className="w-4.5 h-4.5 text-white" />
            </div>
            3. Cadastro e Conta
          </h2>
          <p className={pClass}>Para utilizar o serviço, é necessário criar uma conta informando dados válidos e verdadeiros.</p>
          <p className={pClass}>Ao se cadastrar, você se compromete a:</p>
          <ul className="space-y-2.5 mt-3">
            {[
              'Fornecer informações verdadeiras, completas e atualizadas',
              'Manter a confidencialidade da sua senha de acesso',
              'Notificar imediatamente sobre uso não autorizado da sua conta',
              'Responsabilizar-se por todas as atividades realizadas em sua conta',
            ].map((item, i) => (
              <li key={i} className={liClass}>
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 4. Pagamento */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <CreditCard className="w-4.5 h-4.5 text-white" />
            </div>
            4. Pagamentos e Planos
          </h2>
          <p className={pClass}>
            A Plataforma oferece planos pagos com <strong className={strongClass}>pagamento único por análise</strong>. 
            Não há assinatura recorrente ou mensalidade.
          </p>
          <p className={pClass}>
            Os pagamentos são processados pelo gateway <strong className={strongClass}>Asaas</strong>, que aceita PIX, boleto bancário 
            e cartão de crédito. Ao realizar um pagamento, você concorda com os termos do processador de pagamento.
          </p>
          <p className={pClass}>
            Os valores dos planos estão sujeitos a alteração sem aviso prévio, mas pagamentos já realizados não serão afetados.
          </p>
          <div className={`mt-4 p-4 rounded-xl border ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100'}`}>
            <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
              <strong>Cupons de desconto:</strong> Cupons promocionais são de uso único e intransferíveis. 
              A Quanto Vale se reserva o direito de suspender ou modificar códigos de desconto a qualquer momento.
            </p>
          </div>
        </div>

        {/* 5. Limitação de responsabilidade */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-white" />
            </div>
            5. Limitação de Responsabilidade
          </h2>
          <div className={`p-4 rounded-xl border mb-4 ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'}`}>
            <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-800'}`}>
              <strong>Importante:</strong> O valuation gerado pela Plataforma é uma <strong>estimativa técnica</strong> baseada nas informações 
              fornecidas pelo usuário e em dados públicos. <strong>Não constitui aconselhamento financeiro, jurídico ou de investimento.</strong>
            </p>
          </div>
          <p className={pClass}>A Quanto Vale:</p>
          <ul className="space-y-2.5 mt-3">
            {[
              'Não garante a exatidão absoluta dos valores estimados',
              'Não se responsabiliza por decisões tomadas com base nos relatórios',
              'Não substitui consultoria financeira profissional personalizada',
              'Não se responsabiliza por perdas ou danos decorrentes do uso dos relatórios em negociações',
            ].map((item, i) => (
              <li key={i} className={liClass}>
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <p className={`${pClass} mt-4`}>
            A precisão do valuation depende diretamente da qualidade e veracidade dos dados financeiros fornecidos pelo usuário.
          </p>
        </div>

        {/* 6. Propriedade intelectual */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Gavel className="w-4.5 h-4.5 text-white" />
            </div>
            6. Propriedade Intelectual
          </h2>
          <p className={pClass}>
            Todo o conteúdo da Plataforma — incluindo código-fonte, design, textos, gráficos, logotipos, algoritmos e metodologia de cálculo — 
            é de propriedade exclusiva da <strong className={strongClass}>Quanto Vale</strong> e está protegido pelas leis de propriedade intelectual brasileiras.
          </p>
          <p className={pClass}>
            Os relatórios de valuation gerados são licenciados ao usuário para <strong className={strongClass}>uso pessoal e empresarial</strong>. 
            É proibida a reprodução, revenda ou distribuição dos relatórios como serviço comercial.
          </p>
        </div>

        {/* 7. Uso aceitável */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <ShieldCheck className="w-4.5 h-4.5 text-white" />
            </div>
            7. Uso Aceitável
          </h2>
          <p className={pClass}>Ao utilizar a Plataforma, você concorda em <strong className={strongClass}>não</strong>:</p>
          <ul className="space-y-2.5 mt-3">
            {[
              'Usar a plataforma para fins ilegais ou não autorizados',
              'Tentar acessar dados de outros usuários sem autorização',
              'Realizar engenharia reversa do sistema ou dos algoritmos',
              'Utilizar bots, scrapers ou ferramentas automatizadas para extração de dados',
              'Fornecer intencionalmente dados falsos para gerar relatórios fraudulentos',
              'Revender ou sublicenciar acesso à Plataforma',
            ].map((item, i) => (
              <li key={i} className={liClass}>
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 8. Modificações */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <RefreshCw className="w-4.5 h-4.5 text-white" />
            </div>
            8. Modificações dos Termos
          </h2>
          <p className={pClass}>
            A Quanto Vale reserva-se o direito de modificar estes Termos de Uso a qualquer momento. 
            As alterações entram em vigor na data de publicação da versão atualizada.
          </p>
          <p className={pClass}>
            Recomendamos a verificação periódica deste documento. O uso continuado da Plataforma após a publicação de alterações 
            constitui aceitação dos novos termos.
          </p>
        </div>

        {/* 9. Legislação e foro */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Scale className="w-4.5 h-4.5 text-white" />
            </div>
            9. Legislação Aplicável e Foro
          </h2>
          <p className={pClass}>
            Estes Termos de Uso são regidos pela legislação da República Federativa do Brasil. 
            Fica eleito o foro da comarca do domicílio do usuário para dirimir eventuais controvérsias, 
            conforme previsto no Código de Defesa do Consumidor (Lei nº 8.078/1990).
          </p>
        </div>

        {/* 10. Contato */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Mail className="w-4.5 h-4.5 text-white" />
            </div>
            10. Contato
          </h2>
          <p className={pClass}>
            Em caso de dúvidas sobre estes Termos de Uso, entre em contato:
          </p>
          <div className={`mt-4 p-5 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Quanto Vale</p>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              E-mail: <a href="mailto:quantovalehoje@gmail.com" className="text-emerald-500 hover:underline">quantovalehoje@gmail.com</a>
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Website: <a href="https://quantovale.online" className="text-emerald-500 hover:underline">quantovale.online</a>
            </p>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <Link to="/politica-de-privacidade" className="text-sm text-emerald-500 hover:text-emerald-400 font-medium">
            Política de Privacidade →
          </Link>
          <span className={isDark ? 'text-slate-700 hidden sm:inline' : 'text-slate-300 hidden sm:inline'}>|</span>
          <Link to="/" className={`text-sm transition ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
