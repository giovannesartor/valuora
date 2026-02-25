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
    op.execute("""
        CREATE TABLE IF NOT EXISTS error_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            route VARCHAR(500) NOT NULL,
            method VARCHAR(10) NOT NULL,
            status_code INTEGER NOT NULL,
            error_message TEXT,
            ip VARCHAR(50),
            user_agent VARCHAR(500),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_error_logs_created_at ON error_logs (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_error_logs_user_id ON error_logs (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_error_logs_status_code ON error_logs (status_code)")


def downgrade():
    op.drop_table('error_logs')
