"""seed category taxonomy

Revision ID: 7c0e18cf5ff4
Revises: 5afc67e1597a
Create Date: 2026-09-04 00:00:00.000000

Seeds the A-Q category/subcategory taxonomy documented in docs/category-taxonomy.md
(the canonical source — keep this migration's data in sync with that file if the
taxonomy ever changes).
"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "7c0e18cf5ff4"
down_revision: Union[str, None] = "5afc67e1597a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (code, name, subcategories[])
TAXONOMY: list[tuple[str, str, list[str]]] = [
    ("A", "Conferences & Events", [
        "Conference registration", "Delegate passes", "Speaker registration", "Booth/exhibition space",
        "Sponsorship package", "Speaking slot", "Event branding", "Banner", "Backdrop",
        "Booth construction", "AV equipment", "Event collateral", "Swag", "Shipping", "Event staff",
        "Hospitality", "Customer dinner", "Networking event", "Side event", "Event photography/video",
    ]),
    ("B", "Advertising & Paid Promotion", [
        "Google Ads", "LinkedIn Ads", "Meta Ads", "YouTube Ads", "Display advertising", "Retargeting",
        "Sponsored content", "Newsletter sponsorship", "Industry publication advertising",
        "Marketplace advertising", "Job-board advertising (marketing-related)",
        "Campaign-specific paid promotion",
    ]),
    ("C", "Content & Creative", [
        "Video production", "Product videos", "Explainer videos", "Photography", "Graphic design",
        "Motion graphics", "Copywriting", "Blog/content production", "Case studies", "Whitepapers",
        "eBooks", "Brochures", "Infographics", "Creative agencies", "Freelancers",
    ]),
    ("D", "Branding & Merchandise", [
        "T-shirts", "Hoodies", "Caps", "Bags", "Pens", "Notebooks", "Mugs", "Corporate gifts",
        "Conference giveaways", "Printed materials", "Banners", "Standees", "Office branding",
        "Event branding",
    ]),
    ("E", "Travel & Accommodation", [
        "Flights", "Hotels", "Local transportation", "Airport transfers", "Car rental", "Meals",
        "Per diem", "Visa", "Travel insurance", "Conference-related travel",
    ]),
    ("F", "Customer / Prospect Engagement", [
        "Customer dinners", "Executive dinners", "Client events", "Prospect events", "Hospitality",
        "Networking events", "Customer gifts", "Prospect gifts", "Entertainment", "Roundtables",
        "Workshops", "Executive briefings",
    ]),
    ("G", "Digital Marketing", [
        "SEO", "SEM", "Website campaigns", "Landing pages", "Email campaigns", "Marketing automation",
        "Social media campaigns", "Influencer marketing", "Affiliate marketing", "Online directories",
        "Review platforms",
    ]),
    ("H", "Marketing Technology", [
        "Marketing SaaS", "Analytics tools", "SEO tools", "Email platforms",
        "CRM-related marketing tools", "Social media tools", "Content management tools",
        "Design tools", "Video tools", "Webinar platforms", "Lead-generation platforms",
        "Data providers", "Marketing AI tools",
    ]),
    ("I", "PR & Communications", [
        "PR agency", "Press releases", "Media outreach", "Journalist engagement", "Media monitoring",
        "PR campaigns", "Awards", "Award submissions", "Industry publications", "Thought leadership",
    ]),
    ("J", "Analyst / Industry Relations", [
        "Analyst subscriptions", "Analyst briefings", "Research reports", "Analyst events",
        "Industry memberships", "Industry associations", "Research studies",
    ]),
    ("K", "Partnerships & Co-Marketing", [
        "Partner events", "Joint campaigns", "Co-branded campaigns", "Partner sponsorship",
        "MDF-related expenditure", "Partner collateral", "Partner webinars", "Partner content",
    ]),
    ("L", "Website & Digital Presence", [
        "Website development specifically for marketing", "Landing pages", "Domain purchases",
        "Hosting", "CDN", "Website plugins", "Design", "Conversion optimization",
        "Tracking/analytics",
    ]),
    ("M", "Awards & Recognition", [
        "Award entry fees", "Submission fees", "Award sponsorship", "Award ceremony tickets",
        "Creative production", "PR around award wins",
    ]),
    ("N", "Research & Intelligence", [
        "Market research", "Customer research", "Surveys", "Industry reports",
        "Competitive intelligence", "Research agencies", "Data purchases",
    ]),
    ("O", "Memberships & Associations", [
        "Industry memberships", "Professional associations", "Chamber memberships",
        "Marketing organizations", "Conference memberships",
    ]),
    ("P", "Internal Marketing Initiatives", [
        "Internal campaigns", "Employer branding", "Internal events", "Employee advocacy",
        "Internal promotional material", "Recruitment marketing",
    ]),
    ("Q", "Other", []),
]

categories_table = sa.table(
    "categories",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("code", sa.String),
    sa.column("name", sa.String),
    sa.column("is_active", sa.Boolean),
    sa.column("sort_order", sa.Integer),
    sa.column("requires_freetext_description", sa.Boolean),
)

subcategories_table = sa.table(
    "subcategories",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("category_id", UUID(as_uuid=True)),
    sa.column("name", sa.String),
    sa.column("is_active", sa.Boolean),
    sa.column("sort_order", sa.Integer),
)


def upgrade() -> None:
    for i, (code, name, subcats) in enumerate(TAXONOMY):
        category_id = uuid.uuid4()
        op.execute(
            categories_table.insert().values(
                id=category_id,
                code=code,
                name=name,
                is_active=True,
                sort_order=i,
                requires_freetext_description=(code == "Q"),
            )
        )
        for j, subcat_name in enumerate(subcats):
            op.execute(
                subcategories_table.insert().values(
                    id=uuid.uuid4(),
                    category_id=category_id,
                    name=subcat_name,
                    is_active=True,
                    sort_order=j,
                )
            )


def downgrade() -> None:
    op.execute(subcategories_table.delete())
    op.execute(categories_table.delete())
