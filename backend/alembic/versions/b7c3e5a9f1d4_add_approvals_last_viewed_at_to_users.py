"""add approvals_last_viewed_at to users

Revision ID: b7c3e5a9f1d4
Revises: a4b8f1c9d2e3
Create Date: 2026-10-08 00:00:00.000000

Backs the Dashboard's "N New Requests Submitted" banner state — tracks when
an approver/admin last visited the Approvals queue, so a submission after
that point can be told apart from one they've already had a chance to see.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b7c3e5a9f1d4'
down_revision: Union[str, None] = 'a4b8f1c9d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('approvals_last_viewed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'approvals_last_viewed_at')
