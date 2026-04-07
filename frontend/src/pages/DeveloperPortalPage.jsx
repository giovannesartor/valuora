import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Copy, Eye, EyeOff, Trash2, RefreshCw, BarChart3,
  ExternalLink, Code2, Key, Shield, Loader2, CheckCircle2,
  AlertTriangle, Download,
} from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';

const AVAILABLE_SCOPES = [
  { scope: 'read:user', label: 'Read user profile' },
  { scope: 'read:valuations', label: 'Read valuations' },
  { scope: 'write:valuations', label: 'Create/edit valuations' },
  { scope: 'read:pitch_decks', label: 'Read pitch decks' },
  { scope: 'write:pitch_decks', label: 'Create/edit pitch decks' },
  { scope: 'read:plans', label: 'Read plans & pricing' },
];

const DEFAULT_SCOPES = AVAILABLE_SCOPES.map((s) => s.scope);

const SNIPPET = {
  javascript: (clientId) => `// 1. Exchange authorization code for token
const res = await fetch('${window.location.origin}/api/v1/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: AUTH_CODE,
    redirect_uri: 'https://yoursite.com/callback',
    client_id: '${clientId}',
    client_secret: YOUR_SECRET,
  }),
});
const { access_token } = await res.json();

// 2. List valuations
const valuations = await fetch('${window.location.origin}/api/v1/public/valuations', {
  headers: { Authorization: \`Bearer \${access_token}\` },
}).then(r => r.json());`,
  python: (clientId) => `import requests

# 1. Exchange authorization code for token
token_res = requests.post("${window.location.origin}/api/v1/oauth/token", data={
    "grant_type": "authorization_code",
    "code": AUTH_CODE,
    "redirect_uri": "https://yoursite.com/callback",
    "client_id": "${clientId}",
    "client_secret": YOUR_SECRET,
})
access_token = token_res.json()["access_token"]

# 2. List valuations
valuations = requests.get(
    "${window.location.origin}/api/v1/public/valuations",
    headers={"Authorization": f"Bearer {access_token}"}
).json()`,
  curl: (clientId) => `# 1. Exchange authorization code for token
curl -X POST ${window.location.origin}/api/v1/oauth/token \\
  -d "grant_type=authorization_code" \\
  -d "code=AUTH_CODE" \\
  -d "redirect_uri=https://yoursite.com/callback" \\
  -d "client_id=${clientId}" \\
  -d "client_secret=YOUR_SECRET"

# 2. List valuations
curl ${window.location.origin}/api/v1/public/valuations \\
  -H "Authorization: Bearer ACCESS_TOKEN"`,
};

