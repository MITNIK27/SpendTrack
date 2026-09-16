import calendar
import uuid
from dataclasses import dataclass, replace
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.fiscal import current_fiscal_year, fiscal_month_of, fiscal_quarter_of, fiscal_year_of
from app.models.approval_action import ApprovalAction
from app.models.spend_request import SpendRequest
from app.schemas.report import (
    CategoryAverageRow,
    CategoryBreakdownRow,
    MonthlyTrendPoint,
    QuarterlyTrendPoint,
    SpendRequestReportRow,
    SpendSummaryKPIs,
    SpendSummaryResponse,
    SpendTrendsResponse,
)


@dataclass
class ReportFilters:
    """Every filter the leadership report (and its exports) can be sliced by. A
    single object rather than a long, duplicated kwarg list — the route builds one
    of these from query params and hands it to whichever service function it needs."""

    fiscal_year: int | None = None
    quarter: int | None = None
    month: int | None = None
    category_id: uuid.UUID | None = None
    subcategory_id: uuid.UUID | None = None
    initiative_id: uuid.UUID | None = None
    requester_id: uuid.UUID | None = None
    status_filter: str | None = None
    # Bypasses fiscal-year scoping entirely — "all time" ("past approvals" regardless
    # of period). Quarter/month, if also given, still apply per-row across every year.
    all_time: bool = False


def matching_spend_requests(db: Session, filters: ReportFilters) -> tuple[int | None, list[SpendRequest]]:
    """Returns (resolved_fiscal_year, matched_spend_requests) for `filters` — `None`
    for the fiscal year iff `filters.all_time`. Shared by the summary view and every
    export so they can never disagree on what "matches"."""
    # A draft is a private scratchpad, never a reportable number — excluded here
    # unconditionally, same rule as everywhere else a draft could otherwise leak.
    stmt = select(SpendRequest).where(SpendRequest.status != "draft")
    if filters.category_id is not None:
        stmt = stmt.where(SpendRequest.category_id == filters.category_id)
    if filters.subcategory_id is not None:
        stmt = stmt.where(SpendRequest.subcategory_id == filters.subcategory_id)
    if filters.initiative_id is not None:
        stmt = stmt.where(SpendRequest.initiative_id == filters.initiative_id)
    if filters.requester_id is not None:
        stmt = stmt.where(SpendRequest.created_by_id == filters.requester_id)
    if filters.status_filter is not None:
        stmt = stmt.where(SpendRequest.status == filters.status_filter)

    target_fiscal_year = None
    if not filters.all_time:
        target_fiscal_year = filters.fiscal_year if filters.fiscal_year is not None else current_fiscal_year()

    matched: list[SpendRequest] = []
    for sr in db.scalars(stmt).all():
        classification_date = sr.created_at.date()
        if target_fiscal_year is not None and fiscal_year_of(classification_date) != target_fiscal_year:
            continue
        if filters.quarter is not None and fiscal_quarter_of(classification_date) != filters.quarter:
            continue
        if filters.month is not None and classification_date.month != filters.month:
            continue
        matched.append(sr)

    return target_fiscal_year, matched


def _latest_approval_actions_by_spend_request(
    db: Session, spend_request_ids: list[uuid.UUID]
) -> dict[uuid.UUID, ApprovalAction]:
    if not spend_request_ids:
        return {}
    stmt = (
        select(ApprovalAction)
        .where(ApprovalAction.spend_request_id.in_(spend_request_ids))
        .order_by(ApprovalAction.created_at)
    )
    latest: dict[uuid.UUID, ApprovalAction] = {}
    for action in db.scalars(stmt).all():
        # Later rows overwrite earlier ones — last write wins, so this ends up
        # holding each spend request's most recent decision.
        latest[action.spend_request_id] = action
    return latest


def spend_request_rows(db: Session, filters: ReportFilters) -> list[SpendRequestReportRow]:
    """The drill-down behind the summary/KPIs — the exact same matched set, one row
    per spend request, enriched with who last decided it and their comment."""
    _, matched = matching_spend_requests(db, filters)
    latest_actions = _latest_approval_actions_by_spend_request(db, [sr.id for sr in matched])

    rows = []
    for sr in matched:
        latest_action = latest_actions.get(sr.id)
        rows.append(
            SpendRequestReportRow(
                id=sr.id,
                description=sr.description,
                initiative_id=sr.initiative_id,
                initiative_name=sr.initiative.name,
                category_name=sr.category.name,
                requester_name=sr.created_by.display_name,
                vendor=sr.vendor,
                requested_amount=sr.requested_amount,
                approved_amount=sr.approved_amount,
                actual_amount=sr.actual_amount,
                status=sr.status,
                decided_at=sr.decided_at,
                decided_by=latest_action.approver.display_name if latest_action else None,
                decision_comment=latest_action.comment if latest_action else None,
            )
        )
    return rows


