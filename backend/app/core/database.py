from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.APP_DEBUG, pool_pre_ping=True)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Run migrations: add missing columns to existing tables
    await run_migrations()


async def run_migrations():
    """Add missing columns to existing tables (safe to run multiple times)."""
    migrations = [
        # Users table - admin columns
        ("users", "is_admin", "ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE"),
        ("users", "is_superadmin", "ALTER TABLE users ADD COLUMN is_superadmin BOOLEAN DEFAULT FALSE"),
        # Payments table - Asaas columns
        ("payments", "asaas_payment_id", "ALTER TABLE payments ADD COLUMN asaas_payment_id VARCHAR(255)"),
        ("payments", "asaas_customer_id", "ALTER TABLE payments ADD COLUMN asaas_customer_id VARCHAR(255)"),
        ("payments", "asaas_invoice_url", "ALTER TABLE payments ADD COLUMN asaas_invoice_url VARCHAR(500)"),
    ]

    async with engine.begin() as conn:
        for table, column, sql in migrations:
            try:
                # Check if column exists
                result = await conn.execute(text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = :table AND column_name = :column"
                ), {"table": table, "column": column})
                if not result.fetchone():
                    await conn.execute(text(sql))
                    print(f"[MIGRATION] Added column {table}.{column}")
            except Exception as e:
                print(f"[MIGRATION] Skipping {table}.{column}: {e}")
