"""add user_favorites, notification_reads, partner_client.notes

Revision ID: 013
Revises: 012
Create Date: 2026-02-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── user_favorites table ──────────────────────────────
    op.create_table(
        'user_favorites',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('analysis_id', UUID(as_uuid=True), sa.ForeignKey('analyses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_user_favorites_user_id', 'user_favorites', ['user_id'])
    op.create_index('ix_user_favorites_analysis_id', 'user_favorites', ['analysis_id'])
    op.create_index('ix_user_favorites_unique', 'user_favorites', ['user_id', 'analysis_id'], unique=True)

    # ─── notification_reads table ──────────────────────────
    op.create_table(
        'notification_reads',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('notification_key', sa.String(255), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_notification_reads_user_id', 'notification_reads', ['user_id'])
    op.create_index('ix_notification_reads_key', 'notification_reads', ['notification_key'])
    op.create_index('ix_notification_reads_unique', 'notification_reads', ['user_id', 'notification_key'], unique=True)

    # ─── partner_clients.notes column ─────────────────────
    op.add_column('partner_clients', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('partner_clients', 'notes')
    op.drop_table('notification_reads')
    op.drop_table('user_favorites')
