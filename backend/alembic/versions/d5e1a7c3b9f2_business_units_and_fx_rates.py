"""business units, spend_requests/initiatives.business_unit_id, fx_rates

Revision ID: d5e1a7c3b9f2
Revises: c2d8f4a7e6b1
Create Date: 2026-11-25 00:00:00.000000

Safe to apply before the matching backend deploy: spend_requests.business_unit_id
is NOT NULL with a server default of Corporate, so existing rows are filled in
by the ALTER itself and inserts from older code (which doesn't send the field)
still succeed. Everything else is purely additive.
"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "d5e1a7c3b9f2"
down_revision: Union[str, None] = "c2d8f4a7e6b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Must match app.models.business_unit.CORPORATE_BUSINESS_UNIT_ID.
CORPORATE_ID = uuid.UUID("6b1f9d2e-3c4a-4e8b-9f70-c0a2e5d81b36")

BUSINESS_UNITS = ["ServiceNow", "Salesforce", "AI Led Engineering", "BFSI", "Storage", "Corporate"]

business_units_table = sa.table(
    "business_units",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("name", sa.String),
    sa.column("is_active", sa.Boolean),
    sa.column("sort_order", sa.Integer),
)


def upgrade() -> None:
    op.create_table(
        "business_units",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.bulk_insert(
        business_units_table,
        [
            {
                "id": CORPORATE_ID if name == "Corporate" else uuid.uuid4(),
                "name": name,
                "is_active": True,
                "sort_order": i,
            }
            for i, name in enumerate(BUSINESS_UNITS)
        ],
    )

    op.add_column(
        "spend_requests",
        sa.Column(
            "business_unit_id",
            sa.UUID(),
            nullable=False,
            server_default=sa.text(f"'{CORPORATE_ID}'"),
        ),
    )
    op.create_foreign_key(
        "fk_spend_requests_business_unit_id_business_units",
        "spend_requests",
        "business_units",
        ["business_unit_id"],
        ["id"],
    )

    op.add_column("initiatives", sa.Column("business_unit_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_initiatives_business_unit_id_business_units",
        "initiatives",
        "business_units",
        ["business_unit_id"],
        ["id"],
    )

    op.create_table(
        "fx_rates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("rate_to_inr", sa.Numeric(18, 6), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("currency", "as_of", name="uq_fx_rates_currency_as_of"),
    )


def downgrade() -> None:
    op.drop_table("fx_rates")
    op.drop_constraint("fk_initiatives_business_unit_id_business_units", "initiatives", type_="foreignkey")
    op.drop_column("initiatives", "business_unit_id")
    op.drop_constraint("fk_spend_requests_business_unit_id_business_units", "spend_requests", type_="foreignkey")
    op.drop_column("spend_requests", "business_unit_id")
    op.drop_table("business_units")
