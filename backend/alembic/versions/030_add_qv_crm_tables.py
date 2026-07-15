"""add QV partner CRM tables used by synced partner_crm + guided analysis

Revision ID: 030
Revises: 029
Create Date: 2026-07-14

Adds tables that the QV-synced routes expect:
  - partner_tasks
  - partner_client_notes
  - partner_report_comments
  - sample_downloads
  - account_activation_tokens

Legacy client_tasks / client_notes / partner_comments tables are left intact.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade():
    # ── partner_tasks ────────────────────────────────────
    op.create_table(
        "partner_tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("partner_clients.id", ondelete="CASCADE"), nullable=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("auto_generated", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("trigger_type", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_partner_tasks_partner_id", "partner_tasks", ["partner_id"])
    op.create_index("ix_partner_tasks_client_id", "partner_tasks", ["client_id"])

    # ── partner_client_notes ─────────────────────────────
    op.create_table(
        "partner_client_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("partner_clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_partner_client_notes_partner_id", "partner_client_notes", ["partner_id"])
    op.create_index("ix_partner_client_notes_client_id", "partner_client_notes", ["client_id"])

    # ── partner_report_comments ──────────────────────────
    op.create_table(
        "partner_report_comments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_id", UUID(as_uuid=True), sa.ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("partner_clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("section", sa.String(100), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_partner_report_comments_partner_id", "partner_report_comments", ["partner_id"])
    op.create_index("ix_partner_report_comments_analysis_id", "partner_report_comments", ["analysis_id"])

    # ── sample_downloads ─────────────────────────────────
    op.create_table(
        "sample_downloads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sample_id", sa.String(50), nullable=False),
        sa.Column("downloaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sample_downloads_partner_id", "sample_downloads", ["partner_id"])
    op.create_index("ix_sample_downloads_sample_id", "sample_downloads", ["sample_id"])

    # ── account_activation_tokens ────────────────────────
    op.create_table(
        "account_activation_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_id", UUID(as_uuid=True), sa.ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("token", sa.String(500), nullable=False, unique=True),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_account_activation_tokens_user_id", "account_activation_tokens", ["user_id"])
    op.create_index("ix_account_activation_tokens_token", "account_activation_tokens", ["token"])

    # ── payments: Asaas columns (admin sync + guided analysis) ──
    op.add_column("payments", sa.Column("asaas_payment_id", sa.String(255), nullable=True))
    op.add_column("payments", sa.Column("asaas_customer_id", sa.String(255), nullable=True))
    op.add_column("payments", sa.Column("asaas_invoice_url", sa.String(500), nullable=True))
    op.create_index("ix_payments_asaas_payment_id", "payments", ["asaas_payment_id"])


def downgrade():
    op.drop_index("ix_payments_asaas_payment_id", table_name="payments")
    op.drop_column("payments", "asaas_invoice_url")
    op.drop_column("payments", "asaas_customer_id")
    op.drop_column("payments", "asaas_payment_id")
    op.drop_index("ix_account_activation_tokens_token", table_name="account_activation_tokens")
    op.drop_index("ix_account_activation_tokens_user_id", table_name="account_activation_tokens")
    op.drop_table("account_activation_tokens")

    op.drop_index("ix_sample_downloads_sample_id", table_name="sample_downloads")
    op.drop_index("ix_sample_downloads_partner_id", table_name="sample_downloads")
    op.drop_table("sample_downloads")

    op.drop_index("ix_partner_report_comments_analysis_id", table_name="partner_report_comments")
    op.drop_index("ix_partner_report_comments_partner_id", table_name="partner_report_comments")
    op.drop_table("partner_report_comments")

    op.drop_index("ix_partner_client_notes_client_id", table_name="partner_client_notes")
    op.drop_index("ix_partner_client_notes_partner_id", table_name="partner_client_notes")
    op.drop_table("partner_client_notes")

    op.drop_index("ix_partner_tasks_client_id", table_name="partner_tasks")
    op.drop_index("ix_partner_tasks_partner_id", table_name="partner_tasks")
    op.drop_table("partner_tasks")
