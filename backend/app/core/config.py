from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "QuantoVale"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"
    APP_SECRET_KEY: str = "change-me"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/quantovale"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/quantovale"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

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

    # Storage
    REPORTS_DIR: str = "./storage/reports"
    UPLOADS_DIR: str = "./storage/uploads"

    # Payments
    PAYMENT_WEBHOOK_SECRET: str = ""

    @model_validator(mode="after")
    def fix_database_urls(self):
        """Railway provides postgresql:// but we need postgresql+asyncpg:// for async."""
        if self.DATABASE_URL and not self.DATABASE_URL.startswith("postgresql+asyncpg://"):
            self.DATABASE_URL_SYNC = self.DATABASE_URL.replace(
                "postgresql+asyncpg://", "postgresql://"
            )
            self.DATABASE_URL = self.DATABASE_URL.replace(
                "postgresql://", "postgresql+asyncpg://"
            )
        return self

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
