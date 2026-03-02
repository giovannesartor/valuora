"""016 — add bundle to PlanType/ProductType enums, add partner_id to coupons

Revision ID: 016
Revises: 015
Create Date: 2026-03-03

Changes:
  - plantype enum: add 'bundle' value (Valuation + Pitch Deck bundle)
  - producttype enum: add 'bundle' value
  - coupons: add partner_id FK (nullable) for partner-owned coupons
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = '016'
down_revision = '015a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'bundle' to plantype enum
    op.execute("ALTER TYPE plantype ADD VALUE IF NOT EXISTS 'bundle'")

    # Ensure producttype enum exists (older deploy of 015 may not have created it)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'producttype') THEN
                CREATE TYPE producttype AS ENUM ('valuation', 'pitch_deck', 'bundle');
            END IF;
        END
        $$;
    """)
    op.execute("ALTER TYPE producttype ADD VALUE IF NOT EXISTS 'bundle'")

    # Add partner_id FK to coupons table (idempotent)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'coupons' AND column_name = 'partner_id'
            ) THEN
                ALTER TABLE coupons
                    ADD COLUMN partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
            END IF;
        END
        $$;
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_coupons_partner_id ON coupons (partner_id)")


def downgrade() -> None:
    op.drop_index('ix_coupons_partner_id', table_name='coupons')
    op.drop_column('coupons', 'partner_id')
    # Note: PostgreSQL does not support removing enum values easily; skip enum downgrade
