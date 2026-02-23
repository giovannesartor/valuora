"""Add v3 engine columns to analyses

Revision ID: 002
Revises: 001
Create Date: 2025-01-15
"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('analyses', sa.Column('ebitda', sa.Float(), nullable=True))
    op.add_column('analyses', sa.Column('recurring_revenue_pct', sa.Float(), server_default='0.0', nullable=True))
    op.add_column('analyses', sa.Column('num_employees', sa.Integer(), server_default='0', nullable=True))
    op.add_column('analyses', sa.Column('years_in_business', sa.Integer(), server_default='3', nullable=True))
    op.add_column('analyses', sa.Column('previous_investment', sa.Float(), server_default='0.0', nullable=True))
    op.add_column('analyses', sa.Column('qualitative_answers', sa.JSON(), nullable=True))
    op.add_column('analyses', sa.Column('dcf_weight', sa.Float(), server_default='0.6', nullable=True))
    op.add_column('analyses', sa.Column('custom_exit_multiple', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('analyses', 'custom_exit_multiple')
    op.drop_column('analyses', 'dcf_weight')
    op.drop_column('analyses', 'qualitative_answers')
    op.drop_column('analyses', 'previous_investment')
    op.drop_column('analyses', 'years_in_business')
    op.drop_column('analyses', 'num_employees')
    op.drop_column('analyses', 'recurring_revenue_pct')
    op.drop_column('analyses', 'ebitda')
