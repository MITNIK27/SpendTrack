"""rename users.display_name to users.name

Revision ID: c7a2e5f9b1d4
Revises: 9b1d4f6a2c83
Create Date: 2026-09-17 00:00:00.000000

The name will now come from the person's real Google account (via Firebase Auth)
rather than being manually typed, so the column is renamed to the more generic
"name" to match. Plain column rename — no data change, every existing row's
value carries over automatically.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'c7a2e5f9b1d4'
down_revision: Union[str, None] = '9b1d4f6a2c83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "display_name", new_column_name="name")


def downgrade() -> None:
    op.alter_column("users", "name", new_column_name="display_name")
