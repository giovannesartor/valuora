"""add partner mode tables

Revision ID: 003_add_partner_mode
Revises: 002_add_v3_engine_columns
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '003_add_partner_mode'
down_revision = '002_add_v3_engine_columns'
branch_labels = None
depends_on = None


def upgrade():
    # Partners table
    op.create_table(
        'partners',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('company_name', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('referral_code', sa.String(20), unique=True, nullable=False, index=True),
        sa.Column('referral_link', sa.String(500), nullable=True),
        sa.Column('commission_rate', sa.Float, default=0.60),
        sa.Column('status', sa.Enum('pending', 'active', 'suspended', name='partnerstatus'), default='active'),
        sa.Column('total_earnings', sa.Numeric(12, 2), default=0),
        sa.Column('total_sales', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True)),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
    )

    # Partner clients table
    op.create_table(
        'partner_clients',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('partner_id', UUID(as_uuid=True), sa.ForeignKey('partners.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('client_name', sa.String(255), nullable=False),
        sa.Column('client_company', sa.String(255), nullable=True),
        sa.Column('client_email', sa.String(255), nullable=False),
        sa.Column('client_phone', sa.String(20), nullable=True),
        sa.Column('data_status', sa.Enum('pre_filled', 'completed', 'report_sent', name='clientdatastatus'), default='pre_filled'),
        sa.Column('plan', sa.Enum('essencial', 'profissional', 'estrategico', name='plantype', create_type=False)),
        sa.Column('analysis_id', UUID(as_uuid=True), sa.ForeignKey('analyses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True)),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
    )

    # Commissions table
    op.create_table(
        'commissions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('partner_id', UUID(as_uuid=True), sa.ForeignKey('partners.id', ondelete='CASCADE'), nullable=False),
        sa.Column('payment_id', UUID(as_uuid=True), sa.ForeignKey('payments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('client_id', UUID(as_uuid=True), sa.ForeignKey('partner_clients.id', ondelete='SET NULL'), nullable=True),
        sa.Column('total_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('partner_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('system_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('status', sa.Enum('pending', 'approved', 'paid', name='commissionstatus'), default='pending'),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True)),
    )

    # Add partner_id to users
    op.add_column('users', sa.Column('partner_id', UUID(as_uuid=True), sa.ForeignKey('partners.id', ondelete='SET NULL'), nullable=True))

    # Add partner_id to analyses
    op.add_column('analyses', sa.Column('partner_id', UUID(as_uuid=True), sa.ForeignKey('partners.id', ondelete='SET NULL'), nullable=True))


def downgrade():
    op.drop_column('analyses', 'partner_id')
    op.drop_column('users', 'partner_id')
    op.drop_table('commissions')
    op.drop_table('partner_clients')
    op.drop_table('partners')
    op.execute("DROP TYPE IF EXISTS partnerstatus")
    op.execute("DROP TYPE IF EXISTS clientdatastatus")
    op.execute("DROP TYPE IF EXISTS commissionstatus")
