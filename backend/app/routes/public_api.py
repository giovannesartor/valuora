"""
Public API v1 — endpoints for third-party integrations.

All authenticated endpoints require a valid OAuth2 Bearer token and appropriate scopes.
Responses use a standard envelope: { data, meta, pagination? }

Headers:
  - X-Request-Id: correlation ID (echoed from request or auto-generated)
  - API-Version: date-based versioning (default: 2024-01-15)
  - X-RateLimit-Limit / Remaining / Reset: rate limit info
  - ETag / If-None-Match: conditional requests for detail endpoints
"""
import hashlib
import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID as _UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import JSONResponse, HTMLResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.models.models import (
    User, Analysis, PitchDeck, OAuthToken, OAuthApp, Report,
    PlanType, AnalysisStatus, PitchDeckStatus,
)
from app.services.oauth_service import validate_access_token, log_api_usage
from app.schemas.oauth import (
    PublicValuationCreate,
    PublicPitchDeckCreate,
)
from app.schemas.analysis import PLAN_PRICES, PLAN_FEATURES, PITCH_DECK_PRICE, PLAN_CURRENCY

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["Public API"])
_bearer = HTTPBearer(auto_error=False)

API_VERSION = "2025-01-15"


# ═══════════════════════════════════════════════════════════
# ENVELOPE HELPERS
# ═══════════════════════════════════════════════════════════

