/**
 * Valuora JavaScript SDK
 * 
 * Usage:
 *   import Valuora from '@valuora/sdk';
 *   const vl = new Valuora({ clientId: 'your-client-id', clientSecret: 'your-secret' });
 *   
 *   // Get valuations
 *   const valuations = await vl.valuations.list();
 *   
 *   // Create a valuation
 *   const valuation = await vl.valuations.create({ company_name: 'Acme', ... });
 *   
 *   // Get plans
 *   const plans = await vl.plans.list();
 */

const DEFAULT_BASE_URL = 'https://api.valuora.com/api/v1';

class ValuoraError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ValuoraError';
    this.status = status;
    this.data = data;
  }
}

class Valuora {
  /**
   * @param {Object} config
   * @param {string} config.clientId - Your OAuth2 client_id (vl_ prefix)
   * @param {string} config.clientSecret - Your OAuth2 client_secret (vls_ prefix)
   * @param {string} [config.baseUrl] - API base URL (default: production)
   * @param {string} [config.accessToken] - Pre-obtained access token
   */
  constructor({ clientId, clientSecret, baseUrl, accessToken } = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this._accessToken = accessToken || null;
    this._tokenExpiry = null;

    // Sub-resources
    this.valuations = new ValuationsResource(this);
    this.pitchDecks = new PitchDecksResource(this);
    this.plans = new PlansResource(this);
    this.user = new UserResource(this);
  }

  /**
   * Get a valid access token, refreshing if needed.
   */
  async getToken() {
    if (this._accessToken && this._tokenExpiry && Date.now() < this._tokenExpiry) {
      return this._accessToken;
    }

    // Client credentials flow
    const resp = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new ValuoraError(
        data.detail || 'Authentication failed',
        resp.status,
        data
      );
    }

    const data = await resp.json();
    this._accessToken = data.access_token;
    this._tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 30000; // 30s buffer
    return this._accessToken;
  }

  /**
   * Make an authenticated API request.
   */
  async request(method, path, body = null, params = null) {
    const token = await this.getToken();
    const url = new URL(`${this.baseUrl}/public${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      });
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const options = { method, headers };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const resp = await fetch(url.toString(), options);
    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      throw new ValuoraError(
        data?.detail || `Request failed with status ${resp.status}`,
        resp.status,
        data
      );
    }

    return data;
  }
}

// ─── Sub-resources ──────────────────────────────────────

class ValuationsResource {
  constructor(client) { this.client = client; }

  /** List valuations with pagination */
  async list({ page = 1, pageSize = 20, status } = {}) {
    return this.client.request('GET', '/valuations', null, { page, page_size: pageSize, status });
  }

  /** Get a specific valuation by ID */
  async get(id) {
    return this.client.request('GET', `/valuations/${id}`);
  }

  /**
   * Create a new valuation
   * Plans: professional ($990), investor_ready ($2,490), fundraising ($4,990)
   * Methods: DCF, Scorecard, Checklist, VC Method, Multiples
   */
  async create(data) {
    return this.client.request('POST', '/valuations', data);
  }

  /** Re-run valuation with updated inputs */
  async reanalyze(id, data) {
    return this.client.request('POST', `/valuations/${id}/reanalyze`, data);
  }
}

class PitchDecksResource {
  constructor(client) { this.client = client; }

  /** List pitch decks */
  async list({ page = 1, pageSize = 20 } = {}) {
    return this.client.request('GET', '/pitch-decks', null, { page, page_size: pageSize });
  }

  /** Get a specific pitch deck */
  async get(id) {
    return this.client.request('GET', `/pitch-decks/${id}`);
  }

  /** Create a new pitch deck ($890) */
  async create(data) {
    return this.client.request('POST', '/pitch-decks', data);
  }
}

class PlansResource {
  constructor(client) { this.client = client; }

  /** Get all available plans and pricing */
  async list() {
    return this.client.request('GET', '/plans');
  }
}

class UserResource {
  constructor(client) { this.client = client; }

  /** Get the authenticated user's profile */
  async me() {
    return this.client.request('GET', '/me');
  }
}

// ─── Exports ────────────────────────────────────────────

// ES Module
export default Valuora;
export { ValuoraError };

// Also attach to window for CDN/script tag usage
if (typeof window !== 'undefined') {
  window.Valuora = Valuora;
}
