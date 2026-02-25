"""normalize partner commission rate to 50% and fix non-QV referral codes

Revision ID: 011_normalize_partner_commission
Revises: 010_add_net_value_to_payments
Create Date: 2026-02-25
"""
import secrets
import string
from alembic import op
from sqlalchemy import text

revision = '011_normalize_partner_commission'
down_revision = '010_add_net_value_to_payments'
branch_labels = None
depends_on = None


def _new_code(conn) -> str:
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "QV-" + ''.join(secrets.choice(chars) for _ in range(8))
        exists = conn.execute(text("SELECT 1 FROM partners WHERE referral_code = :c"), {"c": code}).first()
        if not exists:
            return code


def upgrade():
    conn = op.get_bind()

    # 1. Normalize all commission rates to 50%
    conn.execute(text("UPDATE partners SET commission_rate = 0.50"))

    # 2. Fix referral codes that don't start with QV-
    bad_codes = conn.execute(
        text("SELECT id, referral_code FROM partners WHERE referral_code NOT LIKE 'QV-%'")
    ).fetchall()

    for row in bad_codes:
        new_code = _new_code(conn)
        conn.execute(
            text("UPDATE partners SET referral_code = :code WHERE id = :id"),
            {"code": new_code, "id": str(row[0])},
        )


def downgrade():
    pass  # data migration only — no rollback

