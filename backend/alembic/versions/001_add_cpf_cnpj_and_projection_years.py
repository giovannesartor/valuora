"""Add cpf_cnpj to users and projection_years to analyses

Revision ID: 001
Revises: 
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def _col_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa_inspect(bind)
    return column in [c['name'] for c in insp.get_columns(table)]


def upgrade() -> None:
    if not _col_exists('users', 'cpf_cnpj'):
        op.add_column('users', sa.Column('cpf_cnpj', sa.String(18), nullable=True))
    if not _col_exists('analyses', 'projection_years'):
        op.add_column('analyses', sa.Column('projection_years', sa.Integer(), server_default='5', nullable=True))


def downgrade() -> None:
    op.drop_column('analyses', 'projection_years')
    op.drop_column('users', 'cpf_cnpj')
