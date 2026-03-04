"""020 — pitch_deck investor_type, theme, ai_competitive_analysis, executive_summary_path; pitch_deck_views table

Revision ID: 020
Revises: 019
Create Date: 2026-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── New columns on pitch_decks ──────────────────────────
    op.add_column(
        "pitch_decks",
        sa.Column("investor_type", sa.String(50), nullable=True, server_default="geral"),
    )
    op.add_column(
        "pitch_decks",
        sa.Column("theme", sa.String(50), nullable=True, server_default="corporate"),
    )
    op.add_column(
        "pitch_decks",
        sa.Column("ai_competitive_analysis", sa.Text(), nullable=True),
    )
    op.add_column(
        "pitch_decks",
        sa.Column("executive_summary_path", sa.String(500), nullable=True),
    )

    # ── pitch_deck_views table ──────────────────────────────
    op.create_table(
        "pitch_deck_views",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "pitch_deck_id",
            UUID(as_uuid=True),
            sa.ForeignKey("pitch_decks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "viewed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("from_share_link", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("slide_count", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_pitch_deck_views_pitch_deck_id",
        "pitch_deck_views",
        ["pitch_deck_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_pitch_deck_views_pitch_deck_id", table_name="pitch_deck_views")
    op.drop_table("pitch_deck_views")
    op.drop_column("pitch_decks", "executive_summary_path")
    op.drop_column("pitch_decks", "ai_competitive_analysis")
    op.drop_column("pitch_decks", "theme")
    op.drop_column("pitch_decks", "investor_type")
