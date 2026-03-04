"""add share_password_hash and reanalysis_alert_pct to analyses

Revision ID: 019
Revises: 018
Create Date: 2025-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column("share_password_hash", sa.String(255), nullable=True),
    )
    op.add_column(
        "analyses",
        sa.Column("reanalysis_alert_pct", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analyses", "reanalysis_alert_pct")
    op.drop_column("analyses", "share_password_hash")
