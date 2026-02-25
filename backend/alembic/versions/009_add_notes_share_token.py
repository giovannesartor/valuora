"""add notes and share_token to analyses

Revision ID: 009_add_notes_share_token
Revises: 008_add_coupons
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '009_add_notes_share_token'
down_revision = '008_add_coupons'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('analyses', sa.Column('notes', sa.Text(), nullable=True))
    op.add_column('analyses', sa.Column('share_token', sa.String(64), nullable=True))
    op.create_unique_constraint('uq_analyses_share_token', 'analyses', ['share_token'])
    op.create_index('ix_analyses_share_token', 'analyses', ['share_token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_analyses_share_token', table_name='analyses')
    op.drop_constraint('uq_analyses_share_token', 'analyses', type_='unique')
    op.drop_column('analyses', 'share_token')
    op.drop_column('analyses', 'notes')
