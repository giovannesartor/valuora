"""add net_value, fee_amount, installment_count to payments

Revision ID: 008_add_net_value_to_payments
Revises: 007_composite_index
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa

revision = '008_add_net_value_to_payments'
down_revision = '007_composite_index'
branch_labels = None
depends_on = None


def upgrade():
    # net_value: valor líquido após taxa Asaas (vem direto do webhook)
    op.add_column('payments', sa.Column('net_value', sa.Numeric(10, 2), nullable=True))
    # fee_amount: taxa cobrada pelo Asaas (= amount - net_value)
    op.add_column('payments', sa.Column('fee_amount', sa.Numeric(10, 2), nullable=True))
    # installment_count: número de parcelas no cartão (null = à vista / PIX / boleto)
    op.add_column('payments', sa.Column('installment_count', sa.Integer(), nullable=True))

    # Backfill: commissions now reference net_value; add net_value column too
    op.add_column('commissions', sa.Column('gross_amount', sa.Numeric(10, 2), nullable=True))
    # gross_amount = old total_amount (kept for auditing); going forward total_amount = net_value


def downgrade():
    op.drop_column('payments', 'net_value')
    op.drop_column('payments', 'fee_amount')
    op.drop_column('payments', 'installment_count')
    op.drop_column('commissions', 'gross_amount')
