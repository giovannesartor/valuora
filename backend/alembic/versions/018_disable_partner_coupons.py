"""018 — disable partner-managed coupons

Partners can no longer create or manage discount coupons.
This migration deactivates all coupons previously created by partners
so they are no longer redeemable.

Admin-created coupons (partner_id IS NULL) are left untouched.

Revision ID: 018
Revises: 017
Create Date: 2026-03-02
"""
from alembic import op

revision = '018'
down_revision = '017'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Deactivate all coupons that were created by partners (partner_id IS NOT NULL).
    # Admin-managed coupons (partner_id IS NULL) remain active.
    op.execute("""
        UPDATE coupons
        SET is_active = false
        WHERE partner_id IS NOT NULL
          AND is_active = true
    """)


def downgrade() -> None:
    # Re-activating partner coupons is intentionally a no-op —
    # we cannot know which ones were already inactive before this migration.
    pass
