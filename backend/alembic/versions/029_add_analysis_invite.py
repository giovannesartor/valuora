"""add analysis_invite table

Revision ID: 029
Revises: 028
Create Date: 2026-06-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = '029'
down_revision = '028'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'analysis_invites',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('token', sa.String(64), nullable=False, unique=True, index=True),
        sa.Column('partner_id', UUID(as_uuid=True), sa.ForeignKey('partners.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('partner_client_id', UUID(as_uuid=True), sa.ForeignKey('partner_clients.id', ondelete='SET NULL'), nullable=True),
        sa.Column('analysis_id', UUID(as_uuid=True), sa.ForeignKey('analyses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('suggested_plan', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending', index=True),
        sa.Column('client_email', sa.String(255), nullable=False),
        sa.Column('client_name', sa.String(255), nullable=True),
        sa.Column('message', sa.Text, nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('analysis_invites')
