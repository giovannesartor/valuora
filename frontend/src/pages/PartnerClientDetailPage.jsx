import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Building2,
  ExternalLink, CheckCircle, Clock, BarChart2,
  LayoutDashboard, FileText, Compass, BarChart3, Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../lib/i18n';

import ClientHealthPanel from '../components/partner/ClientHealthPanel';
import ClientNotesTasks from '../components/partner/ClientNotesTasks';
import GuidedConsultation from '../components/partner/GuidedConsultation';
import ReportCoView from '../components/partner/ReportCoView';
import FollowUpTimeline from '../components/partner/FollowUpTimeline';

const STATUS_MAP = {
  pre_filled:  { color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  completed:   { color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  report_sent: { color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
};

const STATUS_LABELS = {
  pre_filled: 'Pre-filled',
  completed: 'Completed',
  report_sent: 'Report sent',
};

const TABS = [
  { key: 'overview',     icon: LayoutDashboard, i18n: 'crm_tab_overview' },
  { key: 'notes',        icon: FileText,        i18n: 'crm_tab_notes' },
  { key: 'consultation', icon: Compass,         i18n: 'crm_tab_consultation' },
  { key: 'report',       icon: BarChart3,       i18n: 'crm_tab_report' },
  { key: 'followups',    icon: Bell,            i18n: 'crm_tab_followups' },
];

export default function PartnerClientDetailPage() {
  const { id } = useParams();
  const { isDark } = useTheme();
  const { t } = useI18n();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const loadClient = () => {
    setLoading(true);
    api.get(`/partners/clients/${id}`)
      .then(({ data }) => setClient(data))
      .catch(() => toast.error(t('crm_error_loading')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadClient(); }, [id]);

  if (loading) return (
    <div className="space-y-4 p-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className={`h-24 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
      ))}
    </div>
  );

  if (!client) return (
    <div className="p-6 text-center">
      <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>{t('crm_client_not_found')}</p>
      <Link to="/partner/clients" className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-500 hover:underline">
        <ArrowLeft className="w-4 h-4" /> {t('crm_back_to_clients')}
      </Link>
    </div>
  );

  const status = STATUS_MAP[client.data_status] || { color: 'text-slate-400', bg: 'bg-slate-500/10' };
  const statusLabel = STATUS_LABELS[client.data_status] || client.data_status;
  const card = `border rounded-2xl p-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <Link
        to="/partner/clients"
        className={`inline-flex items-center gap-1.5 text-sm mb-6 transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
      >
        <ArrowLeft className="w-4 h-4" /> {t('crm_back_to_clients')}
      </Link>

      {/* Header */}
      <div className={`border rounded-2xl p-6 mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              {client.client_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{client.client_name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color} ${status.bg}`}>
                  {client.data_status === 'report_sent' && <CheckCircle className="w-3 h-3" />}
                  {statusLabel}
                </span>
                {client.client_company && (
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Building2 className="w-3 h-3 inline mr-1" />{client.client_company}
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('crm_registered_on')} {new Date(client.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 mb-4 p-1 rounded-xl overflow-x-auto ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
        {TABS.map(({ key, icon: Icon, i18n }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              activeTab === key
                ? 'bg-emerald-600 text-white shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {t(i18n)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Contact Info */}
            <div className={card}>
              <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('crm_contact_info')}</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{client.client_email}</span>
                </div>
                {client.client_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{client.client_phone}</span>
                  </div>
                )}
                {client.plan && (
                  <div className="flex items-center gap-3">
                    <BarChart2 className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t('crm_plan')}: {client.plan.charAt(0).toUpperCase() + client.plan.slice(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Link */}
            <div className={card}>
              <h2 className={`text-sm font-semibold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('crm_linked_analysis')}</h2>
              {client.analysis_id ? (
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{t('crm_analysis_created')}</span>
                  </div>
                  {client.company_name && (
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{client.company_name}</p>
                  )}
                  <Link
                    to={`/analysis/${client.analysis_id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium hover:from-emerald-500 hover:to-teal-500 transition"
                  >
                    <ExternalLink className="w-4 h-4" /> {t('crm_view_analysis')}
                  </Link>
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center py-6 gap-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Clock className="w-8 h-8 opacity-50" />
                  <p className="text-sm">{t('crm_analysis_not_started')}</p>
                  <p className="text-xs opacity-70">{t('crm_analysis_not_started_desc')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Health Panel */}
          <ClientHealthPanel clientId={id} />
        </div>
      )}

      {activeTab === 'notes' && (
        <ClientNotesTasks clientId={id} />
      )}

      {activeTab === 'consultation' && (
        <GuidedConsultation clientId={id} />
      )}

      {activeTab === 'report' && (
        <ReportCoView clientId={id} />
      )}

      {activeTab === 'followups' && (
        <FollowUpTimeline clientId={id} />
      )}
    </div>
  );
}
