import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CheckCircle2, Loader2, AlertCircle, Sparkles,
  Building2, Mail, LogIn, UserPlus,
} from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';

export default function AnalysisInviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { isAuthenticated, user } = useAuthStore();
  usePageTitle('Convite de Análise');

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.get(`/analysis-invites/${token}`)
      .then(({ data }) => setInvite(data))
      .catch((err) => setError(err?.response?.data?.detail || 'Convite inválido'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const { data } = await api.post(`/analysis-invites/${token}/accept`);
      toast.success('Convite aceito! Redirecionando para pagamento...');
      // Manda direto pra página da análise, onde existe CTA de pagamento
      navigate(`/analysis/${data.analysis_id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Falha ao aceitar convite');
    } finally {
      setAccepting(false);
    }
  };

  // Quando o usuário voltar logado, dispara accept automaticamente se o e-mail bater
  useEffect(() => {
    if (!invite || !isAuthenticated || accepting) return;
    if (invite.status === 'accepted' || invite.status === 'completed') return;
    if ((user?.email || '').toLowerCase().trim() === (invite.client_email || '').toLowerCase().trim()) {
      handleAccept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite, isAuthenticated]);

  const wrapCls = `min-h-screen flex items-center justify-center p-6 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`;
  const cardCls = `w-full max-w-lg rounded-2xl p-8 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;

  if (loading) {
    return (
      <div className={wrapCls}>
        <div className="flex items-center gap-3 text-sm opacity-70">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando convite…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={wrapCls}>
        <div className={cardCls}>
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <h1 className="text-lg font-semibold">Convite indisponível</h1>
          </div>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{error}</p>
          <Link to="/" className="mt-4 inline-block text-sm text-emerald-500 hover:underline">Voltar à página inicial</Link>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  // Já concluído
  if (invite.status === 'completed') {
    return (
      <div className={wrapCls}>
        <div className={cardCls}>
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <h1 className="text-lg font-semibold">Convite já concluído</h1>
          </div>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Esta análise já foi paga.</p>
          <Link to="/dashboard" className="mt-4 inline-block text-sm text-emerald-500 hover:underline">Ir para o dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapCls}>
      <div className={cardCls}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
            <Sparkles className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Convite de análise</p>
            <h1 className="text-xl font-bold">{invite.partner_company_name || invite.partner_full_name || 'Seu parceiro'} preparou seu valuation</h1>
          </div>
        </div>

        <div className={`rounded-xl p-4 mb-5 border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          {invite.company_name && (
            <div className="flex items-center gap-2 mb-2 text-sm">
              <Building2 className="w-4 h-4 opacity-60" />
              <span><strong>{invite.company_name}</strong>{invite.sector && ` · ${invite.sector}`}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 opacity-60" />
            <span>{invite.client_email}</span>
          </div>
          {invite.suggested_plan && (
            <p className={`text-xs mt-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Plano sugerido: <strong>{invite.suggested_plan}</strong>
            </p>
          )}
        </div>

        {invite.message && (
          <div className={`rounded-xl p-4 mb-5 text-sm italic ${isDark ? 'bg-slate-800/50 text-slate-300' : 'bg-emerald-50 text-emerald-800'}`}>
            “{invite.message}”
          </div>
        )}

        {!isAuthenticated ? (
          <div className="space-y-3">
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Faça login com <strong>{invite.client_email}</strong> ou crie sua conta para visualizar a análise e finalizar o pagamento.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to={`/login?next=${encodeURIComponent(`/analise-guiada/convite/${token}`)}&email=${encodeURIComponent(invite.client_email)}`}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500"
              >
                <LogIn className="w-4 h-4" /> Já tenho conta
              </Link>
              <Link
                to={`/cadastro?next=${encodeURIComponent(`/analise-guiada/convite/${token}`)}&email=${encodeURIComponent(invite.client_email)}`}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'}`}
              >
                <UserPlus className="w-4 h-4" /> Criar conta
              </Link>
            </div>
          </div>
        ) : (user?.email || '').toLowerCase() !== (invite.client_email || '').toLowerCase() ? (
          <div className={`rounded-lg p-4 text-sm ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
            Você está logado como <strong>{user?.email}</strong>, mas o convite foi enviado para <strong>{invite.client_email}</strong>.
            Por favor, saia e entre com o e-mail correto.
          </div>
        ) : (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
          >
            {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {accepting ? 'Vinculando...' : 'Aceitar e ir para pagamento'}
          </button>
        )}
      </div>
    </div>
  );
}
