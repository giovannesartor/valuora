"""add deleted_at column to analyses for soft delete / trash

Revision ID: 006_add_deleted_at
Revises: 005_add_logo_path
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = '006_add_deleted_at'
down_revision = '005_add_logo_path'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa_inspect(bind)

    if 'analyses' in inspector.get_table_names():
        existing_cols = [c['name'] for c in inspector.get_columns('analyses')]
        if 'deleted_at' not in existing_cols:
            op.add_column('analyses', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
            op.create_index('ix_analyses_deleted_at', 'analyses', ['deleted_at'])


def downgrade() -> None:
    op.drop_index('ix_analyses_deleted_at', table_name='analyses')
    op.drop_column('analyses', 'deleted_at')
