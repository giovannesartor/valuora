"""Add unique constraints to user_favorites and notification_reads

Revision ID: 021
Revises: 020
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade():
    # Remove any existing duplicates before adding unique constraints
    op.execute("""
        DELETE FROM user_favorites a USING user_favorites b
        WHERE a.id < b.id AND a.user_id = b.user_id AND a.analysis_id = b.analysis_id
    """)
    op.execute("""
        DELETE FROM notification_reads a USING notification_reads b
        WHERE a.id < b.id AND a.user_id = b.user_id AND a.notification_key = b.notification_key
    """)

    op.create_unique_constraint("uq_user_favorite", "user_favorites", ["user_id", "analysis_id"])
    op.create_unique_constraint("uq_notification_read", "notification_reads", ["user_id", "notification_key"])


def downgrade():
    op.drop_constraint("uq_notification_read", "notification_reads", type_="unique")
    op.drop_constraint("uq_user_favorite", "user_favorites", type_="unique")
