"""add utm_source, utm_medium, utm_campaign to partner_clients

Revision ID: 023
Revises: 022
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("partner_clients", sa.Column("utm_source", sa.String(100), nullable=True))
    op.add_column("partner_clients", sa.Column("utm_medium", sa.String(100), nullable=True))
    op.add_column("partner_clients", sa.Column("utm_campaign", sa.String(100), nullable=True))


def downgrade():
    op.drop_column("partner_clients", "utm_campaign")
    op.drop_column("partner_clients", "utm_medium")
    op.drop_column("partner_clients", "utm_source")
