import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, Briefcase, CheckCircle, DollarSign,
  LinkIcon, Users, BarChart3, Wallet, Megaphone, FileText,
  MessageCircle, Bell, ClipboardList, Code2, Palette, Headphones,
  TrendingUp, ShieldCheck, Zap, Star, ChevronRight,
  BookOpen, Calculator, Building2,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';

export default function PartnerLandingPage() {
  usePageTitle('Partner Program | Earn 30% Commission — Valuora');
  const { isDark } = useTheme();

  useEffect(() => {
    const BASE = 'https://valuora.online';
    const url = `${BASE}/partners`;
    const title = 'Partner Program | Earn 30% Commission — Valuora';
    const description =
      'Refer clients and earn 30% commission on every valuation and pitch deck. Full dashboard, trackable referral link, ready-made marketing materials. No monthly fees.';
    const image = `${BASE}/og-image-partner.png`;
    const setMeta = (prop, val) => {
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
      el.setAttribute('content', val);
    };
    const setMetaName = (name, val) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
      el.setAttribute('content', val);
    };
    setMeta('og:type', 'website');
    setMeta('og:url', url);
    setMeta('og:title', title);
    setMeta('og:description', description);
    setMeta('og:image', image);
    setMetaName('description', description);
    setMetaName('twitter:card', 'summary_large_image');
    setMetaName('twitter:title', title);
    setMetaName('twitter:description', description);
    setMetaName('twitter:image', image);
  }, []);

  const commissions = [
    {
      label: 'Advanced Valuation',
      price: '$7,997',
      commission: '$2,399',
      color: 'emerald',
      featured: false,
      desc: 'Complete DCF valuation for SMBs',
    },
    {
      label: 'Complete Valuation',
      price: '$12,997',
      commission: '$3,899',
      color: 'teal',
      featured: true,
      desc: 'Advanced analysis with projections & AI',
    },
    {
      label: 'Pitch Deck',
      price: '$3,997',
      commission: '$1,199',
      color: 'purple',
      featured: false,
      desc: 'Investor-ready presentation',
    },
  ];

  const featureGroups = [
    {
      title: 'Referral & Pipeline',
      icon: LinkIcon,
      color: 'emerald',
      items: [
        { icon: LinkIcon, title: 'Trackable referral link', desc: 'Every client who joins through your link is automatically attributed to you.' },
        { icon: Users, title: 'Client & pipeline management', desc: 'Track each referral from first contact to closed sale.' },
        { icon: Bell, title: 'Automated follow-up', desc: 'Recover unresponsive clients with reminders and tracking.' },
      ],
    },
    {
      title: 'Financial',
      icon: Wallet,
      color: 'teal',
      items: [
        { icon: Wallet, title: 'Commissions & withdrawals', desc: 'Sales control, commissions, and withdrawal requests directly in your dashboard.' },
        { icon: BarChart3, title: 'Complete financial history', desc: 'See everything that came in, what is pending, and what has been paid.' },
        { icon: FileText, title: 'Client valuation reports', desc: 'Access the valuations of the clients you brought in.' },
      ],
    },
    {
      title: 'Marketing & Sales',
      icon: Megaphone,
      color: 'purple',
      items: [
        { icon: Megaphone, title: 'Ready-made marketing materials', desc: 'Assets, banners, and content ready for you to promote.' },
        { icon: MessageCircle, title: 'Prospecting scripts & templates', desc: 'Ready-to-use sales scripts and proposal templates.' },
        { icon: ClipboardList, title: 'Guided analysis', desc: 'Step-by-step process to collect the right information from clients.' },
      ],
    },
    {
      title: 'Advanced',
      icon: Code2,
      color: 'amber',
      items: [
        { icon: Code2, title: 'API & Webhooks', desc: 'Integrate Valuora with your system or platform.' },
        { icon: Palette, title: 'White-label & branding', desc: 'Customize reports and the experience with your identity.' },
        { icon: Headphones, title: 'Direct team support', desc: 'Talk directly to the Valuora team when you need help.' },
      ],
    },
  ];

  const profiles = [
    {
      icon: Calculator,
      title: 'Accountants & BPOs',
      desc: 'You already handle your client\'s finances. A valuation report is the natural extension of your service.',
    },
    {
      icon: Briefcase,
      title: 'Consultants & Advisors',
      desc: 'You work with growing companies. Offer valuation as part of your consulting package.',
    },
    {
      icon: Building2,
      title: 'M&A & Brokerages',
      desc: 'You negotiate deals. Valuation is the first step of any transaction.',
    },
  ];

  const c = (color) => {
    const map = { emerald: 'emerald', teal: 'teal', purple: 'violet', amber: 'amber' };
    return map[color] || 'emerald';
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>

      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b ${isDark ? 'bg-slate-950/80 border-slate-800/50' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg?v=2" alt="Valuora" className="w-8 h-8" />
            <span className={`font-semibold text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Valuora<sup className="text-[9px] ml-0.5 opacity-50">®</sup>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className={`text-xs font-medium tracking-wide px-3 py-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
              Sign in
            </Link>
            <Link to="/register" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-all">
              Start Valuation
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-slate-950 via-emerald-950/20 to-slate-950' : 'bg-gradient-to-b from-white via-emerald-50/30 to-white'}`} />
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6 ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            <Star className="w-3.5 h-3.5" />
            Partner Program
          </div>
          <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Refer. Earn.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">30% commission.</span>
          </h1>
          <p className={`text-lg md:text-xl max-w-3xl mx-auto mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            A single referral can earn you up to <strong>$3,899</strong> in commission. No monthly fees, no minimum targets, no lock-in.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/partner/register" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-3.5 rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20">
              Create partner account <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/partner/login" className={`inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold transition border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              I'm already a partner
            </Link>
          </div>
          <div className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-10 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-emerald-500" /> Registration in 30 seconds</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure payouts</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-500" /> No earnings limit</span>
          </div>
        </div>
      </section>

      {/* Commission table */}
      <section className="py-20 relative">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>How much you earn</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              30% commission on all products
            </h2>
            <p className={`max-w-xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              You refer, the client pays, and the money goes into your account. No caps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {commissions.map((item, i) => (
              <div
                key={i}
                className={`relative rounded-xl border p-6 flex flex-col transition-all duration-200 ${
                  item.featured
                    ? isDark
                      ? 'border-emerald-500/60 bg-slate-900 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/20'
                      : 'border-emerald-500 bg-white shadow-lg shadow-emerald-100/60 ring-1 ring-emerald-500/20'
                    : isDark
                      ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {item.featured && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-center px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    Best commission
                  </div>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <FileText className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.label}</h3>
                <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.desc}</p>
                <div className="mt-auto space-y-2">
                  <div className={`flex items-center justify-between text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span>Product price</span>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.price}</span>
                  </div>
                  <div className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                  <div className="flex items-center justify-between text-sm">
                    <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>Your commission</span>
                    <span className={`font-bold text-lg ${c(item.color) === 'emerald' ? 'text-emerald-500' : c(item.color) === 'teal' ? 'text-teal-500' : 'text-violet-500'}`}>
                      {item.commission}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={`py-20 ${isDark ? 'bg-slate-900/30' : 'bg-slate-50'}`}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>How it works</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Start earning in 4 steps
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Sign up free', desc: 'Create your account in under a minute, at no cost.' },
              { step: '02', title: 'Share your link', desc: 'Share your exclusive referral link with clients and contacts.' },
              { step: '03', title: 'Client purchases', desc: 'They fill in their data and complete the purchase on the platform.' },
              { step: '04', title: 'Get paid', desc: 'Track everything in your dashboard and withdraw whenever you want.' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
                  <span className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{s.step}</span>
                </div>
                <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/partner/register" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-7 py-3 rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20">
              Start now <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Ideal profile */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Ideal profile</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Who is this program for?
            </h2>
            <p className={`max-w-xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Any professional who already talks to business owners can become a partner.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {profiles.map((p, i) => (
              <div key={i} className={`rounded-xl border p-6 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <p.icon className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={`py-20 ${isDark ? 'bg-slate-900/30' : 'bg-slate-50'}`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Complete dashboard</p>
            <h2 className={`text-3xl font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Everything you need in one place
            </h2>
            <p className={`max-w-xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Beyond commissions, you get access to a complete dashboard to manage your entire operation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {featureGroups.map((group, gi) => (
              <div key={gi} className={`rounded-xl border p-6 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    <group.icon className={`w-4.5 h-4.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{group.title}</h3>
                </div>
                <div className="space-y-4">
                  {group.items.map((item, ii) => (
                    <div key={ii} className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{item.title}</p>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guarantees */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: ShieldCheck, title: 'No monthly fee', desc: 'You pay nothing to be a partner.' },
              { icon: Star, title: 'No registration fee', desc: '100% free sign-up.' },
              { icon: TrendingUp, title: 'No minimum target', desc: 'Refer at your own pace, no pressure.' },
            ].map((g, i) => (
              <div key={i} className="text-center p-6">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <g.icon className={`w-6 h-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{g.title}</h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={`py-20 ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className={`text-3xl font-semibold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Ready to start earning commissions?
          </h2>
          <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Create your account now and start referring in minutes. Everything is centralized in your dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/partner/register" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-3.5 rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20">
              I want to be a partner <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/partner/login" className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Sign in
            </Link>
          </div>
          <div className="mt-8">
            <Link to="/" className={`text-sm flex items-center justify-center gap-1.5 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back to homepage
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-8 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg?v=2" alt="Valuora" className="w-5 h-5" />
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Valuora &mdash; Professional business valuation</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className={`text-xs ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>Home</Link>
            <Link to="/partner/login" className={`text-xs ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>Partner Login</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
