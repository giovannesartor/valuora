"""
Valuora — Python SDK
=====================

Official SDK for the Valuora public API.

Installation (copy this file or install via pip when available):
    pip install valuora   # future
    # or copy valuora.py into your project

Quick start:
    from valuora import Valuora

    vl = Valuora(client_id="vl_xxx", client_secret="vls_xxx")

    # List plans
    plans = vl.plans.list()

    # List valuations (with filters)
    valuations = vl.valuations.list(status="completed", page=1)

    # Get a specific valuation
    v = vl.valuations.get("uuid-of-valuation")

    # Create a valuation
    new = vl.valuations.create(
        company_name="Acme Corp",
        plan="professional",
        annual_revenue=5_000_000,
        annual_costs=3_000_000,
        annual_expenses=800_000,
        sector="Technology",
    )

    # Check status (polling)
    status = vl.valuations.status(new["data"]["id"])

    # Pitch Decks
    decks = vl.pitch_decks.list()
    deck = vl.pitch_decks.create(
        company_name="Startup XYZ",
        theme="startup",
        investor_type="angel",
    )

    # Authenticated user info
    user = vl.user.me()

Authentication:
    The SDK uses client_credentials by default (machine-to-machine).
    To access data on behalf of specific users, use the Authorization Code flow
    and pass the obtained access_token directly:

    vl = Valuora(access_token="user-token")
"""

__version__ = "1.0.0"
__author__ = "Valuora"

import json
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

try:
    import httpx
    _HTTP_CLIENT = "httpx"
except ImportError:
    import urllib.request
    import urllib.error
    _HTTP_CLIENT = "urllib"

DEFAULT_BASE_URL = "https://api.valuora.com/api/v1"


class ValuoraError(Exception):
    """Error returned by the Valuora API."""

    def __init__(self, message: str, status: int = 0, data: Optional[dict] = None):
        super().__init__(message)
        self.status = status
        self.data = data or {}

    def __repr__(self):
        return f"ValuoraError(status={self.status}, message={self.args[0]!r})"


class _BaseResource:
    def __init__(self, client: "Valuora"):
        self._client = client


class ValuationsResource(_BaseResource):
    """Valuation operations."""

    def list(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        sector: Optional[str] = None,
        created_after: Optional[str] = None,
        created_before: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        after: Optional[str] = None,
    ) -> dict:
        """List valuations with pagination and filters."""
        params = {
            "page": page, "page_size": page_size,
            "sort_by": sort_by, "sort_order": sort_order,
        }
        if status:
            params["status"] = status
        if sector:
            params["sector"] = sector
        if created_after:
            params["created_after"] = created_after
        if created_before:
            params["created_before"] = created_before
        if after:
            params["after"] = after
        return self._client._request("GET", "/public/valuations", params=params)

    def get(self, valuation_id: str) -> dict:
        """Get valuation details by ID."""
        return self._client._request("GET", f"/public/valuations/{valuation_id}")

    def create(
        self,
        company_name: str,
        plan: str,
        annual_revenue: float,
        annual_costs: float,
        annual_expenses: float,
        ein: Optional[str] = None,
        sector: Optional[str] = None,
        growth_rate: Optional[float] = None,
        projection_years: Optional[int] = None,
        additional_data: Optional[dict] = None,
    ) -> dict:
        """
        Create a new valuation.

        Plans: professional ($990), investor_ready ($2,490), fundraising ($4,990)
        Methods: DCF, Scorecard, Checklist, VC Method, Multiples
        """
        body = {
            "company_name": company_name,
            "plan": plan,
            "annual_revenue": annual_revenue,
            "annual_costs": annual_costs,
            "annual_expenses": annual_expenses,
        }
        if ein:
            body["ein"] = ein
        if sector:
            body["sector"] = sector
        if growth_rate is not None:
            body["growth_rate"] = growth_rate
        if projection_years is not None:
            body["projection_years"] = projection_years
        if additional_data:
            body["additional_data"] = additional_data
        return self._client._request("POST", "/public/valuations", body=body)

    def status(self, valuation_id: str) -> dict:
        """Check valuation status (useful for polling after payment)."""
        return self._client._request("GET", f"/public/valuations/{valuation_id}/status")

    def wait_for_completion(
        self, valuation_id: str, timeout: int = 300, interval: int = 5
    ) -> dict:
        """Wait until valuation completes (polling with timeout)."""
        start = time.time()
        while time.time() - start < timeout:
            result = self.status(valuation_id)
            st = result.get("data", {}).get("status", "")
            if st in ("completed", "failed"):
                return result
            time.sleep(interval)
        raise ValuoraError(f"Timeout waiting for valuation {valuation_id}", status=408)


