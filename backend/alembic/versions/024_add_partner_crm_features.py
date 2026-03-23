"""add partner CRM tables: client_notes, client_tasks, partner_comments, follow_up_logs, guided_sessions

Revision ID: 024
Revises: 023
Create Date: 2026-03-16 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM as PG_ENUM

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade():
    # ── Create enum types safely (handle already-exists from partial runs) ──
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE notetype AS ENUM ('general', 'call', 'meeting', 'follow_up');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE followuptrigger AS ENUM ('no_fill_3d', 'report_7d', 'no_purchase_7d');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # Use PG_ENUM with create_type=False to reference existing types without re-creating
    notetype = PG_ENUM("general", "call", "meeting", "follow_up", name="notetype", create_type=False)
    followuptrigger = PG_ENUM("no_fill_3d", "report_7d", "no_purchase_7d", name="followuptrigger", create_type=False)

    # ── client_notes ──
    op.create_table(
        "client_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("partner_clients.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("note_type", notetype, server_default="general"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── client_tasks ──
    op.create_table(
        "client_tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("partner_clients.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_completed", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reminder_sent", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── partner_comments ──
    op.create_table(
        "partner_comments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_id", UUID(as_uuid=True), sa.ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── follow_up_logs ──
    op.create_table(
        "follow_up_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("partner_clients.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trigger_type", followuptrigger, nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── guided_sessions ──
    op.create_table(
        "guided_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("partner_clients.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("responses", sa.JSON(), server_default=sa.text("'{}'")),
        sa.Column("current_step", sa.Integer(), server_default=sa.text("0")),
        sa.Column("is_completed", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("guided_sessions")
    op.drop_table("follow_up_logs")
    op.drop_table("partner_comments")
    op.drop_table("client_tasks")
    op.drop_table("client_notes")
    sa.Enum(name="followuptrigger").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="notetype").drop(op.get_bind(), checkfirst=True)
