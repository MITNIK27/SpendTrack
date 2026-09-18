"""add last_login_at to users

Revision ID: d3f6b8a1c2e7
Revises: c7a2e5f9b1d4
Create Date: 2026-09-17 00:00:00.000001

Tracks when a user last completed a real Google sign-in (set on every
successful POST /api/auth/google), for the Admin > Users screen and for
spotting stale/never-used accounts.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd3f6b8a1c2e7'
down_revision: Union[str, None] = 'c7a2e5f9b1d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
