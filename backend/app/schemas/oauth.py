"""Schemas for OAuth2 and Public API integration."""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ─── Available Scopes ─────────────────────────────────────
AVAILABLE_SCOPES = [
    "read:user",
    "read:valuations",
    "write:valuations",
    "read:pitch_decks",
    "write:pitch_decks",
    "read:plans",
]

SCOPE_DESCRIPTIONS = {
    "read:user": "View your profile information",
    "read:valuations": "View your valuation analyses",
    "write:valuations": "Create and edit valuation analyses",
    "read:pitch_decks": "View your pitch decks",
    "write:pitch_decks": "Create and edit pitch decks",
    "read:plans": "View available plans and pricing",
}


# ─── OAuth App ────────────────────────────────────────────
class OAuthAppCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    redirect_uris: List[str] = Field(..., min_length=1)
    scopes: List[str] = Field(default=AVAILABLE_SCOPES)


class OAuthAppUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    redirect_uris: Optional[List[str]] = None
    scopes: Optional[List[str]] = None
    is_active: Optional[bool] = None


class OAuthAppResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    website_url: Optional[str]
    logo_url: Optional[str]
    client_id: str
    redirect_uris: List[str]
    scopes: List[str]
    is_active: bool
    is_first_party: bool
    rate_limit_per_minute: int
    rate_limit_per_day: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OAuthAppCreatedResponse(OAuthAppResponse):
    """Returned only on creation — includes the plain-text client secret."""
    client_secret: str


# ─── OAuth Authorization ──────────────────────────────────
class OAuthAuthorizeRequest(BaseModel):
    """Query params for GET /oauth/authorize."""
    client_id: str
    redirect_uri: str
    response_type: str = "code"
    scope: Optional[str] = None
    state: Optional[str] = None
    code_challenge: Optional[str] = None
    code_challenge_method: Optional[str] = None


class OAuthAuthorizeApproval(BaseModel):
    """POST body when user approves the authorization."""
    client_id: str
    redirect_uri: str
    scopes: List[str]
    state: Optional[str] = None
    code_challenge: Optional[str] = None
    code_challenge_method: Optional[str] = None


class OAuthTokenRequest(BaseModel):
    """POST /oauth/token — exchange code for tokens."""
    grant_type: str = Field(..., pattern="^(authorization_code|refresh_token|client_credentials)$")
    code: Optional[str] = None
    redirect_uri: Optional[str] = None
    client_id: str
    client_secret: str
    refresh_token: Optional[str] = None
    code_verifier: Optional[str] = None


class OAuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    refresh_token: Optional[str] = None
    scope: str


class OAuthRevokeRequest(BaseModel):
    token: str
    client_id: str
    client_secret: str


# ─── OAuth Consent Screen Info ────────────────────────────
class OAuthConsentInfo(BaseModel):
    """Info displayed on the consent/authorize screen."""
    app_name: str
    app_description: Optional[str]
    app_logo_url: Optional[str]
    app_website_url: Optional[str]
    requested_scopes: List[dict]
    redirect_uri: str
    state: Optional[str]


# ─── Public API: Plans ────────────────────────────────────
class PlanInfo(BaseModel):
    id: str
    name: str
    price: float
    price_formatted: str
    features: List[str]
    popular: bool = False


class PlansListResponse(BaseModel):
    plans: List[PlanInfo]


# ─── Public API: Valuation ────────────────────────────────
class PublicValuationCreate(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)
    cnpj: Optional[str] = None
    plan: str = Field(..., pattern="^(professional|investor_ready|fundraising|bundle|essencial|profissional|estrategico)$")
    sector: Optional[str] = None
    annual_revenue: float = Field(..., gt=0)
    annual_costs: float = Field(..., ge=0)
    annual_expenses: float = Field(..., ge=0)
    growth_rate: Optional[float] = None
    projection_years: Optional[int] = Field(None, ge=1, le=10)
    additional_data: Optional[dict] = None


class PublicValuationResponse(BaseModel):
    id: UUID
    company_name: str
    plan: str
    status: str
    valuation_min: Optional[float] = None
    valuation_max: Optional[float] = None
    valuation_average: Optional[float] = None
    risk_score: Optional[float] = None
    maturity_index: Optional[float] = None
    payment_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PublicValuationStatus(BaseModel):
    id: UUID
    status: str
    valuation_min: Optional[float] = None
    valuation_max: Optional[float] = None
    valuation_average: Optional[float] = None
    risk_score: Optional[float] = None
    payment_status: Optional[str] = None
    report_url: Optional[str] = None


# ─── Public API: Pitch Deck ──────────────────────────────
class PublicPitchDeckCreate(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)
    sector: Optional[str] = None
    description: Optional[str] = None
    theme: str = Field(default="corporate", pattern="^(corporate|startup|bold|minimal)$")
    investor_type: str = Field(default="general", pattern="^(general|angel|pe|bank)$")
    additional_data: Optional[dict] = None


class PublicPitchDeckResponse(BaseModel):
    id: UUID
    company_name: str
    status: str
    theme: str
    investor_type: Optional[str] = None
    payment_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Public API: User Info ────────────────────────────────
class PublicUserInfo(BaseModel):
    id: UUID
    email: str
    full_name: str
    company_name: Optional[str]
    is_admin: bool
    has_active_valuations: bool
    total_valuations: int
    total_pitch_decks: int


# ─── Developer Portal: API Usage Stats ───────────────────
class APIUsageStats(BaseModel):
    app_id: UUID
    app_name: str
    total_requests_today: int
    total_requests_month: int
    remaining_daily_quota: int
    rate_limit_per_minute: int
    rate_limit_per_day: int
    top_endpoints: List[dict]
    daily_usage: List[dict] = []
    daily_quota: Optional[int] = None


class APIUsageSummary(BaseModel):
    apps: List[APIUsageStats]
    total_api_calls: int
