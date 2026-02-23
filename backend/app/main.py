from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.models import models  # noqa: F401 - ensure models are registered
from app.models import cnae as cnae_models  # noqa: F401 - ensure CNAE models are registered
from app.routes import auth, analysis, payments, reports, admin, webhooks
from app.routes import cnae_routes, benchmark_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from pathlib import Path
    from app.core.database import init_db
    from app.services.auth_service import seed_admin_user
    Path(settings.REPORTS_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.UPLOADS_DIR).mkdir(parents=True, exist_ok=True)
    # Create tables if they don't exist
    await init_db()
    # Seed admin user
    await seed_admin_user()
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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
        "https://quantovale.online",
        "https://www.quantovale.online",
        "https://frontend-production-74c5.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(webhooks.router)
app.include_router(cnae_routes.router, prefix="/api/v1")
app.include_router(benchmark_routes.router, prefix="/api/v1")


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
