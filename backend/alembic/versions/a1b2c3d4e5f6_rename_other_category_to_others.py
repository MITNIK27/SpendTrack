"""rename "Other" category to "Others"

Revision ID: a1b2c3d4e5f6
Revises: e8fb28cdf255
Create Date: 2026-09-24 00:00:00.000000

Pure data fix — the seeded catch-all category (code "Q") was named "Other";
corrected to "Others" per stakeholder feedback. Existing categories are
fetched dynamically from the DB, so no frontend copy change is needed
alongside this.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "e8fb28cdf255"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE categories SET name = 'Others' WHERE code = 'Q'")


def downgrade() -> None:
    op.execute("UPDATE categories SET name = 'Other' WHERE code = 'Q'")
