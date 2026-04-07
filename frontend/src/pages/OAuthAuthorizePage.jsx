import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Shield, CheckCircle2, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

/**
 * OAuth2 Consent Page — where users authorize third-party apps.
 *
 * URL: /oauth/authorize?client_id=XXX&redirect_uri=YYY&response_type=code&scope=ZZZ&state=SSS
 */
export default function OAuthAuthorizePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const [consentInfo, setConsentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(null);

  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const responseType = searchParams.get('response_type') || 'code';
  const scope = searchParams.get('scope');
  const state = searchParams.get('state');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');

  useEffect(() => {
    if (!isAuthenticated) {
      const returnUrl = window.location.pathname + window.location.search;
      navigate('/login', { state: { from: returnUrl } });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !clientId) return;
    const fetchConsent = async () => {
      try {
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: responseType,
        });
        if (scope) params.set('scope', scope);
        if (state) params.set('state', state);

        const { data } = await api.get(`/oauth/authorize?${params.toString()}`);
        setConsentInfo(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load application information.');
      } finally {
        setLoading(false);
      }
    };
    fetchConsent();
  }, [isAuthenticated, clientId, redirectUri, responseType, scope, state]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const { data } = await api.post('/oauth/authorize', {
        client_id: clientId,
        redirect_uri: redirectUri,
        scopes: consentInfo.requested_scopes.map((s) => s.scope),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
      });
      window.location.href = data.redirect_url;
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to authorize application.');
      setApproving(false);
    }
  };

  const handleDeny = () => {
    const sep = redirectUri.includes('?') ? '&' : '?';
    window.location.href = `${redirectUri}${sep}error=access_denied&error_description=The+user+denied+access${state ? `&state=${state}` : ''}`;
  };

  if (!clientId || !redirectUri) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Invalid Parameters</h1>
          <p className="text-slate-600 dark:text-slate-400">client_id and redirect_uri are required.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Error</h1>
          <p className="text-slate-600 dark:text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Authorize Access</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Signed in as{' '}
            <span className="font-medium text-slate-700 dark:text-slate-300">{user?.email}</span>
          </p>
        </div>

        {/* App Info */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            {consentInfo.app_logo_url ? (
              <img src={consentInfo.app_logo_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                {consentInfo.app_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">{consentInfo.app_name}</h2>
              {consentInfo.app_website_url && (
                <a
                  href={consentInfo.app_website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
                >
                  {new URL(consentInfo.app_website_url).hostname}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          {consentInfo.app_description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">{consentInfo.app_description}</p>
          )}
        </div>

        {/* Requested Permissions */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
            This application will be able to:
          </h3>
          <div className="space-y-2">
            {consentInfo.requested_scopes.map((s) => (
              <div key={s.scope} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{s.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-6">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            By authorizing, this application will gain access to the data listed above on your Valuora
            account. You can revoke access at any time from Profile → Connected Applications.
          </p>
        </div>

        {/* Redirect Notice */}
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-4">
          After authorizing, you will be redirected to: <br />
          <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
            {redirectUri}
          </code>
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDeny}
            className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 font-medium transition-colors"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            disabled={approving}
            className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {approving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Authorizing...
              </>
            ) : (
              'Authorize'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
