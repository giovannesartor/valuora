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
    op.execute(
        "ALTER TABLE pitch_decks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pitch_decks_deleted_at ON pitch_decks (deleted_at)"
    )


def downgrade() -> None:
    op.drop_index('ix_pitch_decks_deleted_at', table_name='pitch_decks')
    op.drop_column('pitch_decks', 'deleted_at')
