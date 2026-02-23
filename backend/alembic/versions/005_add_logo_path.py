"""add logo_path column to analyses

Revision ID: 005_add_logo_path
Revises: 004_add_partner_pix_fields
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = '005_add_logo_path'
down_revision = '004_add_partner_pix_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa_inspect(bind)

    if 'analyses' in inspector.get_table_names():
        existing_cols = [c['name'] for c in inspector.get_columns('analyses')]
        if 'logo_path' not in existing_cols:
            op.add_column('analyses', sa.Column('logo_path', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('analyses', 'logo_path')
