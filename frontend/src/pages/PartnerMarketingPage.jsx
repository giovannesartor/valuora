import { useState, useEffect } from 'react';
import {
  Megaphone, Copy, Check, Link2, MessageSquare, Mail,
  Instagram, Linkedin, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

const COPY_TEXTS = {
  whatsapp: `Olá! Você já pensou em saber o quanto sua empresa realmente vale? 🚀

A QuantoVale é uma plataforma de valuation profissional — rápida, precisa e feita para o mercado brasileiro.

Faça sua análise grátis em: {link}`,
  linkedin: `Empreendedor, você sabe o valor real do seu negócio?

Com a QuantoVale você obtém um laudo de valuation profissional em minutos — sem precisar de consultoria cara.

✅ Baseado em múltiplos de mercado brasileiros
✅ Projections DCF automatizadas
✅ Relatório PDF pronto para investidores

Acesse agora: {link}`,
  email: `Assunto: Descubra o valor real da sua empresa

Olá,

Gostaria de apresentar a QuantoVale, plataforma de valuation profissional que permite calcular o valor de mercado de empresas de forma rápida e precisa.

Ideal para: captação de investidores, planejamento estratégico, M&A e venda de participações.

👉 Acesse: {link}

Qualquer dúvida, estou à disposição!`,
  instagram: `💼 Você sabe quanto vale sua empresa?
  
A @quantovale transforma dados da sua empresa num laudo de valuation profissional — em minutos! 📊

✨ Múltiplos de mercado reais
✨ Relatório PDF premium  
✨ Planos a partir de R$ 197

🔗 Link na bio • {link}

#valuation #empreendedorismo #startups #negocios`,
};

export default function PartnerMarketingPage() {
  const { isDark } = useTheme();
  const [referralLink, setReferralLink] = useState('https://quantovale.com.br');
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    api.get('/partners/dashboard')
      .then(({ data }) => {
        if (data.partner?.referral_link) setReferralLink(data.partner.referral_link);
      })
      .catch(() => {});
  }, []);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text.replace('{link}', referralLink));
    setCopiedKey(key);
    toast.success('Copiado!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const btnCls = `p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`;
  const cardCls = `border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;

  const channels = [
    { key: 'whatsapp',  label: 'WhatsApp',  Icon: MessageSquare,  color: 'text-green-500'  },
    { key: 'linkedin',  label: 'LinkedIn',  Icon: Linkedin,       color: 'text-blue-500'   },
    { key: 'email',     label: 'E-mail',    Icon: Mail,           color: 'text-violet-500' },
    { key: 'instagram', label: 'Instagram', Icon: Instagram,      color: 'text-pink-500'   },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <Megaphone className="w-5 h-5 text-emerald-500" />
          Kit de Marketing
        </h1>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Materiais prontos para divulgar a QuantoVale e aumentar suas comissões
        </p>
      </div>

      {/* Referral link */}
      <div className={`${cardCls} mb-4`}>
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Seu link de indicação</h2>
        </div>
        <div className={`flex items-center gap-3 px-4 py-3 border rounded-xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <span className={`flex-1 text-sm font-mono truncate ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{referralLink}</span>
          <button
            onClick={() => copy(referralLink, 'link')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition ${
              copiedKey === 'link'
                ? 'bg-emerald-500 text-white'
                : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200')
            }`}
          >
            {copiedKey === 'link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedKey === 'link' ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Cada cliente que se cadastrar via este link será vinculado à sua conta automaticamente.
        </p>
      </div>

      {/* Copy texts */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {channels.map(({ key, label, Icon, color }) => (
          <div key={key} className={cardCls}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</h3>
              </div>
              <button
                onClick={() => copy(COPY_TEXTS[key], key)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  copiedKey === key
                    ? 'bg-emerald-500 text-white'
                    : (isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                }`}
              >
                {copiedKey === key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedKey === key ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <pre className={`text-xs leading-relaxed whitespace-pre-wrap rounded-xl p-3 font-sans overflow-auto max-h-40 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-600'}`}>
              {COPY_TEXTS[key].replace('{link}', referralLink)}
            </pre>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Dicas para converter mais</h2>
        </div>
        <ul className="space-y-2.5">
          {[
            'Envie o link personalizado pelo WhatsApp para clientes que já demonstraram interesse em valuation.',
            'Use o texto do LinkedIn para posts orgânicos — pessoas da sua rede têm maior probabilidade de comprar.',
            'Ao enviar e-mail, personalize o nome do destinatário no início da mensagem.',
            'Mencione o ROI do valuation: "com um laudo profissional, você negocia com muito mais segurança".',
            'Ofereça-se para apresentar a ferramenta em uma reunião rápida (15 min) — aumenta muito a taxa de conversão.',
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
