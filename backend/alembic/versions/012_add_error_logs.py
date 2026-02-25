"""add error_logs table

Revision ID: 012
Revises: 011
Create Date: 2026-02-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '012'
down_revision = '011_normalize_partner_commission'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'error_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('route', sa.String(500), nullable=False),
        sa.Column('method', sa.String(10), nullable=False),
        sa.Column('status_code', sa.Integer, nullable=False, index=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('ip', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, index=True),
    )
    op.create_index('ix_error_logs_created_at', 'error_logs', ['created_at'])


def downgrade():
    op.drop_table('error_logs')
