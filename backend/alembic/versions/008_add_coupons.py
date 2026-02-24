"""add coupons table and coupon_code to payments

Revision ID: 008_add_coupons
Revises: 007_composite_index
Create Date: 2025-06-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '008_add_coupons'
down_revision = '007_composite_index'
branch_labels = None
depends_on = None


def upgrade():
    # ── Coupons table ──
    op.create_table(
        'coupons',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('discount_pct', sa.Float(), nullable=False),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('used_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_coupons_code', 'coupons', ['code'], unique=True)

    # ── Migrate hardcoded coupon "PRIMEIRA" → DB row ──
    op.execute("""
        INSERT INTO coupons (code, description, discount_pct, max_uses, is_active)
        VALUES ('PRIMEIRA', 'Desconto de 10% para primeiro acesso', 0.10, NULL, true)
        ON CONFLICT (code) DO NOTHING
    """)

    # ── Add coupon_code column to payments ──
    op.add_column('payments', sa.Column('coupon_code', sa.String(50), nullable=True))


def downgrade():
    op.drop_column('payments', 'coupon_code')
    op.drop_index('ix_coupons_code', table_name='coupons')
    op.drop_table('coupons')
