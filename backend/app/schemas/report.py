import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class SpendRequestReportRow(BaseModel):
    """One matched spend request, enriched with its latest approval decision —
    the drill-down behind a leadership-report KPI tile or category row: not just
    the amount, but who decided it and why."""

    id: uuid.UUID
    description: str | None
    initiative_id: uuid.UUID
    initiative_name: str
    category_name: str
    requester_name: str
    vendor: str | None
    requested_amount: Decimal
    approved_amount: Decimal | None
    actual_amount: Decimal | None
    status: str
    decided_at: datetime | None
    decided_by: str | None
    decision_comment: str | None


class SpendSummaryKPIs(BaseModel):
    fy_spend_approved: str
    fy_spend_actual: str
    fy_spend_available: str


class CategoryBreakdownRow(BaseModel):
    category_id: uuid.UUID
    category_code: str
    category_name: str
    approved: str
    actual: str
    balance: str


class SpendSummaryResponse(BaseModel):
    fiscal_year: int | None  # None means "all time" (all_time=True)
    matched_spend_request_count: int
    kpis: SpendSummaryKPIs
    by_category: list[CategoryBreakdownRow]


class MonthlyTrendPoint(BaseModel):
    month_label: str  # e.g. "Apr 2026" — already ordered fiscal Apr→Mar by the service
    approved: str
    actual: str


class QuarterlyTrendPoint(BaseModel):
    quarter: int  # 1-4, fiscal (Q1 = Apr-Jun)
    approved: str
    actual: str


class CategoryAverageRow(BaseModel):
    category_id: uuid.UUID
    category_code: str
    category_name: str
    average_monthly_approved: str
    average_monthly_actual: str


class SpendTrendsResponse(BaseModel):
    """Feeds the leadership dashboard's BI-style charts — same matched set as
    `spend_summary`, just bucketed across time and by category instead of
    reduced to a single total."""

    fiscal_year: int | None
    monthly: list[MonthlyTrendPoint]
    quarterly: list[QuarterlyTrendPoint]
    category_monthly_average: list[CategoryAverageRow]
