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
    group: 'Por situação do cliente',
    items: [
      {
        key: 'vender',
        label: 'Quer vender a empresa',
        Icon: Building2,
        color: 'text-emerald-500',
        text: `Olá, [Nome]! Tudo bem?

Sei que você está pensando em vender o negócio — e uma das primeiras perguntas que um comprador vai fazer é: *"quanto vale essa empresa?"*

Sem um laudo formal, você negocia no escuro e corre o risco de deixar dinheiro na mesa (ou assustar o comprador com um número sem embasamento).

Existe uma plataforma chamada *Quanto Vale* que gera um laudo profissional de valuation em minutos — com metodologia DCF, benchmarks setoriais reais e análise de risco completa.

💰 Planos a partir de *R$ 1.297*, pagamento único, sem assinatura
📄 PDF executivo pronto para apresentar a compradores e investidores
📊 25 páginas de análise no plano mais completo

Com laudo em mãos, você entra em qualquer negociação com segurança e numero defensável.

Quer dar uma olhada? Posso te mandar o link: {link}`,
      },
      {
        key: 'captar',
        label: 'Captação de investimento',
        Icon: TrendingUp,
        color: 'text-blue-500',
        text: `Olá, [Nome]! Como vai?

Vi que você está buscando investimento para o negócio — e quero te ajudar a chegar nessa conversa muito mais preparado.

Todo investidor sério vai pedir: *"qual o valuation da empresa?"* Se você não tem uma resposta defensável, perde credibilidade na hora.

A plataforma *Quanto Vale* resolve isso em minutos:

✅ Valuation DCF completo com múltiplos de mercado
✅ Simulação de rodada de investimento (cap table, diluição)
✅ Relatório PDF profissional para apresentar a fundos e anjos
✅ Benchmark do seu setor com dados oficiais (IBGE + fontes setoriais)

Planos a partir de *R$ 1.297* — bem menos que uma consultoria que cobra R$ 5.000 a R$ 50.000 pelo mesmo serviço.

Quer ver um exemplo de relatório? {link}`,
      },
      {
        key: 'fusao',
        label: 'Fusão / Expansão',
        Icon: Handshake,
        color: 'text-violet-500',
        text: `Olá, [Nome]!

Soube que você está planejando uma fusão / aquisição / expansão societária — parabéns, é um momento importante.

Nesses processos, a *precificação correta de cada parte* é o que evita conflito e garante um acordo justo. Sem um laudo formal, qualquer número vira briga.

A plataforma *Quanto Vale* gera o laudo de valuation que você vai usar na mesa de negociação:

📊 Metodologia DCF + múltiplos de mercado (padrão usado por M&A advisors)
📄 PDF executivo com 25 páginas de análise
🔍 Benchmarks setoriais para embasar cada número

Vale muito mais do que parece pelo preço — planos a partir de *R$ 1.297*.

Posso te mandar o link para conhecer? {link}`,
      },
    ],
  },
  {
    group: 'Scripts de abordagem',
    items: [
      {
        key: 'frio',
        label: 'Prospecção fria',
        Icon: Zap,
        color: 'text-amber-500',
        text: `Olá, [Nome]! Me chamo [Seu Nome], sou da [Seu Escritório].

Trabalho com contabilidade/consultoria para empresas como a sua e identifiquei uma oportunidade que pode ser muito relevante pra você.

Pergunta rápida: você sabe quanto a sua empresa vale hoje, se fosse vendida ou recebesse um investidor amanhã?

A maioria dos empresários não tem essa resposta — e isso custa caro em negociações.

Existe uma plataforma chamada *Quanto Vale* que entrega um laudo profissional de valuation em minutos, por uma fração do que cobram as consultorias tradicionais.

Teria 10 minutos pra eu te mostrar como funciona?

Se preferir, pode dar uma olhada direto aqui: {link}`,
      },
      {
        key: 'followup',
        label: 'Follow-up (3 dias)',
        Icon: RefreshCw,
        color: 'text-teal-500',
        text: `Olá, [Nome]! Passando pra dar um oi 👋

Mandei uma mensagem alguns dias atrás sobre a plataforma de valuation *Quanto Vale* — imagino que você deve estar ocupado.

Só queria deixar uma informação rápida que talvez ajude na sua decisão:

👉 Consultorias tradicionais cobram entre *R$ 5.000 e R$ 50.000* por um laudo de valuation — e levam semanas.

A Quanto Vale entrega o mesmo padrão por *a partir de R$ 1.297*, em minutos, com PDF executivo pronto para usar.

Se fizer sentido pra você em algum momento, o link fica aqui: {link}

Qualquer dúvida é só falar!`,
      },
      {
        key: 'objecao',
        label: 'Objeção: "está caro"',
        Icon: Shield,
        color: 'text-rose-500',
        text: `Entendo sua preocupação, [Nome] — faz todo sentido questionar o investimento.

Deixa eu colocar em perspectiva:

💸 Uma consultoria tradicional de valuation cobra de *R$ 5.000 a R$ 50.000* pelo mesmo serviço — e demora semanas.

A *Quanto Vale* entrega isso por *R$ 1.297 a R$ 4.997*, em minutos, com a mesma metodologia DCF que os grandes advisors usam.

Mas mais importante: pense no cenário oposto.

Se você entrar numa negociação de venda/captação *sem* um laudo:
❌ O comprador/investidor dita o preço
❌ Qualquer número que você citar parece "achismo"
❌ Você pode deixar dezenas ou centenas de milhares de reais na mesa

O laudo paga a si mesmo na primeira rodada de negociação.

Quer dar uma chance e ver um exemplo real? {link}`,
      },
      {
        key: 'pitchdeck',
        label: 'Só Pitch Deck',
        Icon: Target,
        color: 'text-pink-500',
        text: `Olá, [Nome]! Tudo bem?

Sei que você está preparando uma apresentação para investidores — e quero te mostrar algo que pode elevar muito o nível do seu pitch.

A plataforma *Quanto Vale* tem um módulo de *Pitch Deck por IA* que gera uma apresentação profissional para investidores em minutos:

🎯 Design premium em landscape A4
📊 TAM/SAM/SOM visual, matriz competitiva 2×2
💰 Waterfall de receita, 3 cenários financeiros
🤖 Narrativa estratégica gerada por IA com os dados da sua empresa
👥 Slide de equipe com foto e bio

*R$ 897, pagamento único.* Sem assinatura, sem mensalidade.

Investidores recebem dezenas de pitches por semana — um deck profissional faz você ser lembrado.

Quer ver um exemplo? {link}`,
      },
    ],
  },
];

