"""Add share notifications.

Revision ID: 20261018_07
Revises: 20261017_06
"""

from alembic import op

revision = "20261018_07"
down_revision = "20261017_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'SHARE'")


def downgrade() -> None:
    # PostgreSQL does not support removing individual enum values safely.
    pass
