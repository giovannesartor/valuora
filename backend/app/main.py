from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import time
import logging
import json
from collections import defaultdict

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
from app.routes import simulation as simulation_routes
from app.routes import notifications_routes
from app.routes import cnpj_routes
from app.routes import pitch_deck as pitch_deck_routes

logger = logging.getLogger(__name__)

# ─── Simple in-memory rate limiter ─────────────────────────
# NOTE: in-memory — accurate for single-worker Railway deploy.
# Scale to Redis if multiple workers are ever added.
_rate_limit_store: dict = defaultdict(list)
RATE_LIMIT_WINDOW = 60   # seconds
RATE_LIMIT_MAX = 10      # general auth endpoints (register, refresh…)
RATE_LIMIT_LOGIN_MAX = 5 # login: tighter to prevent brute-force
RATE_LIMIT_DIAG_MAX = 5  # diagnostico
RATE_LIMIT_ANALYSIS_MAX = 10  # analyses creation


def _check_rate_limit(client_ip: str, max_requests: int = RATE_LIMIT_MAX) -> bool:
    now = time.time()
    key = client_ip
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if now - t < RATE_LIMIT_WINDOW]
    if not _rate_limit_store[key]:
        del _rate_limit_store[key]  # prune empty keys to prevent memory leak
    if len(_rate_limit_store.get(key, [])) >= max_requests:
        return False
    _rate_limit_store[key].append(now)
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
    # Seed test partner (only in non-production)
    if settings.APP_ENV != "production":
        await seed_test_partner()
    else:
        logger.info("[STARTUP] Skipping test partner seed in production.")
    # Fix #15: Pre-fetch Selic rate on startup
    try:
        from app.core.valuation_engine.engine import fetch_selic_rate
        selic = await fetch_selic_rate()
        print(f"[STARTUP] Selic rate fetched: {selic*100:.2f}%")
    except Exception as e:
        print(f"[STARTUP] Selic fetch failed, using fallback: {e}")
    # Setup benchmark scheduler
    from app.tasks.benchmark_updater import setup_scheduler
    scheduler = setup_scheduler(app)
    yield
    # Shutdown
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="Quanto Vale API",
    description="Plataforma brasileira de valuation empresarial baseada em DCF.",
    version="1.0.0",
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


# ─── Rate limiting middleware ──────────────────────────────
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path
    # Apply stricter rate limit to auth and diagnostico
    if path.startswith("/api/v1/auth/login"):
        if not _check_rate_limit(f"login:{client_ip}", RATE_LIMIT_LOGIN_MAX):
            return JSONResponse(status_code=429, content={"detail": "Muitas tentativas de login. Tente novamente em 1 minuto."})
    elif path.startswith("/api/v1/auth/"):
        if not _check_rate_limit(f"auth:{client_ip}", RATE_LIMIT_MAX):
            return JSONResponse(status_code=429, content={"detail": "Muitas requisições. Tente novamente em 1 minuto."})
    elif path.startswith("/api/v1/diagnostico"):
        if not _check_rate_limit(f"diag:{client_ip}", RATE_LIMIT_DIAG_MAX):
            return JSONResponse(status_code=429, content={"detail": "Muitas requisições. Tente novamente em 1 minuto."})
    elif path.startswith("/api/v1/analyses") and request.method == "POST":
        if not _check_rate_limit(f"analysis:{client_ip}", RATE_LIMIT_ANALYSIS_MAX):
            return JSONResponse(status_code=429, content={"detail": "Muitas requisições de análise. Tente novamente em 1 minuto."})
    return await call_next(request)


# ─── Error logging middleware ─────────────────────────────
@app.middleware("http")
async def error_logging_middleware(request: Request, call_next):
    response = await call_next(request)

    # Only capture errors on API routes, skip health/webhooks
    if (
        response.status_code >= 400
        and request.url.path.startswith("/api/")
        and request.url.path not in ("/api/v1/health",)
    ):
        body_bytes = b""
        async for chunk in response.body_iterator:
            body_bytes += chunk

        # Parse error message from JSON body
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
                pass

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

    return response


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
app.include_router(notifications_routes.router, prefix="/api/v1")
app.include_router(cnpj_routes.router, prefix="/api/v1")
app.include_router(pitch_deck_routes.router, prefix="/api/v1")

# Serve uploaded logos as static files
import os
os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOADS_DIR), name="uploads")


@app.get("/")
async def root():
    return {
        "name": "Quanto Vale API",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
