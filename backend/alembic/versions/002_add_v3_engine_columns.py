"""Add v3 engine columns to analyses

Revision ID: 002
Revises: 001
Create Date: 2025-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def _col_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa_inspect(bind)
    return column in [c['name'] for c in insp.get_columns(table)]


def upgrade() -> None:
    cols = [
        ('ebitda', sa.Float(), None),
        ('recurring_revenue_pct', sa.Float(), '0.0'),
        ('num_employees', sa.Integer(), '0'),
        ('years_in_business', sa.Integer(), '3'),
        ('previous_investment', sa.Float(), '0.0'),
        ('qualitative_answers', sa.JSON(), None),
        ('dcf_weight', sa.Float(), '0.6'),
        ('custom_exit_multiple', sa.Float(), None),
    ]
    for name, type_, default in cols:
        if not _col_exists('analyses', name):
            op.add_column('analyses', sa.Column(name, type_, server_default=default, nullable=True))


def downgrade() -> None:
    op.drop_column('analyses', 'custom_exit_multiple')
    op.drop_column('analyses', 'dcf_weight')
    op.drop_column('analyses', 'qualitative_answers')
    op.drop_column('analyses', 'previous_investment')
    op.drop_column('analyses', 'years_in_business')
    op.drop_column('analyses', 'num_employees')
    op.drop_column('analyses', 'recurring_revenue_pct')
    op.drop_column('analyses', 'ebitda')
