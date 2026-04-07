import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Code2, Shield, Layout, DollarSign, BookOpen, BarChart3,
  ArrowRight, Copy, Check, ChevronDown, ExternalLink, Zap, Globe, Users,
} from 'lucide-react';

const FEATURES = [
  { icon: Shield, title: 'OAuth2 Secure', description: 'Industry-standard authentication with Authorization Code + PKCE for maximum security.', color: 'emerald' },
  { icon: Code2, title: 'Full REST API', description: 'Create valuations, pitch decks, and query results via a RESTful API with versioning.', color: 'blue' },
  { icon: Layout, title: 'Embed Page', description: 'Embed the complete Valuora experience in your site with a simple iframe or redirect.', color: 'violet' },
  { icon: DollarSign, title: 'Partner Commissions', description: 'Partners earn 50% commission on every report purchased through their integration.', color: 'amber' },
  { icon: BookOpen, title: 'Complete Documentation', description: 'Step-by-step guides, code examples, SDKs, and an interactive Swagger playground.', color: 'rose' },
  { icon: BarChart3, title: 'Real-Time Analytics', description: 'Monitor API usage, request volume, endpoints, and quotas in real time.', color: 'teal' },
];

const STEPS = [
  { num: 1, title: 'Create an App', description: 'Register your OAuth2 application in the Developer Portal to get your Client ID and Secret.' },
  { num: 2, title: 'Authenticate', description: 'Use the OAuth2 Authorization Code + PKCE flow to get an access token on behalf of your users.' },
  { num: 3, title: 'Use the API', description: 'Create valuations, list results, download reports — all through our versioned REST API.' },
  { num: 4, title: 'Embed (optional)', description: 'Add a simple <iframe> or redirect to offer the full Valuora experience inside your app.' },
];

const SCOPES = [
  { scope: 'read:user', description: 'Read the authenticated user's profile' },
  { scope: 'read:valuations', description: 'List and read valuation details' },
  { scope: 'write:valuations', description: 'Create new valuations' },
  { scope: 'read:pitch_decks', description: 'List and read pitch deck details' },
  { scope: 'write:pitch_decks', description: 'Create new pitch decks' },
  { scope: 'read:plans', description: 'Read available plans and pricing' },
];

const FAQ_ITEMS = [
  { q: 'Is the API free?', a: 'Yes, API access is free. You only pay for the valuation reports when your users choose a plan. As a partner, you earn 50% commission.' },
  { q: 'What are the rate limits?', a: 'The public API allows 60 requests per minute per token. Need more? Contact us for enterprise limits.' },
  { q: 'Can I white-label the embed?', a: 'The embed page supports light/dark themes and shows your app name. Full white-label is available for enterprise partners.' },
  { q: 'How does authentication work?', a: 'We use OAuth2 Authorization Code + PKCE. Your users sign in to Valuora, approve access, and your app receives a secure token.' },
  { q: 'Which SDKs are available?', a: 'We provide official Python and JavaScript SDKs, plus a downloadable Postman collection for quick testing.' },
  { q: 'How are commissions tracked?', a: 'Every valuation created through your OAuth app is automatically linked to your partner account. View reports in the Partner Dashboard.' },
];

const PYTHON_EXAMPLE = `import requests

# 1. Exchange auth code for token
token = requests.post("https://app.valuora.com/api/v1/oauth/token", data={
    "grant_type": "authorization_code",
    "code": AUTH_CODE,
    "redirect_uri": "https://yoursite.com/callback",
    "client_id": "vl_abc123",
    "client_secret": "vls_secret",
}).json()

# 2. Create a valuation
valuation = requests.post(
    "https://app.valuora.com/api/v1/public/valuations",
    headers={"Authorization": f"Bearer {token['access_token']}"},
    json={
        "company_name": "Acme Inc.",
        "plan": "investor_ready",
        "sector": "Technology",
        "annual_revenue": 500000,
        "annual_costs": 200000,
        "annual_expenses": 50000,
    }
).json()

print(valuation)`;

const IFRAME_EXAMPLE = `<!-- Embed Valuora in your site -->
<iframe
  src="https://app.valuora.com/embed/valuation?client_id=vl_abc123&theme=light"
  width="100%"
  height="800"
  style="border: none; border-radius: 16px;"
  allow="payment"
></iframe>

<script>
  // Listen for events from Valuora
  window.addEventListener('message', (event) => {
    if (event.data.source !== 'valuora') return;

    if (event.data.type === 'valuation_created') {
      console.log('Valuation ID:', event.data.id);
      console.log('Plan:', event.data.plan);
    }
  });
</script>`;

export default function IntegratePage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [codeTab, setCodeTab] = useState('python');
  const [copied, setCopied] = useState(false);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-blue-500/10" />
        <div className="relative max-w-6xl mx-auto px-4 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            API v2025-01-15
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
            Integrate Valuora
            <br />
            <span className="text-emerald-500">into your product</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8">
            Add professional business valuation to your platform with our OAuth2 API, embeddable pages, and SDKs. Free to integrate — earn 50% commission on every report.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/developer"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-emerald-500/20"
            >
              Get Started — Free
            </Link>
            <a
              href="/api/v1/public/docs"
              target="_blank"
              className="px-6 py-3 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              API Docs <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">Everything you need to integrate</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
              <f.icon className={`w-8 h-8 text-${f.color}-500 mb-4`} />
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-slate-50 dark:bg-slate-900 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div key={s.num} className="text-center">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 font-bold text-lg">
                  {s.num}
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CODE EXAMPLES */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Code examples</h2>
        <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit mx-auto">
          {['python', 'iframe'].map((tab) => (
            <button
              key={tab}
              onClick={() => setCodeTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                codeTab === tab
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab === 'python' ? 'Python API' : 'Embed (iframe)'}
            </button>
          ))}
        </div>
        <div className="relative">
          <pre className="bg-slate-900 dark:bg-slate-950 text-emerald-300 p-6 rounded-2xl text-sm overflow-x-auto">
            <code>{codeTab === 'python' ? PYTHON_EXAMPLE : IFRAME_EXAMPLE}</code>
          </pre>
          <button
            onClick={() => handleCopy(codeTab === 'python' ? PYTHON_EXAMPLE : IFRAME_EXAMPLE)}
            className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </section>

      {/* SCOPES TABLE */}
      <section className="bg-slate-50 dark:bg-slate-900 py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">OAuth Scopes</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {SCOPES.map((s, i) => (
              <div key={s.scope} className={`flex items-center justify-between p-4 ${i > 0 ? 'border-t border-slate-200 dark:border-slate-700' : ''}`}>
                <code className="text-sm font-mono text-emerald-600 dark:text-emerald-400">{s.scope}</code>
                <span className="text-sm text-slate-600 dark:text-slate-400">{s.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARTNER CTA */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl p-8 sm:p-12">
          <Users className="w-12 h-12 text-white/80 mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Become a Partner
          </h2>
          <p className="text-white/80 max-w-lg mx-auto mb-6">
            Integrate Valuora and earn 50% commission on every report. Access the partner dashboard, marketing materials, and dedicated support.
          </p>
          <Link
            to="/partner/register"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-emerald-50 transition-colors"
          >
            Apply Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                {item.q}
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="text-center py-16 border-t border-slate-200 dark:border-slate-800">
        <Globe className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Ready to integrate?</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          Create your first app in under 5 minutes.
        </p>
        <Link
          to="/developer"
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors"
        >
          Go to Developer Portal
        </Link>
      </section>
    </div>
  );
}
