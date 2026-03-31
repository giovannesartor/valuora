from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import json

from app.core.config import settings
from app.models import models  # noqa: F401 - ensure models are registered
from app.models import cnae as cnae_models  # noqa: F401 - ensure CNAE models are registered

# ─── Configure logging for all app.* loggers ──────────────
# Uvicorn only configures its own loggers; without this, app loggers
# silently drop INFO messages (only WARNING+ hits last-resort handler).
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s: %(message)s",
    stream=__import__("sys").stderr,
    force=True,
)
from app.routes import auth, analysis, payments, reports, admin, webhooks
from app.routes import cnae_routes, benchmark_routes, diagnostico
from app.routes import partner as partner_routes
from app.routes import partner_crm as partner_crm_routes
from app.routes import simulation as simulation_routes
from app.routes import notifications_routes
from app.routes import cnpj_routes
from app.routes import pitch_deck as pitch_deck_routes
from app.routes import roi_calculator as roi_calculator_routes

logger = logging.getLogger(__name__)

# ─── Redis-backed rate limiter ────────────────────────────
# Accurate across multiple workers — falls back to allow-all if Redis down.
RATE_LIMIT_WINDOW = 60   # seconds
RATE_LIMIT_MAX = 10      # general auth endpoints (register, refresh…)
RATE_LIMIT_LOGIN_MAX = 5 # login: tighter to prevent brute-force
RATE_LIMIT_DIAG_MAX = 5  # diagnostico
RATE_LIMIT_ANALYSIS_MAX = 10  # analyses creation


async def _check_rate_limit(key: str, max_requests: int = RATE_LIMIT_MAX) -> bool:
    """Redis fixed-window rate limiter. Allows request if Redis is unavailable."""
    from app.core.redis import redis_client
    redis_key = f"rl:{key}"
    try:
        current = await redis_client.incr(redis_key)
        if current == 1:
            await redis_client.expire(redis_key, RATE_LIMIT_WINDOW)
        return current <= max_requests
    except Exception as e:
        logger.warning(f"[RateLimit] Redis unavailable: {e!r} — skipping rate limit check")
        return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from pathlib import Path
    from app.core.database import init_db
    from app.services.auth_service import seed_admin_user, seed_test_partner
    Path(settings.REPORTS_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.UPLOADS_DIR).mkdir(parents=True, exist_ok=True)
    # Create tables if they don't exist
    await init_db()
    # Seed admin user
    await seed_admin_user()
    # Seed test partner (always — ensures test partner exists and stays in sync)
    await seed_test_partner()
    # Pre-fetch risk-free rate on startup (non-blocking: 5 s timeout, fallback on fail)
    try:
        import asyncio as _aio
        from app.core.valuation_engine.engine import fetch_risk_free_rate
        rf = await _aio.wait_for(fetch_risk_free_rate(), timeout=5.0)
        print(f"[STARTUP] Risk-free rate fetched: {rf*100:.2f}%")
    except Exception as e:
        print(f"[STARTUP] Risk-free rate fetch failed, using fallback: {e}")
    # Setup benchmark scheduler
    from app.tasks.benchmark_updater import setup_scheduler
    scheduler = setup_scheduler(app)
    yield
    # Shutdown
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="Valuora API",
    description="Global business valuation platform powered by DCF, Scorecard, VC Method & more.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — origins from env var
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global exception handler — ensures CORS headers on unhandled errors ──
from starlette.responses import JSONResponse as StarletteJSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"[UnhandledException] {request.method} {request.url.path}: {exc}", exc_info=True)
    origin = request.headers.get("origin", "")
    allowed = settings.get_cors_origins()
    resp = StarletteJSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )
    if origin and (origin in allowed or "*" in allowed):
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        resp.headers["Vary"] = "Origin"
    return resp


