"""OAuth2 service — handles authorization codes, token exchange, and app management."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.models import (
    OAuthApp, OAuthAuthorizationCode, OAuthToken, APIUsageLog, User,
)

# ─── Constants ────────────────────────────────────────────
OAUTH_ACCESS_TOKEN_EXPIRE_MINUTES = 60
OAUTH_REFRESH_TOKEN_EXPIRE_DAYS = 30
AUTHORIZATION_CODE_EXPIRE_MINUTES = 10


def _generate_client_id() -> str:
    """Generate a unique client_id like 'vl_abc123...'."""
    return f"vl_{secrets.token_urlsafe(32)}"


def _generate_client_secret() -> str:
    """Generate a secure client secret."""
    return f"vls_{secrets.token_urlsafe(48)}"


def _generate_auth_code() -> str:
    """Generate short-lived authorization code."""
    return secrets.token_urlsafe(64)


def _generate_token() -> str:
    """Generate an opaque access/refresh token."""
    return secrets.token_urlsafe(48)


def _hash_token(token: str) -> str:
    """SHA-256 hash for token storage."""
    return hashlib.sha256(token.encode()).hexdigest()


# ─── App Management ───────────────────────────────────────
async def create_oauth_app(
    db: AsyncSession,
    user: User,
    name: str,
    redirect_uris: List[str],
    description: Optional[str] = None,
    website_url: Optional[str] = None,
    logo_url: Optional[str] = None,
    scopes: Optional[List[str]] = None,
) -> Tuple[OAuthApp, str]:
    """Create a new OAuth app. Returns (app, plain_client_secret)."""
    client_id = _generate_client_id()
    client_secret = _generate_client_secret()

    app = OAuthApp(
        user_id=user.id,
        name=name,
        description=description,
        website_url=website_url,
        logo_url=logo_url,
        client_id=client_id,
        client_secret_hash=hash_password(client_secret),
        redirect_uris=redirect_uris,
        scopes=scopes or [
            "read:user", "read:valuations", "write:valuations",
            "read:pitch_decks", "write:pitch_decks", "read:plans",
        ],
        is_first_party=(user.is_admin or user.is_superadmin),
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return app, client_secret


async def get_oauth_app_by_client_id(db: AsyncSession, client_id: str) -> Optional[OAuthApp]:
    result = await db.execute(
        select(OAuthApp).where(OAuthApp.client_id == client_id, OAuthApp.is_active == True)
    )
    return result.scalar_one_or_none()


async def verify_client_credentials(db: AsyncSession, client_id: str, client_secret: str) -> Optional[OAuthApp]:
    """Verify client_id + client_secret and return the app."""
    app = await get_oauth_app_by_client_id(db, client_id)
    if not app:
        return None
    if not verify_password(client_secret, app.client_secret_hash):
        return None
    return app


async def list_user_apps(db: AsyncSession, user_id: UUID) -> List[OAuthApp]:
    result = await db.execute(
        select(OAuthApp).where(OAuthApp.user_id == user_id).order_by(OAuthApp.created_at.desc())
    )
    return list(result.scalars().all())


async def update_oauth_app(db: AsyncSession, app: OAuthApp, **kwargs) -> OAuthApp:
    for key, value in kwargs.items():
        if value is not None and hasattr(app, key):
            setattr(app, key, value)
    await db.commit()
    await db.refresh(app)
    return app


async def delete_oauth_app(db: AsyncSession, app: OAuthApp):
    await db.delete(app)
    await db.commit()


async def regenerate_client_secret(db: AsyncSession, app: OAuthApp) -> str:
    """Regenerate client secret — old one is invalidated."""
    new_secret = _generate_client_secret()
    app.client_secret_hash = hash_password(new_secret)
    await db.commit()
    return new_secret


# ─── Authorization Code Flow ─────────────────────────────
async def create_authorization_code(
    db: AsyncSession,
    app: OAuthApp,
    user: User,
    redirect_uri: str,
    scopes: List[str],
    state: Optional[str] = None,
    code_challenge: Optional[str] = None,
    code_challenge_method: Optional[str] = None,
) -> str:
    """Create a short-lived authorization code for the OAuth2 flow."""
    code = _generate_auth_code()
    auth_code = OAuthAuthorizationCode(
        code=code,
        app_id=app.id,
        user_id=user.id,
        redirect_uri=redirect_uri,
        scopes=scopes,
        state=state,
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=AUTHORIZATION_CODE_EXPIRE_MINUTES),
    )
    db.add(auth_code)
    await db.commit()
    return code


async def exchange_authorization_code(
    db: AsyncSession,
    app: OAuthApp,
    code: str,
    redirect_uri: str,
    code_verifier: Optional[str] = None,
) -> Tuple[str, str, int, List[str]]:
    """Exchange auth code for tokens. Returns (access_token, refresh_token, expires_in, scopes)."""
    result = await db.execute(
        select(OAuthAuthorizationCode).where(
            OAuthAuthorizationCode.code == code,
            OAuthAuthorizationCode.app_id == app.id,
            OAuthAuthorizationCode.is_used == False,
        )
    )
    auth_code = result.scalar_one_or_none()

    if not auth_code:
        raise ValueError("Invalid or already used authorization code.")

    if auth_code.expires_at < datetime.now(timezone.utc):
        raise ValueError("Authorization code expired.")

    if auth_code.redirect_uri != redirect_uri:
        raise ValueError("redirect_uri mismatch.")

    # PKCE verification
    if auth_code.code_challenge:
        if not code_verifier:
            raise ValueError("code_verifier is required for PKCE.")
        if auth_code.code_challenge_method == "S256":
            import base64
            expected = base64.urlsafe_b64encode(
                hashlib.sha256(code_verifier.encode()).digest()
            ).rstrip(b"=").decode()
            if expected != auth_code.code_challenge:
                raise ValueError("Invalid code_verifier.")
        elif auth_code.code_challenge_method == "plain":
            if code_verifier != auth_code.code_challenge:
                raise ValueError("Invalid code_verifier.")

    # Mark code as used
    auth_code.is_used = True

    # Generate tokens
    access_token = _generate_token()
    refresh_token = _generate_token()
    expires_in = OAUTH_ACCESS_TOKEN_EXPIRE_MINUTES * 60

    token_record = OAuthToken(
        app_id=app.id,
        user_id=auth_code.user_id,
        access_token_hash=_hash_token(access_token),
        refresh_token_hash=_hash_token(refresh_token),
        scopes=auth_code.scopes,
        access_token_expires_at=datetime.now(timezone.utc) + timedelta(minutes=OAUTH_ACCESS_TOKEN_EXPIRE_MINUTES),
        refresh_token_expires_at=datetime.now(timezone.utc) + timedelta(days=OAUTH_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(token_record)
    await db.commit()

    return access_token, refresh_token, expires_in, auth_code.scopes


async def refresh_oauth_token(
    db: AsyncSession,
    app: OAuthApp,
    refresh_token: str,
) -> Tuple[str, str, int, List[str]]:
    """Refresh an OAuth access token. Returns (new_access, new_refresh, expires_in, scopes)."""
    token_hash = _hash_token(refresh_token)
    result = await db.execute(
        select(OAuthToken).where(
            OAuthToken.refresh_token_hash == token_hash,
            OAuthToken.app_id == app.id,
            OAuthToken.is_revoked == False,
        )
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        raise ValueError("Invalid or revoked refresh token.")

    if token_record.refresh_token_expires_at < datetime.now(timezone.utc):
        raise ValueError("Refresh token expired.")

    # Revoke old token pair
    token_record.is_revoked = True

    # Generate new token pair
    new_access = _generate_token()
    new_refresh = _generate_token()
    expires_in = OAUTH_ACCESS_TOKEN_EXPIRE_MINUTES * 60

    new_token_record = OAuthToken(
        app_id=app.id,
        user_id=token_record.user_id,
        access_token_hash=_hash_token(new_access),
        refresh_token_hash=_hash_token(new_refresh),
        scopes=token_record.scopes,
        access_token_expires_at=datetime.now(timezone.utc) + timedelta(minutes=OAUTH_ACCESS_TOKEN_EXPIRE_MINUTES),
        refresh_token_expires_at=datetime.now(timezone.utc) + timedelta(days=OAUTH_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_token_record)
    await db.commit()

    return new_access, new_refresh, expires_in, token_record.scopes


async def revoke_token(db: AsyncSession, app: OAuthApp, token: str):
    """Revoke an access or refresh token."""
    token_hash = _hash_token(token)
    result = await db.execute(
        select(OAuthToken).where(
            OAuthToken.access_token_hash == token_hash,
            OAuthToken.app_id == app.id,
        )
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        result = await db.execute(
            select(OAuthToken).where(
                OAuthToken.refresh_token_hash == token_hash,
                OAuthToken.app_id == app.id,
            )
        )
        token_record = result.scalar_one_or_none()

    if token_record:
        token_record.is_revoked = True
        await db.commit()


# ─── Token Validation (for API middleware) ────────────────
async def validate_access_token(db: AsyncSession, token: str) -> Optional[Tuple[OAuthToken, User]]:
    """Validate an OAuth access token and return the token record + user."""
    token_hash = _hash_token(token)
    result = await db.execute(
        select(OAuthToken).where(
            OAuthToken.access_token_hash == token_hash,
            OAuthToken.is_revoked == False,
        )
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        return None

    if token_record.access_token_expires_at < datetime.now(timezone.utc):
        return None

    user_result = await db.execute(
        select(User).where(User.id == token_record.user_id, User.is_active == True)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        return None

    return token_record, user


# ─── API Usage Logging ────────────────────────────────────
async def log_api_usage(
    db: AsyncSession,
    app_id: UUID,
    endpoint: str,
    method: str,
    status_code: Optional[int] = None,
    response_time_ms: Optional[int] = None,
    user_id: Optional[UUID] = None,
    ip: Optional[str] = None,
):
    log = APIUsageLog(
        app_id=app_id,
        user_id=user_id,
        endpoint=endpoint,
        method=method,
        status_code=status_code,
        response_time_ms=response_time_ms,
        ip=ip,
    )
    db.add(log)
    await db.commit()


async def get_app_usage_stats(db: AsyncSession, app_id: UUID) -> dict:
    """Get usage stats for an OAuth app."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    today_result = await db.execute(
        select(func.count(APIUsageLog.id)).where(
            APIUsageLog.app_id == app_id,
            APIUsageLog.created_at >= today_start,
        )
    )
    today_count = today_result.scalar() or 0

    month_result = await db.execute(
        select(func.count(APIUsageLog.id)).where(
            APIUsageLog.app_id == app_id,
            APIUsageLog.created_at >= month_start,
        )
    )
    month_count = month_result.scalar() or 0

    top_result = await db.execute(
        select(
            APIUsageLog.endpoint,
            APIUsageLog.method,
            func.count(APIUsageLog.id).label("count"),
        ).where(
            APIUsageLog.app_id == app_id,
            APIUsageLog.created_at >= month_start,
        ).group_by(APIUsageLog.endpoint, APIUsageLog.method)
        .order_by(func.count(APIUsageLog.id).desc())
        .limit(10)
    )
    top_endpoints = [
        {"endpoint": r.endpoint, "method": r.method, "count": r.count}
        for r in top_result.all()
    ]

    from datetime import timedelta
    seven_days_ago = now - timedelta(days=7)
    daily_result = await db.execute(
        select(
            func.date_trunc('day', APIUsageLog.created_at).label('day'),
            func.count(APIUsageLog.id).label('count'),
        ).where(
            APIUsageLog.app_id == app_id,
            APIUsageLog.created_at >= seven_days_ago,
        ).group_by(func.date_trunc('day', APIUsageLog.created_at))
        .order_by(func.date_trunc('day', APIUsageLog.created_at))
    )
    daily_usage = [
        {"date": str(r.day.date()) if r.day else None, "count": r.count}
        for r in daily_result.all()
    ]

    return {
        "total_requests_today": today_count,
        "total_requests_month": month_count,
        "top_endpoints": top_endpoints,
        "daily_usage": daily_usage,
    }
