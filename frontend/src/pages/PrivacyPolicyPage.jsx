import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Database, Server, UserCheck, Mail, FileText } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function PrivacyPolicyPage() {
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
            <img src="/favicon.svg?v=2" alt="QV" className="w-7 h-7" />
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
            <Shield className="w-3.5 h-3.5" />
            Documento Legal
          </div>
          <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Política de Privacidade
          </h1>
          <p className={`text-base md:text-lg max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Sua privacidade é fundamental. Este documento descreve como coletamos, usamos e protegemos seus dados.
          </p>
          <p className={`text-xs mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Última atualização: 23 de fevereiro de 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 pb-24 space-y-6">

        {/* 1. Informações gerais */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <FileText className="w-4.5 h-4.5 text-white" />
            </div>
            1. Informações Gerais
          </h2>
          <p className={pClass}>
            Esta Política de Privacidade se aplica ao serviço <strong className={strongClass}>Quanto Vale</strong> ("Plataforma"), 
            acessível pelo domínio <strong className={strongClass}>quantovale.online</strong>, e descreve como tratamos as informações pessoais 
            dos nossos usuários em conformidade com a <strong className={strongClass}>Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018)</strong>.
          </p>
          <p className={pClass}>
            Ao utilizar nossa Plataforma, você concorda com as práticas descritas nesta política.
          </p>
        </div>

        {/* 2. Dados coletados */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Database className="w-4.5 h-4.5 text-white" />
            </div>
            2. Dados que Coletamos
          </h2>
          <p className={pClass}>Coletamos os seguintes tipos de dados pessoais:</p>
          <div className="space-y-3 mt-4">
            <div>
              <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Dados de cadastro:</p>
              <ul className="space-y-2 ml-1">
                {['Nome completo', 'Endereço de e-mail', 'CPF ou CNPJ', 'Telefone (opcional)', 'Nome da empresa (opcional)'].map((item, i) => (
                  <li key={i} className={liClass}>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Dados financeiros (para valuation):</p>
              <ul className="space-y-2 ml-1">
                {['Receita anual', 'Margem de lucro líquido', 'Taxa de crescimento', 'Dívidas e caixa', 'Setor de atuação e CNPJ da empresa avaliada'].map((item, i) => (
                  <li key={i} className={liClass}>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Dados de navegação:</p>
              <ul className="space-y-2 ml-1">
                {['Endereço IP', 'Tipo de navegador e dispositivo', 'Páginas acessadas e tempo de permanência'].map((item, i) => (
                  <li key={i} className={liClass}>
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 3. Finalidade */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Eye className="w-4.5 h-4.5 text-white" />
            </div>
            3. Finalidade do Tratamento
          </h2>
          <p className={pClass}>Utilizamos seus dados pessoais para:</p>
          <ul className="space-y-2.5 mt-3">
            {[
              'Criar e gerenciar sua conta na Plataforma',
              'Processar e gerar relatórios de valuation empresarial',
              'Processar pagamentos via gateway de pagamento (Asaas)',
              'Enviar e-mails transacionais (confirmação, relatórios, redefinição de senha)',
              'Enviar comunicações de marketing, caso consentido',
              'Melhorar nossos serviços e experiência do usuário',
              'Cumprir obrigações legais e regulatórias',
            ].map((item, i) => (
              <li key={i} className={liClass}>
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 4. Compartilhamento */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <UserCheck className="w-4.5 h-4.5 text-white" />
            </div>
            4. Compartilhamento de Dados
          </h2>
          <p className={pClass}>
            <strong className={strongClass}>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing.</strong>
          </p>
          <p className={pClass}>Seus dados podem ser compartilhados apenas com:</p>
          <ul className="space-y-2.5 mt-3">
            {[
              { who: 'Gateway de pagamento (Asaas)', why: 'para processamento de cobranças, sendo compartilhados nome, e-mail e CPF/CNPJ' },
              { who: 'Serviço de e-mail (SMTP)', why: 'para envio de comunicações transacionais' },
              { who: 'Autoridades competentes', why: 'quando exigido por lei ou ordem judicial' },
            ].map((item, i) => (
              <li key={i} className={liClass}>
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                <span><strong className={strongClass}>{item.who}:</strong> {item.why}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 5. Segurança */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Lock className="w-4.5 h-4.5 text-white" />
            </div>
            5. Segurança dos Dados
          </h2>
          <p className={pClass}>Implementamos medidas técnicas e organizacionais para proteger seus dados:</p>
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            {[
              { icon: Lock, label: 'Criptografia SSL/TLS em todas as conexões' },
              { icon: Server, label: 'Servidores seguros com acesso restrito' },
              { icon: Shield, label: 'Senhas armazenadas com hash bcrypt' },
              { icon: Database, label: 'Backups criptografados regulares' },
            ].map((item, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                <item.icon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Direitos do titular */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <UserCheck className="w-4.5 h-4.5 text-white" />
            </div>
            6. Seus Direitos (LGPD)
          </h2>
          <p className={pClass}>Conforme a LGPD, você tem direito a:</p>
          <ul className="space-y-2.5 mt-3">
            {[
              'Confirmar a existência de tratamento dos seus dados',
              'Acessar seus dados pessoais',
              'Corrigir dados incompletos, inexatos ou desatualizados',
              'Solicitar anonimização, bloqueio ou eliminação de dados desnecessários',
              'Solicitar a portabilidade dos dados',
              'Revogar o consentimento a qualquer momento',
              'Solicitar a eliminação dos dados tratados com base no seu consentimento',
            ].map((item, i) => (
              <li key={i} className={liClass}>
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                {item}
              </li>
            ))}
          </ul>
          <div className={`mt-5 p-4 rounded-xl border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
            <p className={`text-sm ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
              Para exercer seus direitos, entre em contato pelo e-mail:{' '}
              <a href="mailto:quantovalehoje@gmail.com" className="font-semibold underline">quantovalehoje@gmail.com</a>
            </p>
          </div>
        </div>

        {/* 7. Cookies */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Database className="w-4.5 h-4.5 text-white" />
            </div>
            7. Cookies e Armazenamento Local
          </h2>
          <p className={pClass}>
            Utilizamos <strong className={strongClass}>localStorage</strong> para armazenar tokens de autenticação de forma segura. 
            Não utilizamos cookies de rastreamento de terceiros.
          </p>
        </div>

        {/* 8. Retenção */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Server className="w-4.5 h-4.5 text-white" />
            </div>
            8. Retenção de Dados
          </h2>
          <p className={pClass}>
            Seus dados pessoais são retidos pelo tempo necessário para a prestação dos serviços contratados ou para o cumprimento de obrigações legais. 
            Você pode solicitar a exclusão da sua conta e de todos os dados associados a qualquer momento.
          </p>
        </div>

        {/* 9. Contato */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Mail className="w-4.5 h-4.5 text-white" />
            </div>
            9. Contato
          </h2>
          <p className={pClass}>
            Em caso de dúvidas sobre esta Política de Privacidade ou sobre o tratamento dos seus dados, entre em contato:
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
          <Link to="/termos-de-uso" className="text-sm text-emerald-500 hover:text-emerald-400 font-medium">
            Termos de Uso →
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
