"""Add account privacy and notification event types.

Revision ID: 20261017_06
Revises: 20261016_05
"""

import sqlalchemy as sa
from alembic import op

revision = "20261017_06"
down_revision = "20261016_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "is_private" not in {column["name"] for column in inspector.get_columns("users")}:
        op.add_column("users", sa.Column("is_private", sa.Boolean(), nullable=False, server_default=sa.false()))
    if "target_user_id" not in {column["name"] for column in inspector.get_columns("notifications")}:
        op.add_column("notifications", sa.Column("target_user_id", sa.Uuid(), nullable=True))
        if op.get_bind().dialect.name == "sqlite":
            with op.batch_alter_table("notifications") as batch:
                batch.create_foreign_key(
                    "fk_notifications_target_user_id_users",
                    "users",
                    ["target_user_id"],
                    ["id"],
                    ondelete="SET NULL",
                )
        else:
            op.create_foreign_key(
                "fk_notifications_target_user_id_users", "notifications", "users",
                ["target_user_id"], ["id"], ondelete="SET NULL"
            )
        op.create_index("ix_notifications_target_user_id", "notifications", ["target_user_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'POST'")
        op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'BOOKMARK'")


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "is_private" in {column["name"] for column in inspector.get_columns("users")}:
        op.drop_column("users", "is_private")
    if "target_user_id" in {column["name"] for column in inspector.get_columns("notifications")}:
        op.drop_index("ix_notifications_target_user_id", table_name="notifications")
        if op.get_bind().dialect.name == "sqlite":
            with op.batch_alter_table("notifications") as batch:
                batch.drop_constraint("fk_notifications_target_user_id_users", type_="foreignkey")
        else:
            op.drop_constraint("fk_notifications_target_user_id_users", "notifications", type_="foreignkey")
        op.drop_column("notifications", "target_user_id")