// ─── FAQ objections ───────────────────────────────────────────────────────────
const OBJECTIONS = [
  {
    q: '"Vocês são confiáveis? Nunca ouvi falar."',
    a: `Totalmente compreensível — a plataforma é nova e focada, por enquanto, em indicações qualificadas como a sua.

Você pode copiar e enviar assim:

"A Quanto Vale usa a mesma metodologia DCF que consultorias premium usam. Os resultados são baseados em benchmarks setoriais do IBGE e bases de dados reais — não é uma calculadora genérica. Você pode ver um exemplo de relatório antes de decidir qualquer coisa."`,
  },
  {
    q: '"R$ 1.297 está caro pra mim agora."',
    a: `"Entendo. Uma coisa que vale considerar: você pode parcelar em até 12x no cartão (a partir de R$ 108/mês). E o laudo tem utilidade prática — qualquer negociação de venda de empresa ou captação onde você usar o documento já recupera o investimento."`,
  },
  {
    q: '"Quanto tempo demora pra receber o relatório?"',
    a: `"O relatório fica pronto em minutos após você preencher os dados da empresa. O PDF é enviado por e-mail imediatamente após o pagamento ser confirmado. Não tem fila de espera."`,
  },
  {
    q: '"Isso substitui uma consultoria de verdade?"',
    a: `"Para a maioria dos casos — sim. Se você precisa de um laudo para venda de participação, captação de investimento anjo/venture, M&A com empresas de médio porte ou banco — o relatório da Quanto Vale atende. Para IPOs e transações acima de R$ 50M, aí recomendaria complementar com um advisor. Mas nesses casos o laudo ainda serve como ponto de partida."`,
  },
  {
    q: '"Meu cliente já tem um contador — por que precisaria disso?"',
    a: `"Valuation não é contabilidade. O contador cuida do passado — o valuation projeta o futuro e determina o preço de mercado da empresa. São serviços complementares, não concorrentes. Muitos contadores inclusive indicam laudos de valuation para seus próprios clientes."`,
  },
];

