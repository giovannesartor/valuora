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
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'bundle' to plantype enum (PostgreSQL requires commit between enum and column changes)
    op.execute("ALTER TYPE plantype ADD VALUE IF NOT EXISTS 'bundle'")
    op.execute("ALTER TYPE producttype ADD VALUE IF NOT EXISTS 'bundle'")

    # Add partner_id FK to coupons table
    op.add_column(
        'coupons',
        sa.Column(
            'partner_id',
            UUID(as_uuid=True),
            sa.ForeignKey('partners.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index('ix_coupons_partner_id', 'coupons', ['partner_id'])


def downgrade() -> None:
    op.drop_index('ix_coupons_partner_id', table_name='coupons')
    op.drop_column('coupons', 'partner_id')
    # Note: PostgreSQL does not support removing enum values easily; skip enum downgrade
