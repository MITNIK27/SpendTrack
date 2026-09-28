"""add logs table

Revision ID: b7d4e1a9c3f2
Revises: a1b2c3d4e5f6
Create Date: 2026-09-25 00:00:00.000000

Persists application logs (request logs, warnings, unhandled-error stack
traces) to the database so they're queryable and survive a server restart,
instead of only appearing in the process's stdout. See app/core/logging_config.py.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b7d4e1a9c3f2"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")


def upgrade() -> None:
    log_level = postgresql.ENUM(*LOG_LEVELS, name="log_level")

    op.create_table(
        "logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("level", log_level, nullable=False),
        sa.Column("logger_name", sa.String(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("module", sa.String(), nullable=True),
        sa.Column("path", sa.String(), nullable=True),
        sa.Column("method", sa.String(length=10), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("user_email", sa.String(), nullable=True),
        sa.Column("stack_trace", sa.Text(), nullable=True),
        sa.Column("extra", postgresql.JSONB(), nullable=True),
    )
    op.create_index("ix_logs_created_at", "logs", ["created_at"])
    op.create_index("ix_logs_level", "logs", ["level"])


def downgrade() -> None:
    op.drop_index("ix_logs_level", table_name="logs")
    op.drop_index("ix_logs_created_at", table_name="logs")
    op.drop_table("logs")
    postgresql.ENUM(name="log_level").drop(op.get_bind())
