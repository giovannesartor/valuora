"""add pitch_decks and pitch_deck_payments tables

Revision ID: 014
Revises: 013
Create Date: 2026-03-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── pitch_decks table ─────────────────────────────────
    op.create_table(
        'pitch_decks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('analysis_id', UUID(as_uuid=True), sa.ForeignKey('analyses.id', ondelete='SET NULL'), nullable=True),

        # Company info
        sa.Column('company_name', sa.String(255), nullable=False),
        sa.Column('sector', sa.String(100), nullable=True),
        sa.Column('logo_path', sa.String(500), nullable=True),
        sa.Column('slogan', sa.String(500), nullable=True),
        sa.Column('contact_email', sa.String(255), nullable=True),
        sa.Column('contact_phone', sa.String(50), nullable=True),
        sa.Column('website', sa.String(500), nullable=True),

        # Pitch sections
        sa.Column('headline', sa.Text(), nullable=True),
        sa.Column('problem', sa.Text(), nullable=True),
        sa.Column('solution', sa.Text(), nullable=True),
        sa.Column('target_market', sa.JSON(), nullable=True),
        sa.Column('competitive_landscape', sa.JSON(), nullable=True),
        sa.Column('business_model', sa.Text(), nullable=True),
        sa.Column('sales_channels', sa.Text(), nullable=True),
        sa.Column('marketing_activities', sa.Text(), nullable=True),
        sa.Column('funding_needs', sa.JSON(), nullable=True),
        sa.Column('financial_projections', sa.JSON(), nullable=True),
        sa.Column('milestones', sa.JSON(), nullable=True),
        sa.Column('team', sa.JSON(), nullable=True),
        sa.Column('partners_resources', sa.JSON(), nullable=True),

        # AI-generated narratives
        sa.Column('ai_headline', sa.Text(), nullable=True),
        sa.Column('ai_problem', sa.Text(), nullable=True),
        sa.Column('ai_solution', sa.Text(), nullable=True),
        sa.Column('ai_business_model', sa.Text(), nullable=True),
        sa.Column('ai_sales_channels', sa.Text(), nullable=True),
        sa.Column('ai_marketing', sa.Text(), nullable=True),
        sa.Column('ai_funding_use', sa.Text(), nullable=True),

        # Generated PDF
        sa.Column('pdf_path', sa.String(500), nullable=True),
        sa.Column('pdf_generated_at', sa.DateTime(timezone=True), nullable=True),

        # Status
        sa.Column('status', sa.Enum('draft', 'processing', 'completed', 'failed', name='pitchdeckstatus', create_type=False), server_default='draft', nullable=False),
        sa.Column('is_paid', sa.Boolean(), server_default='false', nullable=False),

        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_pitch_decks_user_id', 'pitch_decks', ['user_id'])
    op.create_index('ix_pitch_decks_analysis_id', 'pitch_decks', ['analysis_id'])

    # Create the enum type for pitch deck status
    pitchdeckstatus = sa.Enum('draft', 'processing', 'completed', 'failed', name='pitchdeckstatus')
    pitchdeckstatus.create(op.get_bind(), checkfirst=True)

    # ─── pitch_deck_payments table ──────────────────────────
    op.create_table(
        'pitch_deck_payments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('pitch_deck_id', UUID(as_uuid=True), sa.ForeignKey('pitch_decks.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('status', sa.Enum('pending', 'paid', 'failed', 'refunded', name='paymentstatus', create_type=False), server_default='pending', nullable=False),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('asaas_payment_id', sa.String(255), nullable=True),
        sa.Column('asaas_customer_id', sa.String(255), nullable=True),
        sa.Column('asaas_invoice_url', sa.String(500), nullable=True),
        sa.Column('coupon_code', sa.String(50), nullable=True),
        sa.Column('net_value', sa.Numeric(10, 2), nullable=True),
        sa.Column('fee_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_pitch_deck_payments_user_id', 'pitch_deck_payments', ['user_id'])


def downgrade() -> None:
    op.drop_table('pitch_deck_payments')
    op.drop_table('pitch_decks')
    sa.Enum(name='pitchdeckstatus').drop(op.get_bind(), checkfirst=True)
