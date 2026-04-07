"""OAuth2 provider routes — authorization, token exchange, revocation, app management."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.models.models import User, OAuthApp
from app.services.auth_service import get_current_user
from app.services.oauth_service import (
    create_oauth_app,
    get_oauth_app_by_client_id,
    verify_client_credentials,
    list_user_apps,
    update_oauth_app,
    delete_oauth_app,
    regenerate_client_secret,
    create_authorization_code,
    exchange_authorization_code,
    refresh_oauth_token,
    revoke_token,
    get_app_usage_stats,
)
from app.schemas.oauth import (
    OAuthAppCreate,
    OAuthAppUpdate,
    OAuthAppResponse,
    OAuthAppCreatedResponse,
    OAuthAuthorizeApproval,
    OAuthTokenRequest,
    OAuthTokenResponse,
    OAuthRevokeRequest,
    OAuthConsentInfo,
    APIUsageStats,
    AVAILABLE_SCOPES,
    SCOPE_DESCRIPTIONS,
)

router = APIRouter(prefix="/oauth", tags=["OAuth2 / Integration"])


# ═══════════════════════════════════════════════════════════
# APP MANAGEMENT (Developer Portal)
# ═══════════════════════════════════════════════════════════

@router.get("/apps", response_model=list[OAuthAppResponse])
async def list_my_apps(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all OAuth apps owned by the current user."""
    apps = await list_user_apps(db, current_user.id)
    return apps


