"""add currency to initiatives

Revision ID: d1a2b3c4e5f6
Revises: c4d8e2a71f09
Create Date: 2026-09-09 00:00:00.000000

Stakeholder feedback: initiatives can now be budgeted in INR or USD. Spend
requests under an initiative inherit its currency automatically (see
spend_request_service.create), so this is the only new currency column needed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd1a2b3c4e5f6'
down_revision: Union[str, None] = 'c4d8e2a71f09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'initiatives',
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='INR'),
    )
    op.alter_column('initiatives', 'currency', server_default=None)


def downgrade() -> None:
    op.drop_column('initiatives', 'currency')
