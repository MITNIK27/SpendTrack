"""seed dynamic field schema for Conference/Advertising/Customer-Event categories

Revision ID: ef8f1c8a91a2
Revises: ef47cbb3e1bb
Create Date: 2026-09-05 15:00:00.000000

Seeds Subcategory.dynamic_field_schema documented in
docs/dynamic-field-schema.md (the canonical source — keep this migration's
data in sync with that file if the question set ever changes).
"""
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "ef8f1c8a91a2"
down_revision: Union[str, None] = "ef47cbb3e1bb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMAS: dict[str, list[dict]] = {
    "A": [
        {"key": "number_of_attendees", "label": "Number of attendees", "type": "number", "required": False},
        {
            "key": "expected_customer_meetings",
            "label": "Expected customer meetings",
            "type": "number",
            "required": False,
        },
        {"key": "target_accounts", "label": "Target accounts", "type": "text", "required": False},
        {"key": "expected_leads", "label": "Expected leads", "type": "number", "required": False},
        {"key": "speaking_opportunity", "label": "Speaking opportunity?", "type": "boolean", "required": False},
        {"key": "has_booth", "label": "Booth?", "type": "boolean", "required": False},
        {"key": "sponsorship_level", "label": "Sponsorship level", "type": "text", "required": False},
    ],
    "B": [
        {"key": "campaign_objective", "label": "Campaign objective", "type": "text", "required": False},
        {"key": "target_geography", "label": "Target geography", "type": "text", "required": False},
        {"key": "target_audience", "label": "Target audience", "type": "text", "required": False},
        {"key": "campaign_duration", "label": "Campaign duration", "type": "text", "required": False},
        {
            "key": "expected_impressions_leads",
            "label": "Expected impressions/leads",
            "type": "text",
            "required": False,
        },
        {"key": "landing_page", "label": "Landing page", "type": "text", "required": False},
        {
            "key": "expected_cpl_conversion",
            "label": "Expected CPL / conversion",
            "type": "text",
            "required": False,
        },
    ],
    "F": [
        {"key": "customer_prospect_name", "label": "Customer/prospect name", "type": "text", "required": False},
        {"key": "purpose", "label": "Purpose", "type": "text", "required": False},
        {"key": "number_of_attendees", "label": "Number of attendees", "type": "number", "required": False},
        {
            "key": "expected_business_outcome",
            "label": "Expected business outcome",
            "type": "text",
            "required": False,
        },
        {"key": "account_opportunity", "label": "Account opportunity", "type": "text", "required": False},
    ],
}


def upgrade() -> None:
    conn = op.get_bind()
    for code, schema in SCHEMAS.items():
        conn.execute(
            sa.text(
                "UPDATE subcategories SET dynamic_field_schema = CAST(:schema AS jsonb) "
                "FROM categories WHERE subcategories.category_id = categories.id AND categories.code = :code"
            ),
            {"schema": json.dumps(schema), "code": code},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for code in SCHEMAS:
        conn.execute(
            sa.text(
                "UPDATE subcategories SET dynamic_field_schema = NULL "
                "FROM categories WHERE subcategories.category_id = categories.id AND categories.code = :code"
            ),
            {"code": code},
        )
