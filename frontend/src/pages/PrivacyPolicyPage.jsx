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
            Back to home
          </Link>
          <div className="flex items-center gap-3">
            <img src="/favicon.svg?v=2" alt="QV" className="w-7 h-7" />
            <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Valuora</span>
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
            Legal Document
          </div>
          <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Privacy Policy
          </h1>
          <p className={`text-base md:text-lg max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Your privacy is fundamental. This document describes how we collect, use, and protect your data.
          </p>
          <p className={`text-xs mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Last updated: February 23, 2026
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
            1. General Information
          </h2>
          <p className={pClass}>
            Esta Privacy Policy se aplica ao serviço <strong className={strongClass}>Valuora</strong> ("Platform"), 
            accessible through the domain <strong className={strongClass}>valuora.online</strong>, and describes how we handle personal information 
            of our users in compliance with <strong className={strongClass}>General Data Protection Law (LGPD – Law No. 13,709/2018)</strong>.
          </p>
          <p className={pClass}>
            By using our Platform, you agree to the practices described in this policy.
          </p>
        </div>

        {/* 2. Dados coletados */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Database className="w-4.5 h-4.5 text-white" />
            </div>
            2. Data We Collect
          </h2>
          <p className={pClass}>We collect the following types of personal data:</p>
          <div className="space-y-3 mt-4">
            <div>
              <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Registration data:</p>
              <ul className="space-y-2 ml-1">
                {['Full name', 'Email address', 'Tax ID / EIN', 'Phone (optional)', 'Company name (optional)'].map((item, i) => (
                  <li key={i} className={liClass}>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Financial data (for valuation):</p>
              <ul className="space-y-2 ml-1">
                {['Annual revenue', 'Net profit margin', 'Growth rate', 'Debts and cash', 'Industry sector and EIN of the evaluated company'].map((item, i) => (
                  <li key={i} className={liClass}>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Browsing data:</p>
              <ul className="space-y-2 ml-1">
                {['IP address', 'Browser and device type', 'Pages visited and time spent'].map((item, i) => (
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
            3. Purpose of Processing
          </h2>
          <p className={pClass}>We use your personal data to:</p>
          <ul className="space-y-2.5 mt-3">
            {[
              'Create and manage your account on the Platform',
              'Process and generate business valuation reports',
              'Process payments via payment gateway (Stripe)',
              'Send transactional emails (confirmation, reports, password reset)',
              'Send marketing communications, if consented',
              'Improve our services and user experience',
              'Comply with legal and regulatory obligations',
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
            4. Data Sharing
          </h2>
          <p className={pClass}>
            <strong className={strongClass}>We do not sell, rent, or share your personal data with third parties for marketing purposes.</strong>
          </p>
          <p className={pClass}>Your data may only be shared with:</p>
          <ul className="space-y-2.5 mt-3">
            {[
              { who: 'Payment gateway (Stripe)', why: 'for payment processing, sharing name, email, and Tax ID' },
              { who: 'Email service (SMTP)', why: 'for sending transactional communications' },
              { who: 'Competent authorities', why: 'when required by law or court order' },
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
            5. Data Security
          </h2>
          <p className={pClass}>We implement technical and organizational measures to protect your data:</p>
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            {[
              { icon: Lock, label: 'SSL/TLS encryption on all connections' },
              { icon: Server, label: 'Secure servers with restricted access' },
              { icon: Shield, label: 'Passwords stored with bcrypt hashing' },
              { icon: Database, label: 'Regular encrypted backups' },
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
            6. Your Rights (LGPD)
          </h2>
          <p className={pClass}>Under the LGPD, you have the right to:</p>
          <ul className="space-y-2.5 mt-3">
            {[
              'Confirm the existence of processing of your data',
              'Access your personal data',
              'Correct incomplete, inaccurate, or outdated data',
              'Request anonymization, blocking, or deletion of unnecessary data',
              'Request data portability',
              'Revoke consent at any time',
              'Request deletion of data processed based on your consent',
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
              To exercise your rights, contact us by email:{' '}
              <a href="mailto:contact@valuora.online" className="font-semibold underline">contact@valuora.online</a>
            </p>
          </div>
        </div>

        {/* 7. Cookies */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Database className="w-4.5 h-4.5 text-white" />
            </div>
            7. Cookies and Local Storage
          </h2>
          <p className={pClass}>
            We use <strong className={strongClass}>localStorage</strong> to securely store authentication tokens. 
            We do not use third-party tracking cookies.
          </p>
        </div>

        {/* 8. Retenção */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Server className="w-4.5 h-4.5 text-white" />
            </div>
            8. Data Retention
          </h2>
          <p className={pClass}>
            Seus dados pessoais são retidos pelo tempo necessário para a prestação dos serviços contratados ou para o cumprimento de obrigações legais. 
            Você pode solicitar a exclusão da sua conta e de todos os dados associados a qualquer momento.
          </p>
        </div>

        {/* 9. Contact */}
        <div className={sectionClass}>
          <h2 className={h2Class}>
            <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Mail className="w-4.5 h-4.5 text-white" />
            </div>
            9. Contact
          </h2>
          <p className={pClass}>
            Em caso de dúvidas sobre esta Privacy Policy ou sobre o tratamento dos seus dados, entre em contato:
          </p>
          <div className={`mt-4 p-5 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Valuora</p>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              E-mail: <a href="mailto:contact@valuora.online" className="text-emerald-500 hover:underline">contact@valuora.online</a>
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Website: <a href="https://valuora.online" className="text-emerald-500 hover:underline">valuora.online</a>
            </p>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <Link to="/terms-of-use" className="text-sm text-emerald-500 hover:text-emerald-400 font-medium">
            Terms of Use →
          </Link>
          <span className={isDark ? 'text-slate-700 hidden sm:inline' : 'text-slate-300 hidden sm:inline'}>|</span>
          <Link to="/" className={`text-sm transition ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
