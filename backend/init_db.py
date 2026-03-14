"""
One-shot DB initializer for Railway deployments.

On a FRESH database (no tables):
  1. Creates all tables from SQLAlchemy models (Base.metadata.create_all)
  2. Stamps Alembic to the latest revision so future migrations work

On an EXISTING database:
  1. Runs alembic upgrade head (normal incremental migrations)
"""
import sys
import subprocess
from sqlalchemy import create_engine, inspect, text
from app.core.config import settings
from app.core.database import Base

# Import all models so metadata is populated
import app.models.models  # noqa: F401


def main():
    sync_url = settings.DATABASE_URL_SYNC
    if not sync_url or sync_url.startswith("postgresql+asyncpg://"):
        sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    engine = create_engine(sync_url)
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    if "users" not in existing_tables:
        print("[INIT] Fresh database detected — creating all tables from models...")
        Base.metadata.create_all(engine)
        print("[INIT] Tables created. Stamping Alembic to latest revision...")
        subprocess.run(["alembic", "stamp", "head"], check=True)
        print("[INIT] Done — database is ready.")
    else:
        print("[INIT] Existing database detected — running alembic upgrade head...")
        subprocess.run(["alembic", "upgrade", "head"], check=True)
        print("[INIT] Migrations applied.")

    engine.dispose()


if __name__ == "__main__":
    main()