class PitchDecksResource(_BaseResource):
    """Pitch Deck operations."""

    def list(
        self,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        after: Optional[str] = None,
    ) -> dict:
        """List pitch decks with pagination."""
        params = {"page": page, "page_size": page_size}
        if status:
            params["status"] = status
        if after:
            params["after"] = after
        return self._client._request("GET", "/public/pitch-decks", params=params)

    def get(self, pitch_deck_id: str) -> dict:
        """Get pitch deck details by ID."""
        return self._client._request("GET", f"/public/pitch-decks/{pitch_deck_id}")

    def create(
        self,
        company_name: str,
        theme: str = "corporate",
        investor_type: str = "general",
        sector: Optional[str] = None,
        description: Optional[str] = None,
        additional_data: Optional[dict] = None,
    ) -> dict:
        """Create a new pitch deck ($890)."""
        body = {
            "company_name": company_name,
            "theme": theme,
            "investor_type": investor_type,
        }
        if sector:
            body["sector"] = sector
        if description:
            body["description"] = description
        if additional_data:
            body["additional_data"] = additional_data
        return self._client._request("POST", "/public/pitch-decks", body=body)


class PlansResource(_BaseResource):
    """Query available plans."""

    def list(self) -> dict:
        """List all plans and pricing."""
        return self._client._request("GET", "/public/plans")


class UserResource(_BaseResource):
    """Authenticated user information."""

    def me(self) -> dict:
        """Get the authenticated user's profile."""
        return self._client._request("GET", "/public/user/me")


class WebhooksResource(_BaseResource):
    """Manage webhooks for an OAuth application."""

    def list(self, app_id: str) -> list:
        """List registered webhooks."""
        return self._client._request("GET", "/oauth/webhooks", params={"app_id": app_id})

    def create(self, app_id: str, url: str, events: Optional[List[str]] = None) -> dict:
        """Register a new webhook."""
        body: Dict[str, Any] = {"app_id": app_id, "url": url}
        if events:
            body["events"] = events
        return self._client._request("POST", "/oauth/webhooks", body=body)

    def update(self, webhook_id: str, **kwargs) -> dict:
        """Update a webhook (url, events, is_active)."""
        return self._client._request("PATCH", f"/oauth/webhooks/{webhook_id}", body=kwargs)

    def delete(self, webhook_id: str) -> dict:
        """Remove a webhook."""
        return self._client._request("DELETE", f"/oauth/webhooks/{webhook_id}")

    def deliveries(self, webhook_id: str) -> list:
        """List recent webhook deliveries."""
        return self._client._request("GET", f"/oauth/webhooks/{webhook_id}/deliveries")

    def events(self) -> list:
        """List available webhook events."""
        return self._client._request("GET", "/oauth/webhooks/events")


