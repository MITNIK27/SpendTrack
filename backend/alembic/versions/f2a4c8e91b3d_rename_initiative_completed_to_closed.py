"""rename initiative status 'completed' to 'closed'

Revision ID: f2a4c8e91b3d
Revises: d1a2b3c4e5f6
Create Date: 2026-09-17 00:00:00.000000

Stakeholder feedback: "Completed" read as if the initiative's underlying
goal/event was successfully accomplished, which isn't what auto-closing on
"every spend request decided" actually means. Renaming the enum value itself
(not just a frontend label) so the API/DB stay honest about what the status
represents.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'f2a4c8e91b3d'
down_revision: Union[str, None] = 'd1a2b3c4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE initiative_status RENAME VALUE 'completed' TO 'closed'")


def downgrade() -> None:
    op.execute("ALTER TYPE initiative_status RENAME VALUE 'closed' TO 'completed'")
