"""add composite index on analyses (user_id, deleted_at, created_at)

Revision ID: 007_composite_index
Revises: 006_add_deleted_at
Create Date: 2025-02-24

"""
from alembic import op

revision = '007_composite_index'
down_revision = '006_add_deleted_at'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        'ix_analyses_user_deleted_created',
        'analyses',
        ['user_id', 'deleted_at', 'created_at'],
    )


def downgrade():
    op.drop_index('ix_analyses_user_deleted_created', table_name='analyses')
