"""
Admin and Partner integration management routes.

Admin  → sees ALL OAuth apps, configures defaults, monitors global usage.
Partner → creates/manages their own integration (auto-linked to referral code).
"""
import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import (
    User, OAuthApp, OAuthToken, APIUsageLog, Partner,
)
from app.services.auth_service import get_current_user, get_current_admin
from app.services.oauth_service import (
    create_oauth_app,
    get_app_usage_stats,
    regenerate_client_secret,
    list_user_apps,
)
from app.schemas.oauth import AVAILABLE_SCOPES, SCOPE_DESCRIPTIONS
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Integration Management"])


# ═══════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════

class IntegrationAppSummary(BaseModel):
    id: UUID
    name: str
    owner_email: str
    owner_name: str
    client_id: str
    is_active: bool
    is_first_party: bool
    total_requests_month: int = 0
    total_tokens: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class IntegrationGlobalStats(BaseModel):
    total_apps: int
    active_apps: int
    total_api_calls_month: int
    total_api_calls_today: int
    total_active_tokens: int
    top_apps: List[dict]
    calls_by_day: List[dict]


class IntegrationDefaults(BaseModel):
    default_rate_limit_per_minute: int = 60
    default_rate_limit_per_day: int = 10000
    default_scopes: List[str] = AVAILABLE_SCOPES


class PartnerIntegrationSetup(BaseModel):
    """Wizard step data for partner integration setup."""
    site_name: str
    site_url: str
    callback_url: Optional[str] = None


class PartnerIntegrationResponse(BaseModel):
    app_id: UUID
    app_name: str
    client_id: str
    client_secret: str
    redirect_uris: List[str]
    referral_code: str
    embed_url: str
    snippet_iframe: str
    snippet_link: str
    snippet_js: str


class PartnerIntegrationInfo(BaseModel):
    has_integration: bool
    app: Optional[dict] = None
    referral_code: Optional[str] = None
    embed_url: Optional[str] = None
    snippet_iframe: Optional[str] = None
    snippet_link: Optional[str] = None
    snippet_js: Optional[str] = None
    usage: Optional[dict] = None


# ═══════════════════════════════════════════════════════════
# ADMIN: /admin/integrations
# ═══════════════════════════════════════════════════════════