class Valuora:
    """
    Main Valuora SDK client.

    Args:
        client_id: Your OAuth2 client_id (obtained from the Developer Portal).
        client_secret: Your OAuth2 client_secret.
        access_token: Pre-obtained access token (optional, skips auto-authentication).
        base_url: API base URL (default: production).
        api_version: Date-based API version (default: "2025-01-15").
        timeout: Request timeout in seconds (default: 30).
    """

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        access_token: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        api_version: str = "2025-01-15",
        timeout: int = 30,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.base_url = base_url.rstrip("/")
        self.api_version = api_version
        self.timeout = timeout
        self._access_token = access_token
        self._token_expiry: Optional[float] = None

        # Sub-resources
        self.valuations = ValuationsResource(self)
        self.pitch_decks = PitchDecksResource(self)
        self.plans = PlansResource(self)
        self.user = UserResource(self)
        self.webhooks = WebhooksResource(self)

    def _get_token(self) -> str:
        """Get a valid access token, refreshing via client_credentials if needed."""
        if self._access_token and self._token_expiry and time.time() < self._token_expiry:
            return self._access_token

        if not self.client_id or not self.client_secret:
            if self._access_token:
                return self._access_token
            raise ValuoraError(
                "client_id and client_secret are required for automatic authentication. "
                "Alternatively, provide a pre-obtained access_token."
            )

        # Client credentials flow
        token_url = f"{self.base_url}/oauth/token"
        body = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

        if _HTTP_CLIENT == "httpx":
            resp = httpx.post(token_url, json=body, timeout=self.timeout)
            if resp.status_code != 200:
                data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                raise ValuoraError(
                    data.get("detail", f"Authentication failed (HTTP {resp.status_code})"),
                    status=resp.status_code,
                    data=data,
                )
            data = resp.json()
        else:
            req = urllib.request.Request(
                token_url,
                data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    data = json.loads(resp.read().decode())
            except urllib.error.HTTPError as e:
                error_body = json.loads(e.read().decode()) if e.fp else {}
                raise ValuoraError(
                    error_body.get("detail", f"Authentication failed (HTTP {e.code})"),
                    status=e.code,
                    data=error_body,
                )

        self._access_token = data["access_token"]
        self._token_expiry = time.time() + data.get("expires_in", 3600) - 30
        return self._access_token

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[dict] = None,
        params: Optional[dict] = None,
    ) -> Any:
        """Make an authenticated API request."""
        token = self._get_token()
        url = f"{self.base_url}{path}"

        # Build query string
        if params:
            filtered = {k: v for k, v in params.items() if v is not None}
            if filtered:
                url += "?" + urlencode(filtered)

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "API-Version": self.api_version,
            "User-Agent": f"valuora-python/{__version__}",
        }

        if _HTTP_CLIENT == "httpx":
            resp = httpx.request(
                method,
                url,
                json=body if body and method != "GET" else None,
                headers=headers,
                timeout=self.timeout,
            )
            if resp.status_code == 304:
                return None  # Not Modified
            data = resp.json() if resp.text else None
            if resp.status_code >= 400:
                detail = data.get("detail", f"Request failed (HTTP {resp.status_code})") if data else f"HTTP {resp.status_code}"
                raise ValuoraError(detail, status=resp.status_code, data=data)
            return data
        else:
            req = urllib.request.Request(url, headers=headers, method=method)
            if body and method != "GET":
                req.data = json.dumps(body).encode()
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    raw = resp.read().decode()
                    return json.loads(raw) if raw else None
            except urllib.error.HTTPError as e:
                error_body = {}
                try:
                    error_body = json.loads(e.read().decode()) if e.fp else {}
                except Exception:
                    pass
                raise ValuoraError(
                    error_body.get("detail", f"HTTP {e.code}"),
                    status=e.code,
                    data=error_body,
                )

    def health(self) -> dict:
        """Check API status (no authentication required)."""
        url = f"{self.base_url}/public/health"
        if _HTTP_CLIENT == "httpx":
            resp = httpx.get(url, timeout=self.timeout)
            return resp.json()
        else:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode())

    def changelog(self) -> list:
        """Get API changelog (no authentication required)."""
        url = f"{self.base_url}/public/changelog"
        if _HTTP_CLIENT == "httpx":
            resp = httpx.get(url, timeout=self.timeout)
            return resp.json()
        else:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode())

    def batch(self, requests: List[Dict[str, Any]]) -> dict:
        """
        Execute multiple operations in a single request.

        Args:
            requests: List of operations, each with 'method' and 'path'.
                      Example: [{"method": "GET", "path": "/valuations/uuid1"}]
        """
        return self._request("POST", "/public/batch", body={"requests": requests})

    def __repr__(self):
        return f"Valuora(base_url={self.base_url!r}, client_id={self.client_id!r})"
