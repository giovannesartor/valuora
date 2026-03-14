import { useState, useEffect } from 'react';
import {
  Megaphone, Copy, Check, Link2, MessageSquare, Mail,
  Instagram, Linkedin, Sparkles, Calculator, ChevronDown,
  ChevronUp, TrendingUp, Users, Building2, Handshake,
  Clock, RefreshCw, Shield, HelpCircle, Target, Zap,
  ArrowRight, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';


// ─── Texts by scenario / script ──────────────────────────────────────────────
const SCENARIO_TABS = [
  {
    group: 'By client situation',
    items: [
      {
        key: 'vender',
        label: 'Wants to sell the company',
        Icon: Building2,
        color: 'text-emerald-500',
        text: `Hello, [Name]!

I know you're thinking about selling your business — and one of the first questions a buyer will ask is: *"how much is this company worth?"*

Without a formal report, you negotiate in the dark and risk leaving money on the table (or scaring off the buyer with an unsubstantiated number).

There's a platform called *Valuora* that generates a professional valuation report in minutes — using DCF methodology, real industry benchmarks, and comprehensive risk analysis.

💰 Plans starting at *$990*, one-time payment, no subscription
📄 Executive PDF ready to present to buyers and investors
📊 25 pages of analysis in the most complete plan

With a report in hand, you enter any negotiation with confidence and a defensible number.

Want to take a look? I can send you the link: {link}`,
      },
      {
        key: 'captar',
        label: 'Investment fundraising',
        Icon: TrendingUp,
        color: 'text-blue-500',
        text: `Hello, [Nome]! Como vai?

I saw you're looking for investment for your business — and I want to help you come to that conversation much more prepared.

Every serious investor will ask: *"what's the company's valuation?"* If you don't have a defensible answer, you lose credibility immediately.

The *Valuora* platform solves this in minutes:

✅ Complete DCF valuation with market multiples
✅ Investment round simulation (cap table, dilution)
✅ Professional PDF report to present to funds and angels
✅ Industry benchmark with official data (Damodaran + sector sources)

Plans starting at *$990* — much less than a consultancy that charges $5,000 to $50,000 for the same service.

Want to see a sample report? {link}`,
      },
      {
        key: 'fusao',
        label: 'Merger / Expansion',
        Icon: Handshake,
        color: 'text-violet-500',
        text: `Hello, [Nome]!

I heard you're planning a merger / acquisition / corporate expansion — congratulations, it's an important milestone.

In these processes, the *correctly pricing each party* is what prevents conflict and ensures a fair deal. Without a formal report, any number turns into a dispute.

The *Valuora* platform generates the valuation report you'll use at the negotiation table:

📊 DCF methodology + market multiples (standard used by M&A advisors)
📄 Executive PDF with 25 pages of analysis
🔍 Industry benchmarks to support every number

It's worth much more than the price suggests — plans starting at *$990*.

Can I send you the link to check it out? {link}`,
      },
    ],
  },
  {
    group: 'Outreach scripts',
    items: [
      {
        key: 'frio',
        label: 'Cold outreach',
        Icon: Zap,
        color: 'text-amber-500',
        text: `Hello, [Nome]! Me chamo [Seu Nome], sou da [Seu Escritório].

I work with accounting/consulting for companies like yours and identified an opportunity that could be very relevant for you.

Quick question: do you know how much your company is worth today, if it were sold or received an investor tomorrow?

Most business owners don't have that answer — and it costs them dearly in negotiations.

There's a platform called *Valuora* that delivers a professional valuation report in minutes, for a fraction of what traditional consultancies charge.

Would you have 10 minutes for me to show you how it works?

If you prefer, you can take a look right here: {link}`,
      },
      {
        key: 'followup',
        label: 'Follow-up (3 days)',
        Icon: RefreshCw,
        color: 'text-teal-500',
        text: `Hello, [Nome]! Passando pra dar um oi 👋

I sent you a message a few days ago about the valuation platform *Valuora* — I imagine you must be busy.

I just wanted to leave a quick piece of information that might help with your decision:

👉 Traditional consultancies charge between *$5,000 and $50,000* for a valuation report — and take weeks.

Valuora delivers the same standard for *starting at $990*, in minutes, with an executive PDF ready to use.

If it makes sense for you at any point, here's the link: {link}

Feel free to reach out with any questions!`,
      },
      {
        key: 'objecao',
        label: `Objection: "it's too expensive"`,    
        Icon: Shield,
        color: 'text-rose-500',
        text: `I understand your concern, [Nome] — it makes total sense to question the investment.

Let me put it in perspective:

💸 A traditional valuation consultancy charges *$5,000 to $50,000* for the same service — and takes weeks.

*Valuora* delivers this for *$990 to $4,990*, in minutes, using the same DCF methodology that top advisors use.

But more importantly: think about the opposite scenario.

If you enter a sale/fundraising negotiation *without* a report:
❌ The buyer/investor dictates the price
❌ Any number you quote looks like "guesswork"
❌ You could leave tens or hundreds of thousands of dollars on the table

The report pays for itself in the first round of negotiation.

Want to give it a chance and see a real example? {link}`,
      },
      {
        key: 'pitchdeck',
        label: 'Pitch Deck only',
        Icon: Target,
        color: 'text-pink-500',
        text: `Hello, [Nome]! Tudo bem?

I know you're preparing a presentation for investors — and I want to show you something that can greatly elevate the level of your pitch.

The *Valuora* platform has an *AI Pitch Deck* module that generates a professional investor presentation in minutes:

🎯 Premium landscape A4 design
📊 Visual TAM/SAM/SOM, 2×2 competitive matrix
💰 Revenue waterfall, 3 financial scenarios
🤖 AI-generated strategic narrative with your company's data
👥 Team slide with photo and bio

*$897, one-time payment.* No subscription, no recurring fees.

Investors receive dozens of pitches per week — a professional deck makes you memorable.

Want to see an example? {link}`,
      },
    ],
  },
];

// ─── FAQ objections ───────────────────────────────────────────────────────────
const OBJECTIONS = [
  {
    q: `"Are you trustworthy? I've never heard of you."`,     
    a: `Totally understandable — the platform is new and focused, for now, on qualified referrals like yours.

You can copy and send it like this:

"Valuora uses the same DCF methodology that premium consultancies use. The results are based on Damodaran industry benchmarks and real databases — it's not a generic calculator. You can see a sample report before deciding anything."`,
  },
  {
    q: '"$990 is too expensive for me right now."',
    a: `"I understand. One thing worth considering: you can pay securely via Stripe with credit card. And the report has practical utility — any company sale or fundraising negotiation where you use the document already recovers the investment."`,
  },
  {
    q: '"How long does it take to receive the report?"',
    a: `"The report is ready in minutes after you fill in the company data. The PDF is sent by email immediately after payment is confirmed. There's no waiting queue."`,
  },
  {
    q: '"Does this replace a real consultancy?"',
    a: `"For most cases — yes. If you need a report for selling equity, raising angel/venture investment, M&A with mid-size companies, or banking purposes — Valuora's report covers it. For IPOs and transactions above $50M, I'd recommend supplementing with an advisor. But even in those cases, the report still serves as a starting point."`,
  },
  {
    q: '"My client already has an accountant — why would they need this?"',
    a: `"Valuation is not accounting. The accountant handles the past — valuation projects the future and determines the market price of the company. They are complementary services, not competing ones. Many accountants even recommend valuation reports for their own clients."`,
  },
];

// ─── Commission plans ─────────────────────────────────────────────────────────
const PLANS = [
  { label: 'Professional Valuation', price: 990,  commission: 0.5 },
  { label: 'Advanced Valuation',  price: 2490,  commission: 0.5 },
  { label: 'Complete Valuation', price: 4990, commission: 0.5 },
  { label: 'Pitch Deck',    price: 897,   commission: 0.5 },
  { label: 'Average mix',     price: 2200,  commission: 0.5 },
];

// ─── 5-step guide ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    n: '01',
    title: 'Identify the right client',
    desc: 'Focus on clients who are selling a company, seeking investment, planning partnerships, or want to understand their business value.',
    color: 'from-emerald-600 to-teal-500',
  },
  {
    n: '02',
    title: 'Choose the text and send it',
    desc: "Use the scripts on this page according to the client's situation. Copy, customize the name, and send through the channel you already use with them.",
    color: 'from-teal-500 to-cyan-500',
  },
  {
    n: '03',
    title: 'Schedule a quick demo',
    desc: "If the client is interested but hasn't decided yet, offer a 15-min call. Showing the sample report converts much more.",
    color: 'from-cyan-500 to-blue-500',
  },
  {
    n: '04',
    title: 'Send your personalized link',
    desc: 'Share the link from this page (with your referral code). This is how commissions are tracked and credited to you.',
    color: 'from-blue-500 to-violet-500',
  },
  {
    n: '05',
    title: 'Track it on the dashboard',
    desc: 'See conversions, pending and released commissions in real time on your partner dashboard. If the client stalls, use the follow-up.',
    color: 'from-violet-500 to-purple-500',
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────
function useCopy() {
  const [copiedKey, setCopiedKey] = useState(null);
  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied!');
    setTimeout(() => setCopiedKey(null), 2000);
  };
  return { copiedKey, copy };
}

