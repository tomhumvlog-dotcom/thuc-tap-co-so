"""Store AI image detection result on uploaded media.

Revision ID: 20261016_05
Revises: 20260925_04
"""

import sqlalchemy as sa

from alembic import op

revision = "20261016_05"
down_revision = "20260925_04"
branch_labels = None
depends_on = None


def has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return column in {item["name"] for item in inspector.get_columns(table)}


def upgrade() -> None:
    if not has_column("media", "is_ai_generated"):
        op.add_column("media", sa.Column("is_ai_generated", sa.Boolean(), nullable=True))


def downgrade() -> None:
    if has_column("media", "is_ai_generated"):
        op.drop_column("media", "is_ai_generated")
