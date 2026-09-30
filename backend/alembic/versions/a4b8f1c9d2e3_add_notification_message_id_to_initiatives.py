"""add notification_message_id to initiatives

Revision ID: a4b8f1c9d2e3
Revises: b7d4e1a9c3f2
Create Date: 2026-09-30 00:00:00.000001

Stores the Message-ID of the "new initiative submitted" approver email so a
later "spend request added to this initiative" email can thread as a reply
under the same conversation (see app/services/notification_service.py).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a4b8f1c9d2e3'
down_revision: Union[str, None] = 'b7d4e1a9c3f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("initiatives", sa.Column("notification_message_id", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("initiatives", "notification_message_id")
