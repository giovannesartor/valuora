"""015a — add deleted_at to pitch_decks (soft delete)

Revision ID: 015a
Revises: 015
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa

revision = '015a'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'pitch_decks',
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_pitch_decks_deleted_at', 'pitch_decks', ['deleted_at'])


def downgrade() -> None:
    op.drop_index('ix_pitch_decks_deleted_at', table_name='pitch_decks')
    op.drop_column('pitch_decks', 'deleted_at')