def spend_summary(db: Session, filters: ReportFilters) -> SpendSummaryResponse:
    target_fiscal_year, matched = matching_spend_requests(db, filters)

    total_approved = Decimal("0")
    total_actual = Decimal("0")
    by_category: dict[uuid.UUID, dict] = {}
    for sr in matched:
        approved = sr.approved_amount or Decimal("0")
        actual = sr.actual_amount or Decimal("0")
        total_approved += approved
        total_actual += actual

        row = by_category.setdefault(
            sr.category_id,
            {"category": sr.category, "approved": Decimal("0"), "actual": Decimal("0")},
        )
        row["approved"] += approved
        row["actual"] += actual

    return SpendSummaryResponse(
        fiscal_year=target_fiscal_year,
        matched_spend_request_count=len(matched),
        kpis=SpendSummaryKPIs(
            fy_spend_approved=str(total_approved),
            fy_spend_actual=str(total_actual),
            fy_spend_available=str(total_approved - total_actual),
        ),
        by_category=[
            CategoryBreakdownRow(
                category_id=cat_id,
                category_code=row["category"].code,
                category_name=row["category"].name,
                approved=str(row["approved"]),
                actual=str(row["actual"]),
                balance=str(row["approved"] - row["actual"]),
            )
            for cat_id, row in sorted(by_category.items(), key=lambda kv: kv[1]["category"].sort_order)
        ],
    )


def spend_trends(db: Session, filters: ReportFilters) -> SpendTrendsResponse:
    """Feeds the leadership dashboard's charts: the same matched set as
    `spend_summary`, but bucketed by calendar month, fiscal quarter, and
    category — a monthly trend line, a quarterly bar, and a per-category
    monthly average all need the matched requests grouped differently than a
    single running total does.

    Month/quarter are dropped from the filters here on purpose: those two
    exist to narrow the *summary* to one slice, but a trend chart showing
    "the shape of spend across the year" would collapse to a single point if
    it obeyed them. Category/initiative/requester/etc. filters still apply.
    """
    trend_filters = replace(filters, quarter=None, month=None)
    target_fiscal_year, matched = matching_spend_requests(db, trend_filters)

    monthly_buckets: dict[tuple[int, int], dict] = {}
    quarterly_buckets: dict[int, dict] = {q: {"approved": Decimal("0"), "actual": Decimal("0")} for q in (1, 2, 3, 4)}
    category_totals: dict[uuid.UUID, dict] = {}
    category_months: dict[uuid.UUID, set[tuple[int, int]]] = {}

    for sr in matched:
        classification_date = sr.created_at.date()
        approved = sr.approved_amount or Decimal("0")
        actual = sr.actual_amount or Decimal("0")

        month_key = (classification_date.year, classification_date.month)
        month_bucket = monthly_buckets.setdefault(month_key, {"approved": Decimal("0"), "actual": Decimal("0")})
        month_bucket["approved"] += approved
        month_bucket["actual"] += actual

        quarterly_buckets[fiscal_quarter_of(classification_date)]["approved"] += approved
        quarterly_buckets[fiscal_quarter_of(classification_date)]["actual"] += actual

        cat_row = category_totals.setdefault(
            sr.category_id,
            {"category": sr.category, "approved": Decimal("0"), "actual": Decimal("0")},
        )
        cat_row["approved"] += approved
        cat_row["actual"] += actual
        category_months.setdefault(sr.category_id, set()).add(month_key)

    monthly = [
        MonthlyTrendPoint(
            month_label=f"{calendar.month_abbr[month]} {year}",
            approved=str(bucket["approved"]),
            actual=str(bucket["actual"]),
        )
        # Fiscal order (Apr→Mar), not calendar order — matches how the rest of
        # the dashboard reads a fiscal year.
        for (year, month), bucket in sorted(
            monthly_buckets.items(), key=lambda kv: fiscal_month_of(date(kv[0][0], kv[0][1], 1))
        )
    ]

    quarterly = [
        QuarterlyTrendPoint(quarter=q, approved=str(bucket["approved"]), actual=str(bucket["actual"]))
        for q, bucket in sorted(quarterly_buckets.items())
    ]

    category_monthly_average = [
        CategoryAverageRow(
            category_id=cat_id,
            category_code=row["category"].code,
            category_name=row["category"].name,
            average_monthly_approved=str(row["approved"] / len(category_months[cat_id])),
            average_monthly_actual=str(row["actual"] / len(category_months[cat_id])),
        )
        for cat_id, row in sorted(category_totals.items(), key=lambda kv: kv[1]["category"].sort_order)
    ]

    return SpendTrendsResponse(
        fiscal_year=target_fiscal_year,
        monthly=monthly,
        quarterly=quarterly,
        category_monthly_average=category_monthly_average,
    )