// ─── Commission plans ─────────────────────────────────────────────────────────
const PLANS = [
  { label: 'Essencial',     price: 1297,  commission: 0.5 },
  { label: 'Profissional',  price: 2597,  commission: 0.5 },
  { label: 'Estratégico',   price: 4997,  commission: 0.5 },
  { label: 'Pitch Deck',    price: 897,   commission: 0.5 },
  { label: 'Mix médio',     price: 2000,  commission: 0.5 },
];

// ─── 5-step guide ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    n: '01',
    title: 'Identifique o cliente certo',
    desc: 'Foque em clientes que estão vendendo empresa, buscando investimento, planejando sociedade ou querem entender o valor do negócio.',
    color: 'from-emerald-600 to-teal-500',
  },
  {
    n: '02',
    title: 'Escolha o texto e envie',
    desc: 'Use os scripts desta página de acordo com a situação do cliente. Copie, personalize o nome e envie pelo canal que você já usa com ele.',
    color: 'from-teal-500 to-cyan-500',
  },
  {
    n: '03',
    title: 'Marque uma demonstração rápida',
    desc: 'Se o cliente tiver interesse mas ainda não decidiu, ofereça 15 min de call. Mostrar o relatório de exemplo converte muito mais.',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    n: '04',
    title: 'Envie seu link personalizado',
    desc: 'Use sempre o link desta página (com seu código de indicação). É assim que a comissão é rastreada e creditada pra você.',
    color: 'from-blue-500 to-violet-500',
  },
  {
    n: '05',
    title: 'Acompanhe no painel',
    desc: 'Veja conversões, comissões pendentes e liberadas em tempo real no seu painel de parceiro. Se o cliente travar, use o follow-up.',
    color: 'from-violet-500 to-purple-500',
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────
function useCopy() {
  const [copiedKey, setCopiedKey] = useState(null);
  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copiado!');
    setTimeout(() => setCopiedKey(null), 2000);
  };
  return { copiedKey, copy };
}

