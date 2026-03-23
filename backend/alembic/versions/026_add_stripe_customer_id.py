"""Add stripe_customer_id to users table

Revision ID: 026
Revises: 025
Create Date: 2026-03-23 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("stripe_customer_id", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "stripe_customer_id")