@router.post("/apps", response_model=OAuthAppCreatedResponse, status_code=201)
async def create_app(
    data: OAuthAppCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new OAuth application. Returns client_id and client_secret (secret shown ONLY once)."""
    invalid = [s for s in data.scopes if s not in AVAILABLE_SCOPES]
    if invalid:
        raise HTTPException(400, f"Invalid scopes: {', '.join(invalid)}")

    for uri in data.redirect_uris:
        if not uri.startswith("http://") and not uri.startswith("https://"):
            raise HTTPException(400, f"Invalid redirect_uri (must be http/https): {uri}")

    app, client_secret = await create_oauth_app(
        db=db, user=current_user, name=data.name,
        redirect_uris=data.redirect_uris, description=data.description,
        website_url=data.website_url, logo_url=data.logo_url, scopes=data.scopes,
    )

    return OAuthAppCreatedResponse(
        **OAuthAppResponse.model_validate(app).model_dump(),
        client_secret=client_secret,
    )


@router.get("/apps/{app_id}", response_model=OAuthAppResponse)
async def get_app(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details of an OAuth app."""
    from uuid import UUID as _UUID
    from sqlalchemy import select
    result = await db.execute(
        select(OAuthApp).where(OAuthApp.id == _UUID(app_id), OAuthApp.user_id == current_user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "Application not found.")
    return app


@router.patch("/apps/{app_id}", response_model=OAuthAppResponse)
async def update_app(
    app_id: str,
    data: OAuthAppUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an OAuth app's settings."""
    from uuid import UUID as _UUID
    from sqlalchemy import select
    result = await db.execute(
        select(OAuthApp).where(OAuthApp.id == _UUID(app_id), OAuthApp.user_id == current_user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "Application not found.")

    if data.scopes:
        invalid = [s for s in data.scopes if s not in AVAILABLE_SCOPES]
        if invalid:
            raise HTTPException(400, f"Invalid scopes: {', '.join(invalid)}")

    update_fields = data.model_dump(exclude_unset=True)
    app = await update_oauth_app(db, app, **update_fields)
    return app


@router.delete("/apps/{app_id}", status_code=204)
async def remove_app(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an OAuth app and all its tokens."""
    from uuid import UUID as _UUID
    from sqlalchemy import select
    result = await db.execute(
        select(OAuthApp).where(OAuthApp.id == _UUID(app_id), OAuthApp.user_id == current_user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "Application not found.")
    await delete_oauth_app(db, app)


@router.post("/apps/{app_id}/regenerate-secret")
async def regenerate_secret(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate client_secret. The old secret is immediately invalidated."""
    from uuid import UUID as _UUID
    from sqlalchemy import select
    result = await db.execute(
        select(OAuthApp).where(OAuthApp.id == _UUID(app_id), OAuthApp.user_id == current_user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "Application not found.")
    new_secret = await regenerate_client_secret(db, app)
    return {"client_secret": new_secret, "message": "Secret regenerated. Update your integrations."}


@router.get("/apps/{app_id}/usage", response_model=APIUsageStats)
async def get_app_usage(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get API usage stats for an OAuth app."""
    from uuid import UUID as _UUID
    from sqlalchemy import select
    result = await db.execute(
        select(OAuthApp).where(OAuthApp.id == _UUID(app_id), OAuthApp.user_id == current_user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "Application not found.")

    stats = await get_app_usage_stats(db, app.id)
    return APIUsageStats(
        app_id=app.id, app_name=app.name,
        remaining_daily_quota=max(0, app.rate_limit_per_day - stats["total_requests_today"]),
        rate_limit_per_minute=app.rate_limit_per_minute,
        rate_limit_per_day=app.rate_limit_per_day,
        daily_quota=app.rate_limit_per_day,
        **stats,
    )


# ═══════════════════════════════════════════════════════════
# OAUTH2 AUTHORIZATION CODE FLOW
# ═══════════════════════════════════════════════════════════

@router.get("/authorize")
async def authorize_info(
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    response_type: str = Query("code"),
    scope: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """GET /oauth/authorize — returns info for the consent screen."""
    if response_type != "code":
        raise HTTPException(400, "response_type must be 'code'.")

    app = await get_oauth_app_by_client_id(db, client_id)
    if not app:
        raise HTTPException(400, "Invalid client_id or application disabled.")

    if redirect_uri not in app.redirect_uris:
        raise HTTPException(400, "redirect_uri not registered for this application.")

    requested_scopes = scope.split(" ") if scope else app.scopes
    invalid = [s for s in requested_scopes if s not in AVAILABLE_SCOPES]
    if invalid:
        raise HTTPException(400, f"Invalid scopes: {', '.join(invalid)}")

    allowed_scopes = [s for s in requested_scopes if s in app.scopes]

    return OAuthConsentInfo(
        app_name=app.name, app_description=app.description,
        app_logo_url=app.logo_url, app_website_url=app.website_url,
        requested_scopes=[
            {"scope": s, "description": SCOPE_DESCRIPTIONS.get(s, s)} for s in allowed_scopes
        ],
        redirect_uri=redirect_uri, state=state,
    )


@router.post("/authorize")
async def authorize_approve(
    data: OAuthAuthorizeApproval,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """POST /oauth/authorize — user approves access. Returns the authorization code."""
    app = await get_oauth_app_by_client_id(db, data.client_id)
    if not app:
        raise HTTPException(400, "Invalid client_id.")

    if data.redirect_uri not in app.redirect_uris:
        raise HTTPException(400, "redirect_uri not registered.")

    allowed_scopes = [s for s in data.scopes if s in app.scopes and s in AVAILABLE_SCOPES]

    code = await create_authorization_code(
        db=db, app=app, user=current_user, redirect_uri=data.redirect_uri,
        scopes=allowed_scopes, state=data.state,
        code_challenge=data.code_challenge, code_challenge_method=data.code_challenge_method,
    )

    redirect_url = data.redirect_uri
    separator = "&" if "?" in redirect_url else "?"
    redirect_url += f"{separator}code={code}"
    if data.state:
        redirect_url += f"&state={data.state}"

    return {"redirect_url": redirect_url, "code": code, "state": data.state}


@router.post("/token", response_model=OAuthTokenResponse)
async def exchange_token(
    data: OAuthTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """POST /oauth/token — exchange authorization code or refresh token for access tokens."""
    app = await verify_client_credentials(db, data.client_id, data.client_secret)
    if not app:
        raise HTTPException(401, "Invalid client_id or client_secret.")

    if data.grant_type == "authorization_code":
        if not data.code:
            raise HTTPException(400, "code is required for grant_type=authorization_code.")
        if not data.redirect_uri:
            raise HTTPException(400, "redirect_uri is required.")

        try:
            access_token, refresh_token, expires_in, scopes = await exchange_authorization_code(
                db=db, app=app, code=data.code,
                redirect_uri=data.redirect_uri, code_verifier=data.code_verifier,
            )
        except ValueError as e:
            raise HTTPException(400, str(e))

        return OAuthTokenResponse(
            access_token=access_token, expires_in=expires_in,
            refresh_token=refresh_token, scope=" ".join(scopes),
        )

    elif data.grant_type == "refresh_token":
        if not data.refresh_token:
            raise HTTPException(400, "refresh_token is required.")

        try:
            access_token, refresh_token, expires_in, scopes = await refresh_oauth_token(
                db=db, app=app, refresh_token=data.refresh_token,
            )
        except ValueError as e:
            raise HTTPException(400, str(e))

        return OAuthTokenResponse(
            access_token=access_token, expires_in=expires_in,
            refresh_token=refresh_token, scope=" ".join(scopes),
        )

    elif data.grant_type == "client_credentials":
        from app.services.oauth_service import _generate_token, _hash_token, OAUTH_ACCESS_TOKEN_EXPIRE_MINUTES
        from app.models.models import OAuthToken
        from datetime import datetime, timedelta, timezone

        CC_SCOPES = ["read:plans", "read:valuations", "read:pitch_decks", "read:user"]
        access_token = _generate_token()
        expires_in = OAUTH_ACCESS_TOKEN_EXPIRE_MINUTES * 60

        token_record = OAuthToken(
            app_id=app.id, user_id=app.user_id,
            access_token_hash=_hash_token(access_token),
            scopes=CC_SCOPES,
            access_token_expires_at=datetime.now(timezone.utc) + timedelta(minutes=OAUTH_ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        db.add(token_record)
        await db.commit()

        return OAuthTokenResponse(
            access_token=access_token, expires_in=expires_in, scope=" ".join(CC_SCOPES),
        )

    raise HTTPException(400, "Invalid grant_type.")


@router.post("/revoke")
async def revoke(
    data: OAuthRevokeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Revoke an access or refresh token."""
    app = await verify_client_credentials(db, data.client_id, data.client_secret)
    if not app:
        raise HTTPException(401, "Invalid client_id or client_secret.")

    await revoke_token(db, app, data.token)
    return {"message": "Token revoked successfully."}


@router.get("/scopes")
async def list_scopes():
    """List all available OAuth scopes and their descriptions."""
    return [
        {"scope": s, "description": SCOPE_DESCRIPTIONS.get(s, s)}
        for s in AVAILABLE_SCOPES
    ]
