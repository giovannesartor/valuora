"""add product_type + pitch_deck_payment_id to commissions, partner_id to pitch_decks

Revision ID: 015
Revises: 014
Create Date: 2026-03-02

Changes:
  - commissions: add product_type enum column (valuation | pitch_deck)
  - commissions: add pitch_deck_payment_id FK (nullable)
  - pitch_decks: add partner_id FK (nullable) for attribution
"""
from alembic import op
import sqlalchemy as sa


revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # All operations use raw SQL with IF NOT EXISTS for full idempotency
    # (previous deploys may have failed mid-migration)

    # ─── producttype enum ─────────────────────────────────
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'producttype') THEN
                CREATE TYPE producttype AS ENUM ('valuation', 'pitch_deck', 'bundle');
            END IF;
        END
        $$;
    """)

    # ─── commissions: product_type ────────────────────────
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'commissions' AND column_name = 'product_type'
            ) THEN
                ALTER TABLE commissions
                    ADD COLUMN product_type producttype DEFAULT 'valuation';
            END IF;
        END
        $$;
    """)

    # ─── commissions: pitch_deck_payment_id ──────────────
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

    # ─── pitch_decks: partner_id ──────────────────────────
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

    # Backfill: set product_type = 'valuation' for all existing commissions
    op.execute("UPDATE commissions SET product_type = 'valuation' WHERE product_type IS NULL")


def downgrade() -> None:
    op.drop_index('ix_pitch_decks_partner_id', table_name='pitch_decks')
    op.drop_constraint('fk_pitch_decks_partner_id', 'pitch_decks', type_='foreignkey')
    op.drop_column('pitch_decks', 'partner_id')

    op.drop_index('ix_commissions_pitch_deck_payment_id', table_name='commissions')
    op.drop_constraint('fk_commissions_pitch_deck_payment_id', 'commissions', type_='foreignkey')
    op.drop_column('commissions', 'pitch_deck_payment_id')
    op.drop_column('commissions', 'product_type')

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'producttype') THEN
                DROP TYPE producttype;
            END IF;
        END
        $$;
    """)