export default function PartnerMarketingPage() {
  const { isDark } = useTheme();
  const { copiedKey, copy } = useCopy();
  const [referralLink, setReferralLink] = useState('https://valuora.online');
  const [referralCode, setReferralCode] = useState('');

  // UTM builder
  const [utm, setUtm] = useState({ source: 'whatsapp', medium: 'social', campaign: 'referral' });
  const utmLink = `${referralLink}?utm_source=${utm.source}&utm_medium=${utm.medium}&utm_campaign=${utm.campaign}`;

  // Commission calculator
  const [calcClients, setCalcClients] = useState(5);
  const [calcPlanIdx, setCalcPlanIdx] = useState(4); // Average mix
  const selectedPlan = PLANS[calcPlanIdx];
  const monthlyRevenue = calcClients * selectedPlan.price;
  const monthlyCommission = monthlyRevenue * selectedPlan.commission;
  const annualCommission = monthlyCommission * 12;

  // Active scenario tab
  const allTabs = SCENARIO_TABS.flatMap(g => g.items);
  const [activeTab, setActiveTab] = useState(allTabs[0].key);
  const activeItem = allTabs.find(t => t.key === activeTab);

  // FAQ open state
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    api.get('/partners/dashboard')
      .then(({ data }) => {
        if (data.partner?.referral_link) setReferralLink(data.partner.referral_link);
        if (data.partner?.referral_code) setReferralCode(data.partner.referral_code);
      })
      .catch(() => {});
  }, []);

  const card = `border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;
  const label = `text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const inputCls = `w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ─── Header ────────────────────────────────────────── */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <Megaphone className="w-5 h-5 text-emerald-500" />
          Marketing Kit
        </h1>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Everything you need to promote, convert, and increase your commissions.
        </p>
      </div>

      {/* ─── E: Guia 5 passos ───────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-5">
          <Target className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-sm font-withoutibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Guide: your first sale in 5 steps</h2>
        </div>
        <div className="grid md:grid-cols-5 gap-3">
          {STEPS.map((s) => (
            <div key={s.n} className={`rounded-xl p-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
                <span className="text-white text-xs font-bold">{s.n}</span>
              </div>
              <h3 className={`text-xs font-withoutibold mb-1.5 leading-snug ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{s.title}</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Link + C: UTM builder ──────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-sm font-withoutibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Your referral link</h2>
        </div>

        {/* Base link */}
        <div className={`flex items-center gap-3 px-4 py-3 border rounded-xl mb-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <span className={`flex-1 text-sm font-mono truncate ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{referralLink}</span>
          <button
            onClick={() => copy(referralLink, 'base-link')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition flex-shrink-0 ${
              copiedKey === 'base-link' ? 'bg-emerald-500 text-white' : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100')
            }`}
          >
            {copiedKey === 'base-link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedKey === 'base-link' ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* UTM builder */}
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-emerald-50/50 border-emerald-100'}`}>
          <p className={`text-xs font-withoutibold mb-3 flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
            <Sparkles className="w-3.5 h-3.5" />
            Trackable link generator (UTM) — know where your conversions came from
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { key: 'source', label: 'Source', options: ['whatsapp', 'instagram', 'linkedin', 'email', 'other'] },
              { key: 'medium', label: 'Medium',  options: ['social', 'direct', 'email', 'referral'] },
              { key: 'campaign', label: 'Campaign', options: ['referral', 'prospecting', 'followup', 'event'] },
            ].map(({ key, label: lbl, options }) => (
              <div key={key}>
                <label className={`block text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{lbl}</label>
                <select
                  value={utm[key]}
                  onChange={e => setUtm(p => ({ ...p, [key]: e.target.value }))}
                  className={inputCls}
                >
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className={`flex items-center gap-3 px-3 py-2.5 border rounded-xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <span className={`flex-1 text-xs font-mono truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{utmLink}</span>
            <button
              onClick={() => copy(utmLink, 'utm-link')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition flex-shrink-0 ${
                copiedKey === 'utm-link' ? 'bg-emerald-500 text-white' : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100')
              }`}
            >
              {copiedKey === 'utm-link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedKey === 'utm-link' ? 'Copied!' : 'Copy link rastreável'}
            </button>
          </div>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Use this link in each different channel to find out which converts the most.
          </p>
        </div>
      </div>

      {/* ─── B: Commission calculator ─────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-sm font-withoutibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            Commission calculator
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                How many clients would you refer per month?
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1} max={20} value={calcClients}
                  onChange={e => setCalcClients(Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <span className={`w-10 text-center text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{calcClients}</span>
              </div>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Your clients' predominant plan
              </label>
              <select
                value={calcPlanIdx}
                onChange={e => setCalcPlanIdx(Number(e.target.value))}
                className={inputCls}
              >
                {PLANS.map((p, i) => (
                  <option key={i} value={i}>
                    {p.label} — ${p.price.toLocaleString('en-US')} / sale
                  </option>
                ))}
              </select>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Fixed 50% commission on all sales. No referral limit.
            </p>
          </div>

          <div className={`rounded-xl p-5 flex flex-col justify-center gap-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
            <div>
              <p className={label}>Revenue generated for the platform</p>
              <p className={`text-xl font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                ${monthlyRevenue.toLocaleString('en-US')}<span className={`text-sm font-normal ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/month</span>
              </p>
            </div>
            <div className={`border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`} />
            <div>
              <p className={label}>Your monthly commission (50%)</p>
              <p className="text-3xl font-extrabold text-emerald-500">
                ${monthlyCommission.toLocaleString('en-US')}
              </p>
            </div>
            <div>
              <p className={label}>Annual projection</p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                ${annualCommission.toLocaleString('en-US')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── A + F: Textos por cenário / script ─────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-sm font-withoutibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Ready-to-copy scripts</h2>
        </div>

        {/* Tab groups */}
        <div className="space-y-3 mb-4">
          {SCENARIO_TABS.map((group) => (
            <div key={group.group}>
              <p className={`text-xs font-withoutibold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{group.group}</p>
              <div className="flex flex-wrap gap-2">
                {group.items.map(({ key, label: lbl, Icon, color }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === key
                        ? (isDark ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300')
                        : (isDark ? 'bg-slate-800 text-slate-400 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:text-slate-700')
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${activeTab === key ? color : ''}`} />
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Active text */}
        {activeItem && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <activeItem.Icon className={`w-4 h-4 ${activeItem.color}`} />
                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{activeItem.label}</span>
              </div>
              <button
                onClick={() => copy(activeItem.text.replace('{link}', referralLink), activeItem.key)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  copiedKey === activeItem.key ? 'bg-emerald-500 text-white' : (isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                }`}
              >
                {copiedKey === activeItem.key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedKey === activeItem.key ? 'Copied!' : 'Copy texto'}
              </button>
            </div>
            <pre className={`text-xs leading-relaxed whitespace-pre-wrap rounded-xl p-4 font-sans overflow-auto max-h-72 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
              {activeItem.text.replace('{link}', referralLink)}
            </pre>
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Tip: replace <span className={`font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>[Nome]</span> e <span className={`font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>[Seu Nome]</span> before sending.
            </p>
          </div>
        )}
      </div>

      {/* ─── D: FAQ / Objeções ──────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-sm font-withoutibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            Ready-made answers for objections
          </h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
            copy and send directly
          </span>
        </div>
        <div className="space-y-2">
          {OBJECTIONS.map((obj, i) => (
            <div key={i} className={`border rounded-xl overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
              >
                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{obj.q}</span>
                {openFaq === i
                  ? <ChevronUp className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  : <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                }
              </button>
              {openFaq === i && (
                <div className={`px-4 pb-4 border-t ${isDark ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
                  <pre className={`text-xs leading-relaxed whitespace-pre-wrap font-sans pt-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {obj.a}
                  </pre>
                  <button
                    onClick={() => copy(obj.a, `faq-${i}`)}
                    className={`mt-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                      copiedKey === `faq-${i}` ? 'bg-emerald-500 text-white' : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200')
                    }`}
                  >
                    {copiedKey === `faq-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === `faq-${i}` ? 'Copied!' : 'Copy resposta'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Dicas ──────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h2 className={`text-sm font-withoutibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Tips to convert more</h2>
        </div>
        <ul className="space-y-2.5">
          {[
            'Prioritize clients who mention selling a company, fundraising, or M&A — they have urgent needs and convert well.',
            'Offer to show a sample report in a 15-min call — those who see it convert much more.',
            'Use the trackable link with a different UTM per channel to find out which brings the best results.',
            "Don't force the sale: position it as a tool you recommend, not as something you're selling.",
            'Use the follow-up 3 days later — most "I forgot" turns into a sale on that second message.',
          ].map((tip, i) => (
            <li key={i} className={`flex items-start gap-2.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

