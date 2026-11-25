"""move business unit from spend requests to the initiative

Revision ID: a8c4e2f6b1d9
Revises: d5e1a7c3b9f2
Create Date: 2026-11-25 12:00:00.000000

A business unit is now chosen once, for the whole marketing request, instead of per
spend-breakdown row. initiatives.business_unit_id becomes NOT NULL (default Corporate)
and spend_requests.business_unit_id is dropped.

Backfill: an initiative keeps its own business unit if it has one, otherwise takes the
business unit of its earliest spend request, otherwise Corporate. (When this was written
no initiative had spend rows split across different business units; if one ever did, the
earliest row wins and the others' values are discarded — back up first.)

NOT safe to apply before the matching backend deploy: older code still reads and writes
spend_requests.business_unit_id. Apply it together with the deploy.
"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "a8c4e2f6b1d9"
down_revision: Union[str, None] = "d5e1a7c3b9f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Must match app.models.business_unit.CORPORATE_BUSINESS_UNIT_ID.
CORPORATE_ID = uuid.UUID("6b1f9d2e-3c4a-4e8b-9f70-c0a2e5d81b36")


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE initiatives
            SET business_unit_id = COALESCE(
                initiatives.business_unit_id,
                (
                    SELECT sr.business_unit_id
                    FROM spend_requests sr
                    WHERE sr.initiative_id = initiatives.id
                    ORDER BY sr.created_at
                    LIMIT 1
                ),
                :corporate
            )
            WHERE initiatives.business_unit_id IS NULL
            """
        ).bindparams(sa.bindparam("corporate", CORPORATE_ID, type_=UUID(as_uuid=True)))
    )
    op.alter_column(
        "initiatives",
        "business_unit_id",
        existing_type=sa.UUID(),
        nullable=False,
        server_default=sa.text(f"'{CORPORATE_ID}'"),
    )
    op.drop_column("spend_requests", "business_unit_id")


def downgrade() -> None:
    op.add_column(
        "spend_requests",
        sa.Column(
            "business_unit_id",
            sa.UUID(),
            sa.ForeignKey("business_units.id"),
            nullable=False,
            server_default=sa.text(f"'{CORPORATE_ID}'"),
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE spend_requests
            SET business_unit_id = initiatives.business_unit_id
            FROM initiatives
            WHERE initiatives.id = spend_requests.initiative_id
            """
        )
    )
    op.alter_column(
        "initiatives",
        "business_unit_id",
        existing_type=sa.UUID(),
        nullable=True,
        server_default=None,
    )
