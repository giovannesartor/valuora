"""Add diagnostic fields: company_type, revenue_ntm, tangible/intangible assets, participations, location, founding_date, website, instagram

Revision ID: 024
"""
from alembic import op
import sqlalchemy as sa

revision = "024"
down_revision = "023_add_utm_to_partner_clients"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Analysis table: new diagnostic fields ──
    op.add_column("analyses", sa.Column("company_type", sa.String(30), nullable=True))
    op.add_column("analyses", sa.Column("revenue_ntm", sa.Numeric(15, 2), nullable=True))
    op.add_column("analyses", sa.Column("ebitda_margin", sa.Float, nullable=True))
    op.add_column("analyses", sa.Column("tangible_assets", sa.Numeric(15, 2), nullable=True))
    op.add_column("analyses", sa.Column("intangible_assets", sa.Numeric(15, 2), nullable=True))
    op.add_column("analyses", sa.Column("equity_participations", sa.Numeric(15, 2), nullable=True))
    op.add_column("analyses", sa.Column("founding_date", sa.String(7), nullable=True))
    op.add_column("analyses", sa.Column("location_state", sa.String(2), nullable=True))
    op.add_column("analyses", sa.Column("location_city", sa.String(100), nullable=True))
    op.add_column("analyses", sa.Column("website", sa.String(500), nullable=True))

    # ── User table: instagram ──
    op.add_column("users", sa.Column("instagram", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "instagram")
    op.drop_column("analyses", "website")
    op.drop_column("analyses", "location_city")
    op.drop_column("analyses", "location_state")
    op.drop_column("analyses", "founding_date")
    op.drop_column("analyses", "equity_participations")
    op.drop_column("analyses", "intangible_assets")
    op.drop_column("analyses", "tangible_assets")
    op.drop_column("analyses", "ebitda_margin")
    op.drop_column("analyses", "revenue_ntm")
    op.drop_column("analyses", "company_type")
