"""Add cpf_cnpj to users and projection_years to analyses

Revision ID: 001
Revises: 
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add cpf_cnpj column to users table
    op.add_column('users', sa.Column('cpf_cnpj', sa.String(18), nullable=True))
    # Add projection_years column to analyses table
    op.add_column('analyses', sa.Column('projection_years', sa.Integer(), server_default='5', nullable=True))


def downgrade() -> None:
    op.drop_column('analyses', 'projection_years')
    op.drop_column('users', 'cpf_cnpj')