@router.get("/admin/integrations/stats", response_model=IntegrationGlobalStats)
async def admin_integration_stats(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Global integration stats for admin dashboard."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_apps = (await db.execute(select(func.count(OAuthApp.id)))).scalar() or 0
    active_apps = (await db.execute(
        select(func.count(OAuthApp.id)).where(OAuthApp.is_active == True)
    )).scalar() or 0

    month_calls = (await db.execute(
        select(func.count(APIUsageLog.id)).where(APIUsageLog.created_at >= month_start)
    )).scalar() or 0

    today_calls = (await db.execute(
        select(func.count(APIUsageLog.id)).where(APIUsageLog.created_at >= today_start)
    )).scalar() or 0

    active_tokens = (await db.execute(
        select(func.count(OAuthToken.id)).where(
            OAuthToken.is_revoked == False,
            OAuthToken.access_token_expires_at > now,
        )
    )).scalar() or 0

    top_apps_r = await db.execute(
        select(
            OAuthApp.name,
            OAuthApp.client_id,
            func.count(APIUsageLog.id).label("calls"),
        )
        .join(APIUsageLog, APIUsageLog.app_id == OAuthApp.id)
        .where(APIUsageLog.created_at >= month_start)
        .group_by(OAuthApp.id, OAuthApp.name, OAuthApp.client_id)
        .order_by(desc("calls"))
        .limit(10)
    )
    top_apps = [{"name": r.name, "client_id": r.client_id, "calls": r.calls} for r in top_apps_r.all()]

    thirty_days_ago = now - timedelta(days=30)
    calls_by_day_r = await db.execute(
        select(
            func.date(APIUsageLog.created_at).label("day"),
            func.count(APIUsageLog.id).label("calls"),
        )
        .where(APIUsageLog.created_at >= thirty_days_ago)
        .group_by("day")
        .order_by("day")
    )
    calls_by_day = [{"day": str(r.day), "calls": r.calls} for r in calls_by_day_r.all()]

    return IntegrationGlobalStats(
        total_apps=total_apps,
        active_apps=active_apps,
        total_api_calls_month=month_calls,
        total_api_calls_today=today_calls,
        total_active_tokens=active_tokens,
        top_apps=top_apps,
        calls_by_day=calls_by_day,
    )


@router.get("/admin/integrations/apps")
async def admin_list_all_apps(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all OAuth apps with owner info."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    query = select(OAuthApp, User.email, User.full_name).join(User, OAuthApp.user_id == User.id)

    if search:
        safe = search.replace('%', '\\%').replace('_', '\\_')
        query = query.where(
            OAuthApp.name.ilike(f"%{safe}%") |
            User.email.ilike(f"%{safe}%") |
            OAuthApp.client_id.ilike(f"%{safe}%")
        )

    count_q = query.with_only_columns(func.count()).order_by(None)
    total = (await db.execute(count_q)).scalar() or 0

    result = await db.execute(
        query.order_by(desc(OAuthApp.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = result.all()

    items = []
    for app, email, full_name in rows:
        monthly_calls = (await db.execute(
            select(func.count(APIUsageLog.id)).where(
                APIUsageLog.app_id == app.id,
                APIUsageLog.created_at >= month_start,
            )
        )).scalar() or 0

        token_count = (await db.execute(
            select(func.count(OAuthToken.id)).where(
                OAuthToken.app_id == app.id,
                OAuthToken.is_revoked == False,
            )
        )).scalar() or 0

        items.append({
            "id": str(app.id),
            "name": app.name,
            "owner_email": email,
            "owner_name": full_name,
            "client_id": app.client_id,
            "is_active": app.is_active,
            "is_first_party": app.is_first_party,
            "rate_limit_per_minute": app.rate_limit_per_minute,
            "rate_limit_per_day": app.rate_limit_per_day,
            "scopes": app.scopes,
            "redirect_uris": app.redirect_uris,
            "total_requests_month": monthly_calls,
            "total_tokens": token_count,
            "created_at": app.created_at.isoformat() if app.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.patch("/admin/integrations/apps/{app_id}")
async def admin_update_app(
    app_id: str,
    is_active: Optional[bool] = None,
    is_first_party: Optional[bool] = None,
    rate_limit_per_minute: Optional[int] = None,
    rate_limit_per_day: Optional[int] = None,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin can toggle app status, change rate limits, mark as first-party."""
    from uuid import UUID as _UUID
    result = await db.execute(select(OAuthApp).where(OAuthApp.id == _UUID(app_id)))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "Application not found.")

    if is_active is not None:
        app.is_active = is_active
    if is_first_party is not None:
        app.is_first_party = is_first_party
    if rate_limit_per_minute is not None:
        app.rate_limit_per_minute = rate_limit_per_minute
    if rate_limit_per_day is not None:
        app.rate_limit_per_day = rate_limit_per_day

    await db.commit()
    return {"message": "Application updated."}


@router.delete("/admin/integrations/apps/{app_id}")
async def admin_delete_app(
    app_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin can delete any OAuth app."""
    from uuid import UUID as _UUID
    result = await db.execute(select(OAuthApp).where(OAuthApp.id == _UUID(app_id)))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "Application not found.")
    await db.delete(app)
    await db.commit()
    return {"message": "Application removed."}


# ═══════════════════════════════════════════════════════════
# PARTNER: /partners/integration
# ═══════════════════════════════════════════════════════════

async def _get_partner_for_user(db: AsyncSession, user: User) -> Partner:
    """Helper to get the partner profile for current user."""
    result = await db.execute(select(Partner).where(Partner.user_id == user.id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(403, "You are not an active partner.")
    return partner


def _build_snippets(client_id: str, referral_code: str, site_url: str = "") -> dict:
    """Build integration code snippets for a partner."""
    frontend_url = settings.FRONTEND_URL
    embed_url = f"{frontend_url}/embed/valuation?client_id={client_id}&ref={referral_code}"

    snippet_iframe = (
        f'<iframe\n'
        f'  src="{embed_url}"\n'
        f'  width="100%" height="900"\n'
        f'  frameborder="0" allow="payment"\n'
        f'  style="border-radius: 16px; border: 1px solid #e5e7eb;"\n'
        f'></iframe>'
    )

    snippet_link = (
        f'<a href="{embed_url}"\n'
        f'   target="_blank"\n'
        f'   style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;'
        f'background:#059669;color:white;border-radius:12px;font-weight:600;'
        f'text-decoration:none;font-family:system-ui">\n'
        f'  📊 Get Valuation\n'
        f'</a>'
    )

    snippet_js = (
        f'<!-- Valuora Integration -->\n'
        f'<div id="valuora-root"></div>\n'
        f'<script>\n'
        f'  (function() {{\n'
        f'    var iframe = document.createElement("iframe");\n'
        f'    iframe.src = "{embed_url}";\n'
        f'    iframe.style.cssText = "width:100%;height:900px;border:none;border-radius:16px";\n'
        f'    iframe.allow = "payment";\n'
        f'    document.getElementById("valuora-root").appendChild(iframe);\n'
        f'    window.addEventListener("message", function(e) {{\n'
        f'      if (e.data && e.data.source === "valuora") {{\n'
        f'        console.log("Valuora event:", e.data.type, e.data);\n'
        f'      }}\n'
        f'    }});\n'
        f'  }})();\n'
        f'</script>'
    )

    return {
        "embed_url": embed_url,
        "snippet_iframe": snippet_iframe,
        "snippet_link": snippet_link,
        "snippet_js": snippet_js,
    }


@router.get("/partners/integration")
async def partner_integration_info(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get partner's integration status + snippets."""
    partner = await _get_partner_for_user(db, current_user)

    result = await db.execute(
        select(OAuthApp).where(
            OAuthApp.user_id == current_user.id,
            OAuthApp.is_active == True,
        ).order_by(desc(OAuthApp.created_at)).limit(1)
    )
    app = result.scalar_one_or_none()

    if not app:
        return PartnerIntegrationInfo(
            has_integration=False,
            referral_code=partner.referral_code,
        )

    snippets = _build_snippets(app.client_id, partner.referral_code)
    usage = await get_app_usage_stats(db, app.id)

    return PartnerIntegrationInfo(
        has_integration=True,
        app={
            "id": str(app.id),
            "name": app.name,
            "client_id": app.client_id,
            "redirect_uris": app.redirect_uris,
            "scopes": app.scopes,
            "rate_limit_per_minute": app.rate_limit_per_minute,
            "rate_limit_per_day": app.rate_limit_per_day,
            "created_at": app.created_at.isoformat() if app.created_at else None,
        },
        referral_code=partner.referral_code,
        usage=usage,
        **snippets,
    )


@router.post("/partners/integration/setup")
async def partner_integration_setup(
    data: PartnerIntegrationSetup,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Wizard: Partner clicks 'Enable Integration'. Creates the OAuth app automatically.
    Returns client_secret (shown once) + ready-to-copy snippets.
    """
    partner = await _get_partner_for_user(db, current_user)

    existing = await db.execute(
        select(OAuthApp).where(
            OAuthApp.user_id == current_user.id,
            OAuthApp.is_active == True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "You already have an active integration. Use the settings page to manage it.")

    redirect_uris = [data.site_url.rstrip('/')]
    if data.callback_url:
        redirect_uris.append(data.callback_url.rstrip('/'))
    base = data.site_url.rstrip('/')
    redirect_uris.append(f"{base}/callback")
    redirect_uris = list(set(redirect_uris))

    app, client_secret = await create_oauth_app(
        db=db,
        user=current_user,
        name=f"{data.site_name} ({partner.referral_code})",
        redirect_uris=redirect_uris,
        description=f"Partner {partner.referral_code} integration with {data.site_name}",
        website_url=data.site_url,
        scopes=AVAILABLE_SCOPES,
    )

    snippets = _build_snippets(app.client_id, partner.referral_code, data.site_url)

    return PartnerIntegrationResponse(
        app_id=app.id,
        app_name=app.name,
        client_id=app.client_id,
        client_secret=client_secret,
        redirect_uris=redirect_uris,
        referral_code=partner.referral_code,
        **snippets,
    )


@router.post("/partners/integration/regenerate-secret")
async def partner_regenerate_secret(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate the partner's OAuth app client secret."""
    await _get_partner_for_user(db, current_user)

    result = await db.execute(
        select(OAuthApp).where(
            OAuthApp.user_id == current_user.id,
            OAuthApp.is_active == True,
        ).order_by(desc(OAuthApp.created_at)).limit(1)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "No active integration found.")

    new_secret = await regenerate_client_secret(db, app)
    return {"client_secret": new_secret, "message": "Secret regenerated."}


@router.delete("/partners/integration")
async def partner_remove_integration(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove partner's integration (deactivates the OAuth app)."""
    result = await db.execute(
        select(OAuthApp).where(
            OAuthApp.user_id == current_user.id,
            OAuthApp.is_active == True,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "No active integration.")

    app.is_active = False
    await db.commit()
    return {"message": "Integration deactivated."}


# ═══════════════════════════════════════════════════════════
# PUBLIC: Integration info (no auth needed)
# ═══════════════════════════════════════════════════════════

@router.get("/integration/info")
async def public_integration_info():
    """Public info about the Valuora API for the landing page."""
    return {
        "title": "Integrate Valuora into your system",
        "description": "Professional business valuation API for accountants, consultants, and platforms.",
        "features": [
            {
                "title": "Secure OAuth2",
                "description": "Industry-standard authentication. Your users log in with their Valuora account.",
                "icon": "shield",
            },
            {
                "title": "Full REST API",
                "description": "Create valuations, pitch decks, and query results via API.",
                "icon": "code",
            },
            {
                "title": "Embed Widget",
                "description": "Embed the complete Valuora interface on your website with a snippet.",
                "icon": "layout",
            },
            {
                "title": "Partner Commissions",
                "description": "Accounting firm partners earn commission on every sale via their integration.",
                "icon": "dollar",
            },
            {
                "title": "Complete Documentation",
                "description": "Step-by-step guides, code samples, and technical support.",
                "icon": "book",
            },
            {
                "title": "Real-time Analytics",
                "description": "Track API usage, requests, and performance in the Developer Portal.",
                "icon": "chart",
            },
        ],
        "scopes": [
            {"scope": s, "description": SCOPE_DESCRIPTIONS.get(s, s)}
            for s in AVAILABLE_SCOPES
        ],
        "docs_url": "/api/v1/public/docs",
        "register_url": "/register",
    }
