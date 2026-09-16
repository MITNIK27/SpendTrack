"""simplify initiative and spend request fields

Revision ID: b3f2a9d6c1e4
Revises: 967dbbfd2a78
Create Date: 2026-09-08 00:00:00.000000

Drops the fields cut from the "New Initiative" and "New Spend Request" forms
after stakeholder review: business unit, region, client/prospect, strategic
account, campaign/program, department, purpose (initiative-side); and
justification, expected-outcome taxonomy, expected spend date, payment
frequency, tax amount, and PO tracking (spend-request-side). No historical
data is being carried forward, so the drop is unconditional.

`spend_requests.description` becomes nullable (still populated, now
auto-generated server-side when the client omits it) instead of being
dropped outright, since it can't be NULL while non-nullable and the app
still relies on it for search/reporting/alerts.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3f2a9d6c1e4'
down_revision: Union[str, None] = '967dbbfd2a78'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PAYMENT_FREQUENCY_ENUM = sa.Enum(
    'one_time', 'monthly', 'quarterly', 'annual', 'other_recurring', name='payment_frequency'
)
EXPECTED_OUTCOME_TYPE_ENUM = sa.Enum(
    'lead_generation', 'brand_visibility', 'customer_engagement', 'partnership', 'thought_leadership',
    'pr', 'market_research', 'internal_marketing', 'other', name='expected_outcome_type',
)


def upgrade() -> None:
    op.alter_column('spend_requests', 'description', existing_type=sa.Text(), nullable=True)

    op.drop_column('spend_requests', 'justification_why')
    op.drop_column('spend_requests', 'expected_outcome_type')
    op.drop_column('spend_requests', 'expected_outcome_details')
    op.drop_column('spend_requests', 'expected_spend_date')
    op.drop_column('spend_requests', 'payment_frequency')
    op.drop_column('spend_requests', 'tax_amount')
    op.drop_column('spend_requests', 'has_existing_po')
    op.drop_column('spend_requests', 'po_number')
    op.drop_column('spend_requests', 'business_unit')
    op.drop_column('spend_requests', 'region')
    op.drop_column('spend_requests', 'client_prospect')

    op.drop_column('initiatives', 'department')
    op.drop_column('initiatives', 'business_unit')
    op.drop_column('initiatives', 'region')
    op.drop_column('initiatives', 'client_prospect')
    op.drop_column('initiatives', 'strategic_account')
    op.drop_column('initiatives', 'campaign_program')
    op.drop_column('initiatives', 'description')
    op.drop_column('initiatives', 'purpose')

    PAYMENT_FREQUENCY_ENUM.drop(op.get_bind())
    EXPECTED_OUTCOME_TYPE_ENUM.drop(op.get_bind())


def downgrade() -> None:
    PAYMENT_FREQUENCY_ENUM.create(op.get_bind())
    EXPECTED_OUTCOME_TYPE_ENUM.create(op.get_bind())

    op.add_column('initiatives', sa.Column('purpose', sa.Text(), nullable=True))
    op.add_column('initiatives', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('initiatives', sa.Column('campaign_program', sa.String(), nullable=True))
    op.add_column(
        'initiatives',
        sa.Column('strategic_account', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column('initiatives', sa.Column('client_prospect', sa.String(), nullable=True))
    op.add_column('initiatives', sa.Column('region', sa.String(), nullable=True))
    op.add_column('initiatives', sa.Column('business_unit', sa.String(), nullable=True))
    op.add_column('initiatives', sa.Column('department', sa.String(), nullable=True))

    op.add_column('spend_requests', sa.Column('client_prospect', sa.String(), nullable=True))
    op.add_column('spend_requests', sa.Column('region', sa.String(), nullable=True))
    op.add_column('spend_requests', sa.Column('business_unit', sa.String(), nullable=True))
    op.add_column('spend_requests', sa.Column('po_number', sa.String(), nullable=True))
    op.add_column(
        'spend_requests',
        sa.Column('has_existing_po', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column('spend_requests', sa.Column('tax_amount', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column(
        'spend_requests',
        sa.Column('payment_frequency', PAYMENT_FREQUENCY_ENUM, nullable=False, server_default='one_time'),
    )
    op.add_column('spend_requests', sa.Column('expected_spend_date', sa.Date(), nullable=True))
    op.add_column('spend_requests', sa.Column('expected_outcome_details', sa.Text(), nullable=True))
    op.add_column('spend_requests', sa.Column('expected_outcome_type', EXPECTED_OUTCOME_TYPE_ENUM, nullable=True))
    op.add_column('spend_requests', sa.Column('justification_why', sa.Text(), nullable=True))

    op.alter_column('spend_requests', 'description', existing_type=sa.Text(), nullable=False)
