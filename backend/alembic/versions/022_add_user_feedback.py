"""add user_feedback table for NPS scores

Revision ID: 022
Revises: 021
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_id", UUID(as_uuid=True), sa.ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("score", sa.Integer, nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_user_feedback_user_id", "user_feedback", ["user_id"])
    op.create_index("ix_user_feedback_analysis_id", "user_feedback", ["analysis_id"])


def downgrade():
    op.drop_index("ix_user_feedback_analysis_id", table_name="user_feedback")
    op.drop_index("ix_user_feedback_user_id", table_name="user_feedback")
    op.drop_table("user_feedback")
