"""baseline

Revision ID: e7e9b73aab48
Revises: 
Create Date: 2026-09-04 17:11:39.720597

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7e9b73aab48'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
