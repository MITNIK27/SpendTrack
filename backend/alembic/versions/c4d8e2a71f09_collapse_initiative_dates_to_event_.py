"""collapse initiative start/end date into a single event_date

Revision ID: c4d8e2a71f09
Revises: b3f2a9d6c1e4
Create Date: 2026-09-08 00:00:00.000000

Stakeholder feedback: the initiative form doesn't need a start/end date range —
one "Date of Event" is enough, with fuller detail expected to live in the
free-text objective/description instead. `start_date` is renamed to
`event_date` (data preserved); `end_date` is dropped.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c4d8e2a71f09'
down_revision: Union[str, None] = 'b3f2a9d6c1e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('initiatives', 'start_date', new_column_name='event_date')
    op.drop_column('initiatives', 'end_date')


def downgrade() -> None:
    op.add_column('initiatives', sa.Column('end_date', sa.Date(), nullable=True))
    op.alter_column('initiatives', 'event_date', new_column_name='start_date')
