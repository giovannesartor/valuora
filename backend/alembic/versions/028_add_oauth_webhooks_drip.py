"""add oauth webhooks drip campaign tables

Revision ID: 028
Revises: 027_add_quantovale_features
Create Date: 2025-01-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
import uuid

revision = "028"
down_revision = "027_add_quantovale_features"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── PartnerWebhookEventType enum ──
    partner_webhook_event_type = sa.Enum(
        "analysis.completed",
        "payment.confirmed",
        "pitch_deck.ready",
        "client.created",
        "client.updated",
        name="partnerwebhookeventtype",
    )
    partner_webhook_event_type.create(op.get_bind(), checkfirst=True)

    # ── oauth_apps ──
    op.create_table(
        "oauth_apps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("client_id", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("client_secret_hash", sa.String(256), nullable=False),
        sa.Column("redirect_uris", JSONB, default=[]),
        sa.Column("scopes", JSONB, default=[]),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("website_url", sa.String(500), nullable=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("is_first_party", sa.Boolean, default=False),
        sa.Column("rate_limit_per_minute", sa.Integer, default=60),
        sa.Column("rate_limit_per_day", sa.Integer, default=10000),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── oauth_authorization_codes ──
    op.create_table(
        "oauth_authorization_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("app_id", UUID(as_uuid=True), sa.ForeignKey("oauth_apps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code_hash", sa.String(256), unique=True, nullable=False, index=True),
        sa.Column("redirect_uri", sa.String(500), nullable=False),
        sa.Column("scopes", JSONB, default=[]),
        sa.Column("state", sa.String(500), nullable=True),
        sa.Column("code_challenge", sa.String(256), nullable=True),
        sa.Column("code_challenge_method", sa.String(10), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── oauth_tokens ──
    op.create_table(
        "oauth_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("app_id", UUID(as_uuid=True), sa.ForeignKey("oauth_apps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("access_token_hash", sa.String(256), unique=True, nullable=False, index=True),
        sa.Column("refresh_token_hash", sa.String(256), unique=True, nullable=True, index=True),
        sa.Column("scopes", JSONB, default=[]),
        sa.Column("access_token_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("refresh_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_revoked", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── api_usage_logs ──
    op.create_table(
        "api_usage_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("app_id", UUID(as_uuid=True), sa.ForeignKey("oauth_apps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("endpoint", sa.String(500), nullable=False),
        sa.Column("method", sa.String(10), nullable=False),
        sa.Column("status_code", sa.Integer, nullable=True),
        sa.Column("response_time_ms", sa.Integer, nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_api_usage_logs_app_created", "api_usage_logs", ["app_id", "created_at"])

    # ── partner_webhooks ──
    op.create_table(
        "partner_webhooks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("secret", sa.String(256), nullable=False),
        sa.Column("events", JSONB, default=[]),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── partner_webhook_deliveries ──
    op.create_table(
        "partner_webhook_deliveries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("webhook_id", UUID(as_uuid=True), sa.ForeignKey("partner_webhooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("payload", JSONB, default={}),
        sa.Column("status_code", sa.Integer, nullable=True),
        sa.Column("response_body", sa.Text, nullable=True),
        sa.Column("success", sa.Boolean, default=False),
        sa.Column("attempt", sa.Integer, default=1),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_partner_wh_deliveries_webhook_created", "partner_webhook_deliveries", ["webhook_id", "created_at"])

    # ── oauth_webhooks ──
    op.create_table(
        "oauth_webhooks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("app_id", UUID(as_uuid=True), sa.ForeignKey("oauth_apps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("secret", sa.String(256), nullable=False),
        sa.Column("events", JSONB, default=[]),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── oauth_webhook_deliveries ──
    op.create_table(
        "oauth_webhook_deliveries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("webhook_id", UUID(as_uuid=True), sa.ForeignKey("oauth_webhooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("payload", JSONB, default={}),
        sa.Column("status_code", sa.Integer, nullable=True),
        sa.Column("response_body", sa.Text, nullable=True),
        sa.Column("success", sa.Boolean, default=False),
        sa.Column("attempt", sa.Integer, default=1),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_oauth_wh_deliveries_webhook_created", "oauth_webhook_deliveries", ["webhook_id", "created_at"])

    # ── Add new columns to notification_preferences ──
    op.add_column("notification_preferences", sa.Column("email_weekly_digest", sa.Boolean, server_default="false"))
    op.add_column("notification_preferences", sa.Column("push_enabled", sa.Boolean, server_default="false"))


def downgrade() -> None:
    op.drop_column("notification_preferences", "push_enabled")
    op.drop_column("notification_preferences", "email_weekly_digest")

    op.drop_index("ix_oauth_wh_deliveries_webhook_created", table_name="oauth_webhook_deliveries")
    op.drop_table("oauth_webhook_deliveries")
    op.drop_table("oauth_webhooks")
    op.drop_index("ix_partner_wh_deliveries_webhook_created", table_name="partner_webhook_deliveries")
    op.drop_table("partner_webhook_deliveries")
    op.drop_table("partner_webhooks")
    op.drop_index("ix_api_usage_logs_app_created", table_name="api_usage_logs")
    op.drop_table("api_usage_logs")
    op.drop_table("oauth_tokens")
    op.drop_table("oauth_authorization_codes")
    op.drop_table("oauth_apps")

    sa.Enum(name="partnerwebhookeventtype").drop(op.get_bind(), checkfirst=True)
