"""017 — fix: add missing partner_id to pitch_decks (idempotent)

The production DB is missing pitch_decks.partner_id because migration 015
failed mid-run (commissions FK error). This migration safely adds the
column and FK constraint if they don't already exist.

Revision ID: 017
Revises: 016
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa

revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── pitch_decks.partner_id ─────────────────────────────
    # Use raw SQL + IF NOT EXISTS so this is fully idempotent
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'pitch_decks' AND column_name = 'partner_id'
            ) THEN
                ALTER TABLE pitch_decks
                    ADD COLUMN partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
            END IF;
        END
        $$;
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pitch_decks_partner_id ON pitch_decks (partner_id)"
    )

    # ── pitch_decks.deleted_at (also added by 015a, guard here too) ──
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'pitch_decks' AND column_name = 'deleted_at'
            ) THEN
                ALTER TABLE pitch_decks
                    ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
            END IF;
        END
        $$;
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pitch_decks_deleted_at ON pitch_decks (deleted_at)"
    )

    # ── commissions.product_type (added by 015, guard here too) ──────
    op.execute("""
        DO $$
        BEGIN
            -- Create enum if missing
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'producttype') THEN
                CREATE TYPE producttype AS ENUM ('valuation', 'pitch_deck', 'bundle');
            END IF;
            -- Add column if missing
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'commissions' AND column_name = 'product_type'
            ) THEN
                ALTER TABLE commissions
                    ADD COLUMN product_type producttype DEFAULT 'valuation';
                UPDATE commissions SET product_type = 'valuation' WHERE product_type IS NULL;
            END IF;
        END
        $$;
    """)
    # Ensure 'bundle' value exists in producttype enum
    op.execute("ALTER TYPE producttype ADD VALUE IF NOT EXISTS 'bundle'")

    # ── commissions.pitch_deck_payment_id ────────────────────────────
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'commissions' AND column_name = 'pitch_deck_payment_id'
            ) THEN
                ALTER TABLE commissions
                    ADD COLUMN pitch_deck_payment_id UUID
                    REFERENCES pitch_deck_payments(id) ON DELETE SET NULL;
            END IF;
        END
        $$;
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_commissions_pitch_deck_payment_id ON commissions (pitch_deck_payment_id)"
    )

    # ── coupons.partner_id (added by 016, guard here too) ────────────
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'coupons' AND column_name = 'partner_id'
            ) THEN
                ALTER TABLE coupons
                    ADD COLUMN partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
            END IF;
        END
        $$;
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_coupons_partner_id ON coupons (partner_id)"
    )

    # ── plantype enum: add 'bundle' if missing ───────────────────────
    op.execute("ALTER TYPE plantype ADD VALUE IF NOT EXISTS 'bundle'")


def downgrade() -> None:
    # Only drop things added by this migration that weren't in earlier ones
    # (safe no-op for production rollback)
    pass