def _envelope(request: Request, data, pagination=None, status_code=200):
    """Wrap response data in the standard API envelope."""
    body = {
        "data": data,
        "meta": {
            "request_id": getattr(request.state, "request_id", None),
            "api_version": getattr(request.state, "api_version", API_VERSION),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }
    if pagination:
        body["pagination"] = pagination

    headers = {}
    if request.method == "GET" and status_code == 200 and not pagination:
        raw = json.dumps(data, sort_keys=True, default=str).encode()
        etag = hashlib.md5(raw).hexdigest()
        headers["ETag"] = f'"{etag}"'
        if_none_match = request.headers.get("if-none-match", "").strip('"')
        if if_none_match == etag:
            return Response(status_code=304, headers={"ETag": f'"{etag}"'})

    return JSONResponse(content=body, status_code=status_code, headers=headers)


def _paginated(request: Request, items, total, page, page_size, next_cursor=None):
    """Build paginated envelope response."""
    total_pages = -(-total // page_size) if total else 0
    pagination = {
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
    }
    if next_cursor:
        pagination["next_cursor"] = next_cursor
    return _envelope(request, items, pagination=pagination)


# ═══════════════════════════════════════════════════════════
# AUTH MIDDLEWARE
# ═══════════════════════════════════════════════════════════

class OAuthContext:
    """Holds the authenticated OAuth context for a request."""

    def __init__(self, user: User, token: OAuthToken, app: OAuthApp):
        self.user = user
        self.token = token
        self.app = app
        self.scopes = token.scopes or []

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes


async def get_oauth_context(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> OAuthContext:
    """Dependency that validates OAuth2 Bearer token and returns context."""
    if not credentials:
        raise HTTPException(401, "Bearer token required. Use /oauth/token to obtain one.")

    result = await validate_access_token(db, credentials.credentials)
    if not result:
        raise HTTPException(401, "Invalid, expired, or revoked token.")

    token_record, user = result

    app_result = await db.execute(
        select(OAuthApp).where(OAuthApp.id == token_record.app_id)
    )
    app = app_result.scalar_one_or_none()
    if not app or not app.is_active:
        raise HTTPException(403, "Application disabled.")

    try:
        start_time = getattr(request.state, "_start_time", None)
        response_time = int((time.time() - start_time) * 1000) if start_time else None
        await log_api_usage(
            db=db, app_id=app.id, endpoint=str(request.url.path),
            method=request.method, user_id=user.id,
            ip=request.client.host if request.client else None,
            response_time_ms=response_time,
        )
    except Exception as e:
        logger.warning(f"[PublicAPI] Usage logging failed: {e}")

    return OAuthContext(user=user, token=token_record, app=app)


def require_scope(scope: str):
    """Factory: returns a Depends that checks a specific OAuth scope."""
    async def _dep(ctx: OAuthContext = Depends(get_oauth_context)):
        if not ctx.has_scope(scope):
            raise HTTPException(403, f"Scope '{scope}' not granted.")
        return ctx
    return _dep


# ═══════════════════════════════════════════════════════════
# PLANS (requires read:plans)
# ═══════════════════════════════════════════════════════════

def _fmt_price(price: float) -> str:
    if PLAN_CURRENCY == "USD":
        return f"${price:,.0f}"
    return f"R$ {price:,.0f}".replace(",", ".")


@router.get("/plans")
async def list_plans(
    request: Request,
    ctx: OAuthContext = Depends(require_scope("read:plans")),
):
    """List all available valuation plans and prices."""
    plans = [
        {
            "id": "professional",
            "name": "Professional",
            "price": PLAN_PRICES.get(PlanType.PROFESSIONAL, 990),
            "price_formatted": _fmt_price(PLAN_PRICES.get(PlanType.PROFESSIONAL, 990)),
            "currency": PLAN_CURRENCY,
            "features": PLAN_FEATURES.get(PlanType.PROFESSIONAL, []),
            "popular": False,
        },
        {
            "id": "investor_ready",
            "name": "Investor Ready",
            "price": PLAN_PRICES.get(PlanType.INVESTOR_READY, 2490),
            "price_formatted": _fmt_price(PLAN_PRICES.get(PlanType.INVESTOR_READY, 2490)),
            "currency": PLAN_CURRENCY,
            "features": PLAN_FEATURES.get(PlanType.INVESTOR_READY, []),
            "popular": True,
        },
        {
            "id": "fundraising",
            "name": "Fundraising",
            "price": PLAN_PRICES.get(PlanType.FUNDRAISING, 4990),
            "price_formatted": _fmt_price(PLAN_PRICES.get(PlanType.FUNDRAISING, 4990)),
            "currency": PLAN_CURRENCY,
            "features": PLAN_FEATURES.get(PlanType.FUNDRAISING, []),
            "popular": False,
        },
        {
            "id": "bundle",
            "name": "Bundle (Valuation + Pitch Deck)",
            "price": PLAN_PRICES.get(PlanType.BUNDLE, 5490),
            "price_formatted": _fmt_price(PLAN_PRICES.get(PlanType.BUNDLE, 5490)),
            "currency": PLAN_CURRENCY,
            "features": list(PLAN_FEATURES.get(PlanType.FUNDRAISING, [])) + ["pitch_deck"],
            "popular": False,
        },
        {
            "id": "pitch_deck",
            "name": "Pitch Deck",
            "price": PITCH_DECK_PRICE,
            "price_formatted": _fmt_price(PITCH_DECK_PRICE),
            "currency": PLAN_CURRENCY,
            "features": ["ai_pitch_deck", "4_visual_themes", "investor_profiles"],
            "popular": False,
        },
    ]
    return _envelope(request, plans)


# ═══════════════════════════════════════════════════════════
# USER INFO
# ═══════════════════════════════════════════════════════════

@router.get("/user/me")
async def get_user_info(
    request: Request,
    ctx: OAuthContext = Depends(require_scope("read:user")),
    db: AsyncSession = Depends(get_db),
):
    """Get authenticated user's profile info."""
    user = ctx.user

    analysis_count = await db.execute(
        select(func.count(Analysis.id)).where(
            Analysis.user_id == user.id, Analysis.deleted_at.is_(None),
        )
    )
    total_analyses = analysis_count.scalar() or 0

    pd_count = await db.execute(
        select(func.count(PitchDeck.id)).where(
            PitchDeck.user_id == user.id, PitchDeck.deleted_at.is_(None),
        )
    )
    total_pds = pd_count.scalar() or 0

    active_count = await db.execute(
        select(func.count(Analysis.id)).where(
            Analysis.user_id == user.id,
            Analysis.status == AnalysisStatus.COMPLETED,
            Analysis.deleted_at.is_(None),
        )
    )
    has_active = (active_count.scalar() or 0) > 0

    data = {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "company_name": user.company_name,
        "is_admin": user.is_admin or user.is_superadmin,
        "has_active_valuations": has_active,
        "total_valuations": total_analyses,
        "total_pitch_decks": total_pds,
    }
    return _envelope(request, data)


# ═══════════════════════════════════════════════════════════
# VALUATIONS (filters, sort, cursor pagination)
# ═══════════════════════════════════════════════════════════

@router.get("/valuations")
async def list_valuations(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter: draft, processing, completed, failed"),
    sector: Optional[str] = Query(None, description="Filter by sector name (partial match)"),
    created_after: Optional[str] = Query(None, description="ISO date: items created after this"),
    created_before: Optional[str] = Query(None, description="ISO date: items created before this"),
    sort_by: str = Query("created_at", description="Sort: created_at, company_name, equity_value"),
    sort_order: str = Query("desc", description="asc or desc"),
    after: Optional[str] = Query(None, description="Cursor-based pagination: pass last item's id"),
    ctx: OAuthContext = Depends(require_scope("read:valuations")),
    db: AsyncSession = Depends(get_db),
):
    """List valuations with filters, sorting, and cursor pagination."""
    user = ctx.user
    filters = [Analysis.user_id == user.id, Analysis.deleted_at.is_(None)]

    if status:
        try:
            filters.append(Analysis.status == AnalysisStatus(status))
        except ValueError:
            raise HTTPException(400, f"Invalid status: {status}. Use: draft, processing, completed, failed")

    if sector:
        filters.append(Analysis.sector.ilike(f"%{sector}%"))

    if created_after:
        try:
            dt = datetime.fromisoformat(created_after.replace("Z", "+00:00"))
            filters.append(Analysis.created_at >= dt)
        except ValueError:
            raise HTTPException(400, "created_after must be an ISO date")

    if created_before:
        try:
            dt = datetime.fromisoformat(created_before.replace("Z", "+00:00"))
            filters.append(Analysis.created_at <= dt)
        except ValueError:
            raise HTTPException(400, "created_before must be an ISO date")

    if after:
        try:
            cursor_r = await db.execute(select(Analysis.created_at).where(Analysis.id == _UUID(after)))
            cursor_ts = cursor_r.scalar_one_or_none()
            if cursor_ts:
                filters.append(
                    Analysis.created_at < cursor_ts if sort_order == "desc" else Analysis.created_at > cursor_ts
                )
        except Exception:
            pass

    count_filters = [Analysis.user_id == user.id, Analysis.deleted_at.is_(None)]
    if status:
        try:
            count_filters.append(Analysis.status == AnalysisStatus(status))
        except ValueError:
            pass
    if sector:
        count_filters.append(Analysis.sector.ilike(f"%{sector}%"))
    count_result = await db.execute(select(func.count(Analysis.id)).where(*count_filters))
    total = count_result.scalar() or 0

    sort_col_map = {
        "created_at": Analysis.created_at,
        "company_name": Analysis.company_name,
        "equity_value": Analysis.equity_value,
    }
    sort_col = sort_col_map.get(sort_by, Analysis.created_at)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    offset = (page - 1) * page_size if not after else 0

    result = await db.execute(
        select(Analysis).where(*filters).order_by(order).offset(offset).limit(page_size)
    )
    analyses = result.scalars().all()

    items = []
    for a in analyses:
        vr = a.valuation_result or {}
        items.append({
            "id": str(a.id),
            "company_name": a.company_name,
            "sector": a.sector,
            "plan": a.plan.value if a.plan else None,
            "status": a.status.value if a.status else None,
            "equity_value": float(a.equity_value) if a.equity_value else None,
            "risk_score": a.risk_score,
            "maturity_index": a.maturity_index,
            "valuation_min": vr.get("valuation_min"),
            "valuation_max": vr.get("valuation_max"),
            "valuation_average": vr.get("valuation_average"),
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    next_cursor = str(analyses[-1].id) if analyses and len(analyses) == page_size else None
    return _paginated(request, items, total, page, page_size, next_cursor)


@router.get("/valuations/{valuation_id}")
async def get_valuation(
    valuation_id: str,
    request: Request,
    ctx: OAuthContext = Depends(require_scope("read:valuations")),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific valuation."""
    user = ctx.user
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == _UUID(valuation_id),
            Analysis.user_id == user.id,
            Analysis.deleted_at.is_(None),
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(404, "Valuation not found.")

    vr = analysis.valuation_result or {}
    data = {
        "id": str(analysis.id),
        "company_name": analysis.company_name,
        "sector": analysis.sector,
        "cnpj": analysis.cnpj,
        "plan": analysis.plan.value if analysis.plan else None,
        "status": analysis.status.value if analysis.status else None,
        "revenue": float(analysis.revenue) if analysis.revenue else None,
        "net_margin": analysis.net_margin,
        "growth_rate": analysis.growth_rate,
        "debt": float(analysis.debt) if analysis.debt else None,
        "cash": float(analysis.cash) if analysis.cash else None,
        "projection_years": analysis.projection_years,
        "equity_value": float(analysis.equity_value) if analysis.equity_value else None,
        "risk_score": analysis.risk_score,
        "maturity_index": analysis.maturity_index,
        "percentile": analysis.percentile,
        "valuation_result": vr,
        "ai_analysis": analysis.ai_analysis if ctx.has_scope("read:valuations") else None,
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
        "updated_at": analysis.updated_at.isoformat() if analysis.updated_at else None,
    }
    return _envelope(request, data)


@router.post("/valuations", status_code=201)
async def create_valuation(
    data: PublicValuationCreate,
    request: Request,
    ctx: OAuthContext = Depends(require_scope("write:valuations")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new valuation via the API. Payment is required before processing."""
    user = ctx.user

    plan_map = {
        "professional": PlanType.PROFESSIONAL,
        "investor_ready": PlanType.INVESTOR_READY,
        "fundraising": PlanType.FUNDRAISING,
        "bundle": PlanType.BUNDLE,
    }
    plan = plan_map.get(data.plan)
    if not plan:
        raise HTTPException(400, f"Invalid plan: {data.plan}. Use: {', '.join(plan_map.keys())}")

    net_income = data.annual_revenue - data.annual_costs - data.annual_expenses
    net_margin = (net_income / data.annual_revenue) * 100 if data.annual_revenue > 0 else 0

    analysis = Analysis(
        user_id=user.id,
        company_name=data.company_name,
        cnpj=data.cnpj,
        sector=data.sector or "Other",
        revenue=data.annual_revenue,
        net_margin=net_margin,
        growth_rate=data.growth_rate or 5.0,
        debt=0, cash=0,
        projection_years=data.projection_years or 10,
        plan=plan,
        status=AnalysisStatus.DRAFT,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    from app.core.config import settings
    payment_url = f"{settings.FRONTEND_URL}/analysis/{analysis.id}?pay=true&plan={data.plan}"

    resp_data = {
        "id": str(analysis.id),
        "company_name": analysis.company_name,
        "plan": data.plan,
        "status": "draft",
        "payment_url": payment_url,
        "message": "Valuation created. Redirect the user to payment_url to complete payment.",
        "created_at": analysis.created_at.isoformat(),
    }
    return _envelope(request, resp_data, status_code=201)


@router.get("/valuations/{valuation_id}/status")
async def get_valuation_status(
    valuation_id: str,
    request: Request,
    ctx: OAuthContext = Depends(require_scope("read:valuations")),
    db: AsyncSession = Depends(get_db),
):
    """Check valuation status (useful for polling after payment)."""
    user = ctx.user
    result = await db.execute(
        select(Analysis).where(Analysis.id == _UUID(valuation_id), Analysis.user_id == user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(404, "Valuation not found.")

    vr = analysis.valuation_result or {}
    rpt = await db.execute(
        select(Report).where(Report.analysis_id == analysis.id).order_by(Report.created_at.desc()).limit(1)
    )
    report = rpt.scalar_one_or_none()
    report_url = None
    if report and report.download_token:
        from app.core.config import settings
        report_url = f"{settings.APP_URL}/api/v1/reports/download?token={report.download_token}"

    data = {
        "id": str(analysis.id),
        "status": analysis.status.value if analysis.status else "unknown",
        "valuation_min": vr.get("valuation_min"),
        "valuation_max": vr.get("valuation_max"),
        "valuation_average": vr.get("valuation_average"),
        "risk_score": analysis.risk_score,
        "payment_status": None,
        "report_url": report_url,
    }
    return _envelope(request, data)


# ═══════════════════════════════════════════════════════════
# PITCH DECKS
# ═══════════════════════════════════════════════════════════

@router.get("/pitch-decks")
async def list_pitch_decks(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    created_after: Optional[str] = Query(None),
    created_before: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    after: Optional[str] = Query(None),
    ctx: OAuthContext = Depends(require_scope("read:pitch_decks")),
    db: AsyncSession = Depends(get_db),
):
    """List pitch decks with filters, sorting, cursor pagination."""
    user = ctx.user
    filters = [PitchDeck.user_id == user.id, PitchDeck.deleted_at.is_(None)]

    if status:
        try:
            filters.append(PitchDeck.status == PitchDeckStatus(status))
        except ValueError:
            raise HTTPException(400, f"Invalid status: {status}")

    if created_after:
        try:
            filters.append(PitchDeck.created_at >= datetime.fromisoformat(created_after.replace("Z", "+00:00")))
        except ValueError:
            raise HTTPException(400, "Invalid created_after")

    if created_before:
        try:
            filters.append(PitchDeck.created_at <= datetime.fromisoformat(created_before.replace("Z", "+00:00")))
        except ValueError:
            raise HTTPException(400, "Invalid created_before")

    if after:
        try:
            cr = await db.execute(select(PitchDeck.created_at).where(PitchDeck.id == _UUID(after)))
            cursor_ts = cr.scalar_one_or_none()
            if cursor_ts:
                filters.append(
                    PitchDeck.created_at < cursor_ts if sort_order == "desc" else PitchDeck.created_at > cursor_ts
                )
        except Exception:
            pass

    count_result = await db.execute(
        select(func.count(PitchDeck.id)).where(PitchDeck.user_id == user.id, PitchDeck.deleted_at.is_(None))
    )
    total = count_result.scalar() or 0

    sort_col = PitchDeck.company_name if sort_by == "company_name" else PitchDeck.created_at
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()
    offset = (page - 1) * page_size if not after else 0

    result = await db.execute(
        select(PitchDeck).where(*filters).order_by(order).offset(offset).limit(page_size)
    )
    decks = result.scalars().all()

    items = [
        {
            "id": str(d.id),
            "company_name": d.company_name,
            "status": d.status.value if d.status else None,
            "theme": d.theme,
            "investor_type": d.investor_type,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in decks
    ]

    next_cursor = str(decks[-1].id) if decks and len(decks) == page_size else None
    return _paginated(request, items, total, page, page_size, next_cursor)


@router.get("/pitch-decks/{pitch_deck_id}")
async def get_pitch_deck(
    pitch_deck_id: str,
    request: Request,
    ctx: OAuthContext = Depends(require_scope("read:pitch_decks")),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific pitch deck."""
    user = ctx.user
    result = await db.execute(
        select(PitchDeck).where(
            PitchDeck.id == _UUID(pitch_deck_id),
            PitchDeck.user_id == user.id,
            PitchDeck.deleted_at.is_(None),
        )
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(404, "Pitch Deck not found.")

    data = {
        "id": str(deck.id),
        "company_name": deck.company_name,
        "sector": deck.sector,
        "status": deck.status.value if deck.status else None,
        "theme": deck.theme,
        "investor_type": deck.investor_type,
        "headline": deck.headline,
        "problem": deck.problem,
        "solution": deck.solution,
        "team": deck.team,
        "milestones": deck.milestones,
        "created_at": deck.created_at.isoformat() if deck.created_at else None,
    }
    return _envelope(request, data)


@router.post("/pitch-decks", status_code=201)
async def create_pitch_deck(
    data: PublicPitchDeckCreate,
    request: Request,
    ctx: OAuthContext = Depends(require_scope("write:pitch_decks")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new pitch deck via the API. Payment required before AI generation."""
    user = ctx.user
    deck = PitchDeck(
        user_id=user.id,
        company_name=data.company_name,
        sector=data.sector or "Other",
        theme=data.theme,
        investor_type=data.investor_type,
        status=PitchDeckStatus.DRAFT,
    )
    db.add(deck)
    await db.commit()
    await db.refresh(deck)

    from app.core.config import settings
    payment_url = f"{settings.FRONTEND_URL}/pitch-deck/{deck.id}?pay=true"

    resp_data = {
        "id": str(deck.id),
        "company_name": deck.company_name,
        "status": "draft",
        "theme": data.theme,
        "payment_url": payment_url,
        "message": "Pitch Deck created. Redirect the user to payment_url.",
        "created_at": deck.created_at.isoformat(),
    }
    return _envelope(request, resp_data, status_code=201)


# ═══════════════════════════════════════════════════════════
# BATCH ENDPOINT
# ═══════════════════════════════════════════════════════════

@router.post("/batch")
async def batch_requests(
    request: Request,
    ctx: OAuthContext = Depends(get_oauth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute multiple read operations in a single HTTP request.
    Body: { "requests": [{"method": "GET", "path": "/valuations/uuid"}, ...] }
    Max 20 sub-requests.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body.")

    sub_requests = body.get("requests", [])
    if not sub_requests or not isinstance(sub_requests, list):
        raise HTTPException(400, "'requests' must be a non-empty list.")
    if len(sub_requests) > 20:
        raise HTTPException(400, "Maximum 20 operations per batch.")

    results = []
    for i, sub in enumerate(sub_requests):
        method = sub.get("method", "GET").upper()
        path = sub.get("path", "")

        if not path:
            results.append({"index": i, "status": 400, "data": None, "error": "path required"})
            continue
        if method != "GET":
            results.append({"index": i, "status": 405, "data": None, "error": "Batch only supports GET"})
            continue

        try:
            result_data = None
            if path.startswith("/valuations/") and "/status" in path:
                vid = path.split("/valuations/")[1].replace("/status", "")
                a = (await db.execute(
                    select(Analysis).where(Analysis.id == _UUID(vid), Analysis.user_id == ctx.user.id)
                )).scalar_one_or_none()
                if not a:
                    raise HTTPException(404, "Not found")
                vr = a.valuation_result or {}
                result_data = {"id": str(a.id), "status": a.status.value if a.status else "unknown", "valuation_average": vr.get("valuation_average")}
            elif path.startswith("/valuations/"):
                vid = path.split("/valuations/")[1]
                a = (await db.execute(
                    select(Analysis).where(Analysis.id == _UUID(vid), Analysis.user_id == ctx.user.id, Analysis.deleted_at.is_(None))
                )).scalar_one_or_none()
                if not a:
                    raise HTTPException(404, "Not found")
                result_data = {"id": str(a.id), "company_name": a.company_name, "status": a.status.value if a.status else None, "equity_value": float(a.equity_value) if a.equity_value else None}
            elif path.startswith("/pitch-decks/"):
                pid = path.split("/pitch-decks/")[1]
                d = (await db.execute(
                    select(PitchDeck).where(PitchDeck.id == _UUID(pid), PitchDeck.user_id == ctx.user.id, PitchDeck.deleted_at.is_(None))
                )).scalar_one_or_none()
                if not d:
                    raise HTTPException(404, "Not found")
                result_data = {"id": str(d.id), "company_name": d.company_name, "status": d.status.value if d.status else None, "theme": d.theme}
            elif path == "/user/me":
                result_data = {"id": str(ctx.user.id), "email": ctx.user.email, "full_name": ctx.user.full_name}
            else:
                results.append({"index": i, "status": 404, "data": None, "error": "Path not supported"})
                continue
            results.append({"index": i, "status": 200, "data": result_data, "error": None})
        except HTTPException as he:
            results.append({"index": i, "status": he.status_code, "data": None, "error": he.detail})
        except Exception as e:
            results.append({"index": i, "status": 500, "data": None, "error": str(e)})

    return _envelope(request, results)


# ═══════════════════════════════════════════════════════════
# PUBLIC ENDPOINTS (no auth required)
# ═══════════════════════════════════════════════════════════

@router.get("/health")
async def api_health(request: Request):
    """Public health check — no auth required."""
    checks = {"api": "healthy", "version": API_VERSION}
    healthy = True

    try:
        from app.core.database import async_session_maker
        start = time.time()
        async with async_session_maker() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "healthy"
        checks["db_latency_ms"] = int((time.time() - start) * 1000)
    except Exception as e:
        checks["database"] = f"unhealthy: {e!r}"
        healthy = False

    try:
        from app.core.redis import redis_client
        await redis_client.ping()
        checks["redis"] = "healthy"
    except Exception as e:
        checks["redis"] = f"unhealthy: {e!r}"
        healthy = False

    return JSONResponse(
        content={"status": "healthy" if healthy else "degraded", **checks},
        status_code=200 if healthy else 503,
    )


@router.get("/changelog")
async def api_changelog(request: Request):
    """API changelog — structured list of changes per version."""
    changelog = [
        {
            "version": "2025-01-15",
            "date": "2025-01-15",
            "changes": [
                "Initial release of Valuora Public API v1",
                "OAuth2 Authorization Code + PKCE + client_credentials",
                "Endpoints: plans, user/me, valuations (CRUD), pitch-decks (CRUD)",
                "Standard envelope { data, meta, pagination }",
                "Headers: X-Request-Id, X-RateLimit-*, API-Version, ETag",
                "Filters, sorting, cursor-based pagination",
                "POST /batch for multiple read operations",
                "GET /health, GET /changelog (no auth)",
                "Webhooks for OAuth apps: valuation.completed, pitch_deck.ready",
                "JavaScript SDK: /sdk/valuora.js",
                "Python SDK: /sdk/valuora.py",
            ],
        },
    ]
    return _envelope(request, changelog)


@router.get("/info")
async def api_info(request: Request):
    """Public info about the API — no auth required."""
    data = {
        "name": "Valuora Public API",
        "version": API_VERSION,
        "description": "Public API for integrating with the Valuora business valuation platform.",
        "documentation": "/api/v1/public/docs",
        "health": "/api/v1/public/health",
        "changelog": "/api/v1/public/changelog",
        "postman_collection": "/api/v1/public/postman",
        "oauth": {
            "authorize_url": "/api/v1/oauth/authorize",
            "token_url": "/api/v1/oauth/token",
            "revoke_url": "/api/v1/oauth/revoke",
            "scopes_url": "/api/v1/oauth/scopes",
        },
        "sdks": {
            "javascript": "/sdk/valuora.js",
            "python": "/sdk/valuora.py",
        },
        "endpoints": {
            "plans": "GET /api/v1/public/plans",
            "user_info": "GET /api/v1/public/user/me",
            "valuations": {
                "list": "GET /api/v1/public/valuations",
                "get": "GET /api/v1/public/valuations/{id}",
                "create": "POST /api/v1/public/valuations",
                "status": "GET /api/v1/public/valuations/{id}/status",
            },
            "pitch_decks": {
                "list": "GET /api/v1/public/pitch-decks",
                "get": "GET /api/v1/public/pitch-decks/{id}",
                "create": "POST /api/v1/public/pitch-decks",
            },
            "batch": "POST /api/v1/public/batch",
            "health": "GET /api/v1/public/health",
            "changelog": "GET /api/v1/public/changelog",
        },
        "headers": {
            "X-Request-Id": "Correlation ID - send your own or auto-generated",
            "API-Version": f"Date-based version (current: {API_VERSION})",
            "X-RateLimit-Limit": "Max requests per window",
            "X-RateLimit-Remaining": "Remaining requests",
            "X-RateLimit-Reset": "Unix timestamp when window resets",
            "ETag": "Content hash for conditional requests (If-None-Match)",
        },
    }
    return _envelope(request, data)


@router.get("/docs", response_class=HTMLResponse)
async def api_docs_page():
    """Interactive API documentation — Swagger UI for the Public API."""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Valuora API Docs</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
        body { margin: 0; background: #fafafa; }
        .topbar { display: none !important; }
        .swagger-ui .info .title { color: #059669; }
        .swagger-ui .btn.authorize { background: #059669; border-color: #059669; }
        .swagger-ui .btn.authorize:hover { background: #047857; }
        .header-bar {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white; padding: 20px 40px; font-family: system-ui;
        }
        .header-bar h1 { margin: 0; font-size: 24px; }
        .header-bar p { margin: 5px 0 0; opacity: 0.9; font-size: 14px; }
        .header-bar a { color: #d1fae5; }
    </style>
</head>
<body>
    <div class="header-bar">
        <h1>Valuora API Docs</h1>
        <p>
            Interactive documentation |
            <a href="/api/v1/public/info">Info</a> |
            <a href="/api/v1/public/health">Health</a> |
            <a href="/api/v1/public/changelog">Changelog</a> |
            <a href="/api/v1/public/postman">Postman Collection</a>
        </p>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/openapi.json',
            dom_id: '#swagger-ui',
            filter: true,
            tagsSorter: 'alpha',
            operationsSorter: 'alpha',
            docExpansion: 'list',
            defaultModelsExpandDepth: -1,
            persistAuthorization: true,
            displayRequestDuration: true,
        });
    </script>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.get("/postman")
async def postman_collection(request: Request):
    """Download a Postman Collection pre-configured with all API endpoints."""
    from app.core.config import settings
    base = settings.APP_URL

    collection = {
        "info": {
            "name": "Valuora API v1",
            "_postman_id": "valuora-api-v1",
            "description": "Postman Collection for the Valuora Public API.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "auth": {
            "type": "bearer",
            "bearer": [{"key": "token", "value": "{{access_token}}", "type": "string"}],
        },
        "variable": [
            {"key": "base_url", "value": base + "/api/v1", "type": "string"},
            {"key": "client_id", "value": "YOUR_CLIENT_ID", "type": "string"},
            {"key": "client_secret", "value": "YOUR_CLIENT_SECRET", "type": "string"},
            {"key": "access_token", "value": "", "type": "string"},
        ],
        "item": [
            {
                "name": "Auth",
                "item": [
                    {
                        "name": "Get Token (client_credentials)",
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "body": {"mode": "raw", "raw": '{"grant_type":"client_credentials","client_id":"{{client_id}}","client_secret":"{{client_secret}}"}'},
                            "url": {"raw": "{{base_url}}/oauth/token"},
                        },
                    },
                ],
            },
            {
                "name": "Plans",
                "item": [
                    {"name": "List Plans", "request": {"method": "GET", "url": {"raw": "{{base_url}}/public/plans"}}},
                ],
            },
            {
                "name": "User",
                "item": [
                    {"name": "Get My Info", "request": {"method": "GET", "url": {"raw": "{{base_url}}/public/user/me"}}},
                ],
            },
            {
                "name": "Valuations",
                "item": [
                    {"name": "List Valuations", "request": {"method": "GET", "url": {"raw": "{{base_url}}/public/valuations?page=1&page_size=20"}}},
                    {"name": "Get Valuation", "request": {"method": "GET", "url": {"raw": "{{base_url}}/public/valuations/{{valuation_id}}"}}},
                    {"name": "Create Valuation", "request": {"method": "POST", "header": [{"key": "Content-Type", "value": "application/json"}], "body": {"mode": "raw", "raw": '{"company_name":"Example Corp","plan":"professional","annual_revenue":5000000,"annual_costs":3000000,"annual_expenses":800000,"sector":"Technology"}'}, "url": {"raw": "{{base_url}}/public/valuations"}}},
                    {"name": "Check Status", "request": {"method": "GET", "url": {"raw": "{{base_url}}/public/valuations/{{valuation_id}}/status"}}},
                ],
            },
            {
                "name": "Pitch Decks",
                "item": [
                    {"name": "List Pitch Decks", "request": {"method": "GET", "url": {"raw": "{{base_url}}/public/pitch-decks"}}},
                    {"name": "Get Pitch Deck", "request": {"method": "GET", "url": {"raw": "{{base_url}}/public/pitch-decks/{{pitch_deck_id}}"}}},
                    {"name": "Create Pitch Deck", "request": {"method": "POST", "header": [{"key": "Content-Type", "value": "application/json"}], "body": {"mode": "raw", "raw": '{"company_name":"Startup XYZ","theme":"startup","investor_type":"angel","sector":"Technology"}'}, "url": {"raw": "{{base_url}}/public/pitch-decks"}}},
                ],
            },
            {
                "name": "Batch",
                "item": [
                    {"name": "Batch Request", "request": {"method": "POST", "header": [{"key": "Content-Type", "value": "application/json"}], "body": {"mode": "raw", "raw": '{"requests":[{"method":"GET","path":"/user/me"},{"method":"GET","path":"/valuations/UUID"}]}'}, "url": {"raw": "{{base_url}}/public/batch"}}},
                ],
            },
            {
                "name": "Meta",
                "item": [
                    {"name": "API Info", "request": {"method": "GET", "url": {"raw": "{{base_url}}/public/info"}}},
                    {"name": "API Health", "request": {"method": "GET", "url": {"raw": "{{base_url}}/public/health"}}},
                    {"name": "Changelog", "request": {"method": "GET", "url": {"raw": "{{base_url}}/public/changelog"}}},
                ],
            },
        ],
    }

    return JSONResponse(
        content=collection,
        headers={
            "Content-Disposition": "attachment; filename=valuora-api-v1.postman_collection.json",
            "Content-Type": "application/json",
        },
    )
