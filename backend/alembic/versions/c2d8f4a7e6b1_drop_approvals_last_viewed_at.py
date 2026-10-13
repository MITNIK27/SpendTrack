"""drop approvals_last_viewed_at from users

Revision ID: c2d8f4a7e6b1
Revises: b7c3e5a9f1d4
Create Date: 2026-10-09 00:00:00.000000

The Dashboard's "new vs. seen" banner mechanism this column backed was
replaced by a "Pending Approvals" preview table that always just shows
what's currently pending — no seen/unseen distinction left to track.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c2d8f4a7e6b1'
down_revision: Union[str, None] = 'b7c3e5a9f1d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('users', 'approvals_last_viewed_at')


def downgrade() -> None:
    op.add_column('users', sa.Column('approvals_last_viewed_at', sa.DateTime(timezone=True), nullable=True))
