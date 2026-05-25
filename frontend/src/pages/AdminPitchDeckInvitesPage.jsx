import { useState } from 'react';
import { Send, Inbox, Activity, Plus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import InvitesTable from '../components/pitch_deck/InvitesTable';
import PitchDeckTrackingDashboard from '../components/pitch_deck/PitchDeckTrackingDashboard';
import InvitePitchDeckModal from '../components/pitch_deck/InvitePitchDeckModal';

export default function AdminPitchDeckInvitesPage() {
  usePageTitle('Pitch Deck — Convites');
  const { isDark } = useTheme();
  const [tab, setTab] = useState('invites'); // 'invites' | 'tracking'
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Pitch Deck — Convites
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Envie links para clientes preencherem seus próprios pitch decks e acompanhe o engajamento.
          </p>
        </div>
        <button
          onClick={() => setInviteModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-600/30 hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          Enviar convite
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 mb-6 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        {[
          { id: 'invites',  label: 'Solicitações recebidas',  Icon: Inbox },
          { id: 'tracking', label: 'Tracking em tempo real',  Icon: Activity },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === id
                ? 'border-purple-500 text-purple-500'
                : isDark
                  ? 'border-transparent text-slate-400 hover:text-slate-200'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Guia rápido */}
      <details className={`mb-6 rounded-xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
        <summary className={`cursor-pointer text-sm font-medium flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          📘 <span>Como funciona o fluxo de Pitch Deck por convite</span>
        </summary>
        <div className={`mt-3 text-[13px] space-y-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          <div>
            <b>1. Enviar convite</b> — Clique em "Enviar convite", informe e-mail do cliente e (opcional) use a <b>QV IA</b>
            para pré-preencher o formulário a partir do site da empresa, PDF antigo ou texto. O cliente recebe um link único.
          </div>
          <div>
            <b>2. Solicitações recebidas</b> — Aba atual. Lista todos os convites criados, com status, score de qualidade,
            anexos enviados e ações (revisar, pedir ajustes, converter, reenviar, prorrogar, excluir).
          </div>
          <div>
            <b>3. Tracking em tempo real</b> — Outra aba. Mostra em qual etapa do funil cada convite está
            (criado → e-mail enviado → aberto → preenchendo → enviado → revisado → convertido), tempo médio,
            convites parados há mais de 3 dias e SLA atrasado.
          </div>
          <div>
            <b>4. Ações principais</b> sobre cada convite:
            <ul className="list-disc ml-5 mt-1 space-y-0.5">
              <li><b>Revisar</b> — abre o painel lateral com tudo que o cliente preencheu.</li>
              <li><b>Pedir ajustes</b> — devolve o convite ao cliente (status volta para Pendente) com mensagem opcional. O cliente recebe um e-mail.</li>
              <li><b>Converter em Pitch Deck</b> — cria um pitch deck oficial com os dados, pronto para gerar PDF/PPTX.</li>
              <li><b>Reenviar e-mail</b> — útil quando o cliente perdeu o link.</li>
              <li><b>Excluir / Apagar dados (LGPD)</b> — remove o convite ou apaga apenas dados pessoais a pedido do cliente.</li>
            </ul>
          </div>
          <div>
            <b>5. Auto-save do cliente</b> — Tudo que o cliente digita é salvo a cada 1,5s (rascunho). Mesmo que ele feche
            o navegador, ao voltar pelo mesmo link continua de onde parou.
          </div>
          <div>
            <b>6. Idioma do PDF</b> — Você escolhe pt-BR ou en-US ao criar. Se o cliente preencher em outro idioma, a QV IA
            traduz automaticamente ao gerar o PDF final.
          </div>
        </div>
      </details>

      {tab === 'invites' ? (
        <InvitesTable
          key={refreshKey}
          isDark={isDark}
          onConverted={() => { /* admin permanece na lista */ }}
        />
      ) : (
        <PitchDeckTrackingDashboard isDark={isDark} />
      )}

      <InvitePitchDeckModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onCreated={() => {
          setInviteModalOpen(false);
          setTab('invites');
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