# ─── Rate limiting middleware ──────────────────────────────
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path
    origin = request.headers.get("origin", "")

    def _cors_response(status: int, detail: str) -> JSONResponse:
        """Return JSON response with CORS headers so browsers can read error details."""
        resp = JSONResponse(status_code=status, content={"detail": detail})
        allowed = settings.get_cors_origins()
        if origin and (origin in allowed or "*" in allowed):
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Access-Control-Allow-Credentials"] = "true"
            resp.headers["Vary"] = "Origin"
        return resp

    # Apply stricter rate limit to auth and diagnostico
    if path.startswith("/api/v1/auth/login"):
        if not await _check_rate_limit(f"login:{client_ip}", RATE_LIMIT_LOGIN_MAX):
            return _cors_response(429, "Too many login attempts. Please try again in 1 minute.")
    elif path.startswith("/api/v1/auth/"):
        if not await _check_rate_limit(f"auth:{client_ip}", RATE_LIMIT_MAX):
            return _cors_response(429, "Too many requests. Please try again in 1 minute.")
    elif path.startswith("/api/v1/diagnostico"):
        if not await _check_rate_limit(f"diag:{client_ip}", RATE_LIMIT_DIAG_MAX):
            return _cors_response(429, "Too many requests. Please try again in 1 minute.")
    elif path.startswith("/api/v1/analyses") and request.method == "POST":
        if not await _check_rate_limit(f"analysis:{client_ip}", RATE_LIMIT_ANALYSIS_MAX):
            return _cors_response(429, "Too many analysis requests. Please try again in 1 minute.")
    return await call_next(request)


# ─── Error logging middleware ─────────────────────────────
@app.middleware("http")
async def error_logging_middleware(request: Request, call_next):
    response = await call_next(request)

    # Skip: non-API routes, health checks, SSE streaming, and non-error responses
    path = request.url.path
    is_sse = "progress" in path or response.media_type == "text/event-stream"
    if (
        response.status_code < 400
        or not path.startswith("/api/")
        or path in ("/api/v1/health",)
        or is_sse
    ):
        return response

    # Consume body to log the error (only for non-streaming error responses)
    body_bytes = b""
    async for chunk in response.body_iterator:
        body_bytes += chunk

    error_message = ""
    try:
        data = json.loads(body_bytes)
        error_message = str(data.get("detail", data))[:1000]
    except Exception:
        error_message = body_bytes.decode("utf-8", errors="replace")[:1000]

    # Extract user_id from Bearer token
    user_id = None
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            import jwt as _jwt
            token = auth_header[7:]
            payload = _jwt.decode(
                token, settings.JWT_SECRET_KEY,
                algorithms=["HS256"],
                options={"verify_exp": False},
            )
            user_id = payload.get("sub")
        except Exception:
            logger.debug("[ErrorMiddleware] Could not decode auth JWT — user_id will be null in error log")

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")[:500]

    try:
        import uuid as _uuid
        from app.core.database import async_session_maker
        from app.models.models import ErrorLog
        async with async_session_maker() as db:
            log = ErrorLog(
                user_id=_uuid.UUID(user_id) if user_id else None,
                route=str(request.url.path)[:500],
                method=request.method,
                status_code=response.status_code,
                error_message=error_message,
                ip=client_ip[:50],
                user_agent=user_agent,
            )
            db.add(log)
            await db.commit()
    except Exception as e:
        logger.warning(f"[ErrorLog] Failed to save error log: {e}")

    return Response(
        content=body_bytes,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.media_type,
    )


# Routes
app.include_router(simulation_routes.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(webhooks.router)
app.include_router(cnae_routes.router, prefix="/api/v1")
app.include_router(benchmark_routes.router, prefix="/api/v1")
app.include_router(diagnostico.router, prefix="/api/v1")
app.include_router(partner_routes.router, prefix="/api/v1")
app.include_router(partner_crm_routes.router, prefix="/api/v1")
app.include_router(notifications_routes.router, prefix="/api/v1")
app.include_router(cnpj_routes.router, prefix="/api/v1")
app.include_router(pitch_deck_routes.router, prefix="/api/v1")
app.include_router(roi_calculator_routes.router, prefix="/api/v1")

# Serve uploaded logos as static files
import os
os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOADS_DIR), name="uploads")


@app.get("/")
async def root():
    return {
        "name": "Valuora API",
        "version": "2.0.0",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
