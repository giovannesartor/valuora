import logging
from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import Optional, List

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # App
    APP_NAME: str = "QuantoVale"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"
    APP_SECRET_KEY: str = "change-me"
    CORS_ORIGINS: str = ""  # comma-separated extra origins

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/quantovale"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/quantovale"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    RAILWAY_SERVICE_REDIS_URL: str = ""

    # JWT
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "Quanto Vale"
    SMTP_FROM_EMAIL: str = "quantovalehoje@gmail.com"

    # DeepSeek
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_API_URL: str = "https://api.deepseek.com/v1"

    # Storage (local)
    REPORTS_DIR: str = "./storage/reports"
    UPLOADS_DIR: str = "./storage/uploads"

    # Cloudflare R2 / S3 (optional — if set, logos are stored in R2 instead of local FS)
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_PUBLIC_URL: str = ""  # e.g. https://pub-xxx.r2.dev

    # Payments - Asaas
    ASAAS_API_KEY: str = ""
    ASAAS_API_URL: str = "https://api.asaas.com/v3"
    ASAAS_WEBHOOK_TOKEN: str = ""
    PAYMENT_WEBHOOK_SECRET: str = ""

    # Admin (read from env vars — NEVER hardcode credentials)
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    ADMIN_NAME: str = "Admin"

    @model_validator(mode="after")
    def fix_database_urls(self):
        """Railway provides postgresql:// but we need postgresql+asyncpg:// for async."""
        if self.DATABASE_URL and not self.DATABASE_URL.startswith("postgresql+asyncpg://"):
            # Save original for sync usage
            self.DATABASE_URL_SYNC = self.DATABASE_URL.replace(
                "postgresql+asyncpg://", "postgresql://"
            )
            if self.DATABASE_URL.startswith("postgresql://"):
                self.DATABASE_URL_SYNC = self.DATABASE_URL  # already sync format
            self.DATABASE_URL = self.DATABASE_URL.replace(
                "postgresql://", "postgresql+asyncpg://"
            )
        else:
            # Already async format — derive sync from it
            self.DATABASE_URL_SYNC = self.DATABASE_URL.replace(
                "postgresql+asyncpg://", "postgresql://"
            )
        return self

    @model_validator(mode="after")
    def fix_redis_url(self):
        """Use Railway's Redis URL if provided."""
        if self.RAILWAY_SERVICE_REDIS_URL:
            self.REDIS_URL = f"redis://{self.RAILWAY_SERVICE_REDIS_URL}"
        return self

    @model_validator(mode="after")
    def validate_critical_vars(self):
        """Warn on startup if critical env vars are missing."""
        if self.JWT_SECRET_KEY == "change-me" and self.APP_ENV == "production":
            raise ValueError("JWT_SECRET_KEY must be set in production! Never use 'change-me'.")
        if not self.ADMIN_EMAIL:
            logger.warning("[CONFIG] ADMIN_EMAIL not set — admin user will NOT be seeded.")
        if not self.ADMIN_PASSWORD:
            logger.warning("[CONFIG] ADMIN_PASSWORD not set — admin user will NOT be seeded.")
        return self

    def get_cors_origins(self) -> List[str]:
        """Build CORS origins list from env var + defaults."""
        origins = [self.FRONTEND_URL]
        # Only include localhost in development
        if self.APP_ENV != "production":
            origins.extend(["http://localhost:5173", "http://localhost:3000"])
        if self.CORS_ORIGINS:
            origins.extend([o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()])
        return list(set(origins))

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
