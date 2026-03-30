"""Add QuantoVale features: pipeline_stage, brand colors, free_report, follow-up rules,
proposal templates, notification preferences, theme preference, report comment sections.

Revision ID: 027
Revises: 026
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '027'
down_revision = '026'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- User: theme_preference ---
    op.add_column('users', sa.Column('theme_preference', sa.String(10), nullable=True))

    # --- Partner: brand colors + free_report_used ---
    op.add_column('partners', sa.Column('free_report_used', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('partners', sa.Column('brand_color', sa.String(7), nullable=True))
    op.add_column('partners', sa.Column('brand_secondary_color', sa.String(7), nullable=True))

    # --- PartnerClient: pipeline_stage ---
    pipeline_stage_enum = postgresql.ENUM(
        'lead', 'contacted', 'data_sent', 'analysis', 'closed', 'delivered',
        name='pipelinestage', create_type=False
    )
    pipeline_stage_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('partner_clients', sa.Column(
        'pipeline_stage',
        sa.Enum('lead', 'contacted', 'data_sent', 'analysis', 'closed', 'delivered', name='pipelinestage'),
        server_default='lead',
        nullable=True
    ))

    # --- PartnerComment: section field ---
    op.add_column('partner_comments', sa.Column('section', sa.String(50), server_default='general', nullable=True))

    # --- FollowUpLog: expand trigger enum ---
    # Add new enum values to followuptrigger
    op.execute("ALTER TYPE followuptrigger ADD VALUE IF NOT EXISTS 'no_register'")
    op.execute("ALTER TYPE followuptrigger ADD VALUE IF NOT EXISTS 'no_data'")
    op.execute("ALTER TYPE followuptrigger ADD VALUE IF NOT EXISTS 'no_meeting'")
    op.execute("ALTER TYPE followuptrigger ADD VALUE IF NOT EXISTS 'post_report'")

    # --- New table: partner_followup_rules ---
    op.create_table(
        'partner_followup_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('partner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('partners.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('trigger', sa.String(50), nullable=False),
        sa.Column('days_delay', sa.Integer(), default=3),
        sa.Column('message_template', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- New table: partner_proposal_templates ---
    op.create_table(
        'partner_proposal_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('partner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('partners.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('category', sa.String(50), server_default='general', nullable=True),
        sa.Column('is_default', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- New table: notification_preferences ---
    op.create_table(
        'notification_preferences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('email_analysis_done', sa.Boolean(), server_default='true'),
        sa.Column('email_payment_confirmation', sa.Boolean(), server_default='true'),
        sa.Column('email_report_ready', sa.Boolean(), server_default='true'),
        sa.Column('email_pitch_deck_done', sa.Boolean(), server_default='true'),
        sa.Column('email_marketing', sa.Boolean(), server_default='true'),
        sa.Column('email_partner_updates', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', name='uq_notification_preference_user'),
    )


def downgrade() -> None:
    op.drop_table('notification_preferences')
    op.drop_table('partner_proposal_templates')
    op.drop_table('partner_followup_rules')
    op.drop_column('partner_comments', 'section')
    op.drop_column('partner_clients', 'pipeline_stage')
    op.drop_column('partners', 'brand_secondary_color')
    op.drop_column('partners', 'brand_color')
    op.drop_column('partners', 'free_report_used')
    op.drop_column('users', 'theme_preference')