export default function PartnerMarketingPage() {
  const { isDark } = useTheme();
  const { copiedKey, copy } = useCopy();
  const [referralLink, setReferralLink] = useState('https://quantovale.online');
  const [referralCode, setReferralCode] = useState('');

  // UTM builder
  const [utm, setUtm] = useState({ source: 'whatsapp', medium: 'social', campaign: 'indicacao' });
  const utmLink = `${referralLink}?utm_source=${utm.source}&utm_medium=${utm.medium}&utm_campaign=${utm.campaign}`;

  // Commission calculator
  const [calcClients, setCalcClients] = useState(5);
  const [calcPlanIdx, setCalcPlanIdx] = useState(4); // Mix médio
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
          Kit de Marketing
        </h1>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Tudo que você precisa para divulgar, converter e aumentar suas comissões.
        </p>
      </div>

      {/* ─── E: Guia 5 passos ───────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-5">
          <Target className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Guia: sua primeira venda em 5 passos</h2>
        </div>
        <div className="grid md:grid-cols-5 gap-3">
          {STEPS.map((s) => (
            <div key={s.n} className={`rounded-xl p-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
                <span className="text-white text-xs font-bold">{s.n}</span>
              </div>
              <h3 className={`text-xs font-semibold mb-1.5 leading-snug ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{s.title}</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Link + C: UTM builder ──────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Seu link de indicação</h2>
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
            {copiedKey === 'base-link' ? 'Copiado!' : 'Copiar'}
          </button>
        </div>

        {/* UTM builder */}
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-emerald-50/50 border-emerald-100'}`}>
          <p className={`text-xs font-semibold mb-3 flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
            <Sparkles className="w-3.5 h-3.5" />
            Gerador de link rastreável (UTM) — saiba de onde vieram suas conversões
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { key: 'source', label: 'Fonte', options: ['whatsapp', 'instagram', 'linkedin', 'email', 'outro'] },
              { key: 'medium', label: 'Meio',  options: ['social', 'direct', 'email', 'referral'] },
              { key: 'campaign', label: 'Campanha', options: ['indicacao', 'prospeccao', 'followup', 'evento'] },
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
              {copiedKey === 'utm-link' ? 'Copiado!' : 'Copiar link rastreável'}
            </button>
          </div>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Use este link em cada canal diferente para saber qual converte mais.
          </p>
        </div>
      </div>

      {/* ─── B: Calculadora de comissão ─────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            Calculadora de comissão
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Quantos clientes você indicaria por mês?
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
                Plano predominante dos seus clientes
              </label>
              <select
                value={calcPlanIdx}
                onChange={e => setCalcPlanIdx(Number(e.target.value))}
                className={inputCls}
              >
                {PLANS.map((p, i) => (
                  <option key={i} value={i}>
                    {p.label} — R$ {p.price.toLocaleString('pt-BR')} / venda
                  </option>
                ))}
              </select>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Comissão fixa de 50% em todas as vendas. Sem limite de indicações.
            </p>
          </div>

          <div className={`rounded-xl p-5 flex flex-col justify-center gap-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
            <div>
              <p className={label}>Receita gerada para a plataforma</p>
              <p className={`text-xl font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                R$ {monthlyRevenue.toLocaleString('pt-BR')}<span className={`text-sm font-normal ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/mês</span>
              </p>
            </div>
            <div className={`border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`} />
            <div>
              <p className={label}>Sua comissão mensal (50%)</p>
              <p className="text-3xl font-extrabold text-emerald-500">
                R$ {monthlyCommission.toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <p className={label}>Projeção anual</p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                R$ {annualCommission.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── A + F: Textos por cenário / script ─────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Scripts prontos para copiar</h2>
        </div>

        {/* Tab groups */}
        <div className="space-y-3 mb-4">
          {SCENARIO_TABS.map((group) => (
            <div key={group.group}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{group.group}</p>
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
                {copiedKey === activeItem.key ? 'Copiado!' : 'Copiar texto'}
              </button>
            </div>
            <pre className={`text-xs leading-relaxed whitespace-pre-wrap rounded-xl p-4 font-sans overflow-auto max-h-72 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
              {activeItem.text.replace('{link}', referralLink)}
            </pre>
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Dica: substitua <span className={`font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>[Nome]</span> e <span className={`font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>[Seu Nome]</span> antes de enviar.
            </p>
          </div>
        )}
      </div>

      {/* ─── D: FAQ / Objeções ──────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            Respostas prontas para objeções
          </h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
            copie e envie direto
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
                    {copiedKey === `faq-${i}` ? 'Copiado!' : 'Copiar resposta'}
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
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Dicas para converter mais</h2>
        </div>
        <ul className="space-y-2.5">
          {[
            'Priorize clientes que mencionarem venda de empresa, captação ou M&A — esses têm necessidade urgente e convertem bem.',
            'Ofereça-se para mostrar um exemplo de relatório em 15 min de call — quem vê converte muito mais.',
            'Use o link rastreável com UTM diferente por canal para descobrir qual traz mais resultado.',
            'Não force a venda: posicione como uma ferramenta que você recomenda, não como algo que você está vendendo.',
            'Use o follow-up 3 dias depois — a maioria dos "esqueci" vira venda nessa segunda mensagem.',
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