export default function DeveloperPortalPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [newAppSecret, setNewAppSecret] = useState(null);
  const [snippetLang, setSnippetLang] = useState('javascript');

  const [form, setForm] = useState({
    name: '',
    description: '',
    website_url: '',
    redirect_uris: '',
    scopes: [...DEFAULT_SCOPES],
  });

  const fetchApps = useCallback(async () => {
    try {
      const { data } = await api.get('/oauth/apps');
      setApps(data);
    } catch {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.redirect_uris) {
      toast.error('Name and redirect URI are required');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        website_url: form.website_url || null,
        redirect_uris: form.redirect_uris.split('\n').map((u) => u.trim()).filter(Boolean),
        scopes: form.scopes,
      };
      const { data } = await api.post('/oauth/apps', payload);
      setNewAppSecret(data.client_secret);
      setShowCreateForm(false);
      setForm({ name: '', description: '', website_url: '', redirect_uris: '', scopes: [...DEFAULT_SCOPES] });
      fetchApps();
      toast.success('Application created successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create application');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (appId) => {
    if (!confirm('Are you sure? All tokens will be revoked.')) return;
    try {
      await api.delete(`/oauth/apps/${appId}`);
      fetchApps();
      if (selectedApp?.id === appId) setSelectedApp(null);
      toast.success('Application removed');
    } catch {
      toast.error('Failed to remove application');
    }
  };

  const handleRegenerateSecret = async (appId) => {
    if (!confirm('The current secret will be invalidated. Continue?')) return;
    try {
      const { data } = await api.post(`/oauth/apps/${appId}/regenerate-secret`);
      setNewAppSecret(data.client_secret);
      toast.success('Secret regenerated');
    } catch {
      toast.error('Failed to regenerate secret');
    }
  };

  const fetchUsage = async (appId) => {
    try {
      const { data } = await api.get(`/oauth/apps/${appId}/usage`);
      setUsageStats(data);
    } catch {
      toast.error('Failed to load usage statistics');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const selectApp = (app) => {
    setSelectedApp(app);
    fetchUsage(app.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Code2 className="w-7 h-7 text-emerald-500" />
            Developer Portal
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage your OAuth2 applications and integrate Valuora into other systems.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Application
        </button>
      </div>

      {/* New App Secret Alert */}
      {newAppSecret && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                Client Secret — Copy it now!
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                This secret will not be shown again. Store it in a secure location.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 bg-amber-100 dark:bg-amber-900/40 px-3 py-2 rounded-lg text-sm font-mono text-amber-900 dark:text-amber-200 break-all">
                  {newAppSecret}
                </code>
                <button
                  onClick={() => copyToClipboard(newAppSecret, 'Client Secret')}
                  className="px-3 py-2 bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4 text-amber-800 dark:text-amber-200" />
                </button>
              </div>
            </div>
            <button onClick={() => setNewAppSecret(null)} className="text-amber-600 hover:text-amber-800">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              New OAuth2 Application
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Application Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="My Application"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  rows={2}
                  placeholder="Valuation integration for system X"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  value={form.website_url}
                  onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="https://myapp.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Redirect URIs * (one per line)
                </label>
                <textarea
                  value={form.redirect_uris}
                  onChange={(e) => setForm((f) => ({ ...f, redirect_uris: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
                  rows={3}
                  placeholder={'https://myapp.com/callback\nhttp://localhost:3000/callback'}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Permissions (Scopes)
                </label>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map((s) => (
                    <label key={s.scope} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.scopes.includes(s.scope)}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            scopes: e.target.checked
                              ? [...f.scopes, s.scope]
                              : f.scopes.filter((x) => x !== s.scope),
                          }));
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-slate-700 dark:text-slate-300">{s.label}</span>
                      <code className="text-xs text-slate-400">{s.scope}</code>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Apps List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Your Applications ({apps.length})
          </h2>
          {apps.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
              <Key className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">No applications created yet.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                Create first application →
              </button>
            </div>
          ) : (
            apps.map((app) => (
              <button
                key={app.id}
                onClick={() => selectApp(app)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selectedApp?.id === app.id
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{app.name}</h3>
                  <span className={`w-2 h-2 rounded-full ${app.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  {app.client_id.substring(0, 20)}...
                </p>
                {app.is_first_party && (
                  <span className="inline-block mt-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">
                    First-party
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* App Detail / Integration Guide */}
        <div className="lg:col-span-2">
          {selectedApp ? (
            <div className="space-y-4">
              {/* App Credentials */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedApp.name}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRegenerateSecret(selectedApp.id)}
                      className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                      title="Regenerate secret"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(selectedApp.id)}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete application"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Client ID
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-slate-50 dark:bg-slate-700 px-3 py-2 rounded-lg text-sm font-mono break-all text-slate-900 dark:text-slate-200">
                        {selectedApp.client_id}
                      </code>
                      <button
                        onClick={() => copyToClipboard(selectedApp.client_id, 'Client ID')}
                        className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Redirect URIs
                    </label>
                    <div className="mt-1 space-y-1">
                      {selectedApp.redirect_uris.map((uri, i) => (
                        <code
                          key={i}
                          className="block bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-300"
                        >
                          {uri}
                        </code>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Scopes
                    </label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedApp.scopes.map((s) => (
                        <span
                          key={s}
                          className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage Stats */}
              {usageStats && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                    API Usage
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {usageStats.total_requests_today}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Requests today</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {usageStats.total_requests_month}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">This month</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <p className="text-2xl font-bold text-emerald-600">
                        {usageStats.remaining_daily_quota}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Remaining today</p>
                    </div>
                  </div>

                  {usageStats.daily_usage?.length > 0 && (
                    <div className="mt-5">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                        Last 7 days
                      </p>
                      <div className="flex items-end gap-1.5 h-28">
                        {usageStats.daily_usage.slice(-7).map((day, i) => {
                          const max = Math.max(
                            ...usageStats.daily_usage.slice(-7).map((d) => d.count),
                            1,
                          );
                          const pct = (day.count / max) * 100;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {day.count}
                              </span>
                              <div
                                className="w-full bg-emerald-500/80 rounded-t transition-all duration-300 min-h-[4px]"
                                style={{ height: `${Math.max(pct, 4)}%` }}
                              />
                              <span className="text-[9px] text-slate-400 dark:text-slate-500">
                                {day.date
                                  ? new Date(day.date).toLocaleDateString('en-US', {
                                      month: '2-digit',
                                      day: '2-digit',
                                    })
                                  : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {usageStats.daily_quota && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <span>Daily quota</span>
                        <span>
                          {usageStats.total_requests_today} / {usageStats.daily_quota}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            usageStats.total_requests_today / usageStats.daily_quota > 0.8
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              (usageStats.total_requests_today / usageStats.daily_quota) * 100,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Integration Guide */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-emerald-500" />
                  Quick Integration Guide
                </h3>

                <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg w-fit">
                  {['javascript', 'python', 'curl'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSnippetLang(lang)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        snippetLang === lang
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {lang === 'javascript' ? 'JavaScript' : lang === 'python' ? 'Python' : 'cURL'}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <pre className="bg-slate-900 dark:bg-slate-950 text-emerald-300 p-4 rounded-xl text-sm overflow-x-auto">
                    <code>{SNIPPET[snippetLang]?.(selectedApp.client_id)}</code>
                  </pre>
                  <button
                    onClick={() =>
                      copyToClipboard(SNIPPET[snippetLang]?.(selectedApp.client_id), 'Code snippet')
                    }
                    className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
                  <a
                    href="/api/v1/public/docs"
                    target="_blank"
                    className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
                  >
                    Interactive docs (Swagger) <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="/api/v1/public/postman"
                    download="valuora-api-v1.postman_collection.json"
                    className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Postman Collection
                  </a>
                  <a
                    href="/sdk/valuora.py"
                    download
                    className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Python SDK
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
              <Shield className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Select an application
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Choose an application from the list to view credentials, usage stats, and integration code — or create a new one to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
