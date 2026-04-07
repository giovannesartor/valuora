import { useState, useEffect } from 'react';
import {
  Code2, Copy, Check, ExternalLink, Loader2, CheckCircle2,
  ArrowRight, Globe, Zap, Shield,
} from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';

const SETUP_STEPS = [
  { id: 'register', title: 'Register Integration', description: 'Create your integration credentials to start using the API.' },
  { id: 'configure', title: 'Configure Webhook', description: 'Set up a webhook URL to receive real-time notifications.' },
  { id: 'embed', title: 'Add Embed Code', description: 'Copy the embed snippet to add Valuora to your website.' },
  { id: 'test', title: 'Test & Go Live', description: 'Verify everything works, then go live.' },
];

export default function PartnerIntegrationPage() {
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchIntegration = async () => {
      try {
        const { data } = await api.get('/partners/integration');
        setIntegration(data);
        if (data.is_configured) setCurrentStep(3);
        else if (data.webhook_url) setCurrentStep(2);
        else if (data.client_id) setCurrentStep(1);
      } catch {
        // Not configured yet
      } finally {
        setLoading(false);
      }
    };
    fetchIntegration();
  }, []);

  const handleSetup = async () => {
    setSaving(true);
    try {
      const { data } = await api.post('/partners/integration/setup');
      setIntegration(data);
      setCurrentStep(1);
      toast.success('Integration created!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create integration');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!webhookUrl) return;
    setSaving(true);
    try {
      await api.patch('/partners/integration', { webhook_url: webhookUrl });
      setIntegration((prev) => ({ ...prev, webhook_url: webhookUrl }));
      setCurrentStep(2);
      toast.success('Webhook configured!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied!');
  };

  const embedSnippet = integration?.client_id
    ? `<!-- Valuora Integration -->
<div id="valuora-root"></div>
<script src="${window.location.origin}/sdk/valuora.js"
  data-client-id="${integration.client_id}"
  data-theme="light"
  data-source="valuora">
</script>`
    : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Code2 className="w-7 h-7 text-emerald-500" />
          Integration Setup
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Connect Valuora to your platform and earn commissions on every report.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-3 mb-6">
        {SETUP_STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center gap-3 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i < currentStep
                ? 'bg-emerald-500 text-white'
                : i === currentStep
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            }`}>
              {i < currentStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            {i < SETUP_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < currentStep ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          {SETUP_STEPS[currentStep]?.title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {SETUP_STEPS[currentStep]?.description}
        </p>

        {/* Step 0: Register */}
        {currentStep === 0 && !integration?.client_id && (
          <button
            onClick={handleSetup}
            disabled={saving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Create Integration
          </button>
        )}

        {/* Step 1: Configure Webhook */}
        {currentStep === 1 && (
          <div className="space-y-4">
            {integration?.client_id && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Client ID</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-50 dark:bg-slate-700 px-3 py-2 rounded-lg text-sm font-mono">
                    {integration.client_id}
                  </code>
                  <button onClick={() => handleCopy(integration.client_id)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                placeholder="https://yoursite.com/webhook/valuora"
              />
            </div>
            <button
              onClick={handleSaveWebhook}
              disabled={saving || !webhookUrl}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Save & Continue
            </button>
          </div>
        )}

        {/* Step 2: Embed Code */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="relative">
              <pre className="bg-slate-900 text-emerald-300 p-4 rounded-xl text-sm overflow-x-auto">
                <code>{embedSnippet}</code>
              </pre>
              <button
                onClick={() => handleCopy(embedSnippet)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            </div>
            <button
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              Continue
            </button>
          </div>
        )}

        {/* Step 3: Test & Go Live */}
        {currentStep === 3 && (
          <div className="text-center py-6">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Integration is ready!
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
              Your Valuora integration is configured and ready to use. Test it on your site and start earning commissions.
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="/api/v1/public/docs"
                target="_blank"
                className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                API Docs <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href={`/embed/valuation?client_id=${integration?.client_id}&theme=light`}
                target="_blank"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                Preview Embed
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Security Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-blue-800 dark:text-blue-300 text-sm">Security</h4>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            All API calls use OAuth2 with PKCE. Webhook payloads are signed with HMAC-SHA256. Never share your client secret publicly.
          </p>
        </div>
      </div>
    </div>
  );
}
