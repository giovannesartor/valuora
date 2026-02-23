"""add partner pix key and payout day fields

Revision ID: 004_add_partner_pix_fields
Revises: 003_add_partner_mode
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = '004_add_partner_pix_fields'
down_revision = '003_add_partner_mode'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa_inspect(bind)

    if 'partners' in inspector.get_table_names():
        existing_cols = [c['name'] for c in inspector.get_columns('partners')]

        # Create the PixKeyType enum if it doesn't exist
        pix_key_type_enum = sa.Enum('cpf', 'cnpj', 'email', 'phone', 'random', name='pixkeytype')

        if 'pix_key_type' not in existing_cols:
            pix_key_type_enum.create(bind, checkfirst=True)
            op.add_column('partners', sa.Column('pix_key_type', pix_key_type_enum, nullable=True))

        if 'pix_key' not in existing_cols:
            op.add_column('partners', sa.Column('pix_key', sa.String(255), nullable=True))

        if 'payout_day' not in existing_cols:
            op.add_column('partners', sa.Column('payout_day', sa.Integer(), server_default='15', nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa_inspect(bind)

    if 'partners' in inspector.get_table_names():
        existing_cols = [c['name'] for c in inspector.get_columns('partners')]

        if 'payout_day' in existing_cols:
            op.drop_column('partners', 'payout_day')
        if 'pix_key' in existing_cols:
            op.drop_column('partners', 'pix_key')
        if 'pix_key_type' in existing_cols:
            op.drop_column('partners', 'pix_key_type')

        op.execute("DROP TYPE IF EXISTS pixkeytype")
