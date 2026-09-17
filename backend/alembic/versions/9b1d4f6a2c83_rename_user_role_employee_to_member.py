"""rename user role 'employee' to 'member'

Revision ID: 9b1d4f6a2c83
Revises: f2a4c8e91b3d
Create Date: 2026-09-17 00:00:00.000000

Terminology change only, same as f2a4c8e91b3d's initiative-status rename:
"Employee" read oddly for a Team Member on a spend-request/initiative (e.g. an
external contractor or a non-InfoBeans stakeholder could hold this role), so
the app now says "Member" everywhere, including the DB enum value itself, not
just the UI label. `RENAME VALUE` relabels the existing enum entry in place —
every row currently storing 'employee' reads back as 'member' automatically,
with no per-row data migration needed.
"""
from typing import Sequence, Union

from alembic import op

revision: str = '9b1d4f6a2c83'
down_revision: Union[str, None] = 'f2a4c8e91b3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role RENAME VALUE 'employee' TO 'member'")


def downgrade() -> None:
    op.execute("ALTER TYPE user_role RENAME VALUE 'member' TO 'employee'")
