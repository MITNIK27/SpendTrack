import calendar
import uuid
from dataclasses import dataclass, replace
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.fiscal import current_fiscal_year, fiscal_month_of, fiscal_quarter_of, fiscal_year_of
from app.models.approval_action import ApprovalAction
from app.models.category import Category
from app.models.initiative import Initiative
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

_STATUS_BY_INITIATIVE_BUDGET_DECISION = {None: "submitted", "approved": "approved", "rejected": "rejected"}


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


@dataclass
class ReportableSpend:
    """A uniform view over anything reportable: a real SpendRequest line, or an
    initiative's own top-line budget when it has no breakdown rows of its own
    (decided directly on the Initiative — see initiative_service.decide_budget).
    Never persisted; built fresh for each report call so the two very
    different underlying rows (a spend-breakdown line vs. a whole initiative's
    budget) can be summed/bucketed/trended identically without faking one as
    the other in the database."""

    id: uuid.UUID
    description: str | None
    initiative_id: uuid.UUID
    initiative_name: str
    category_id: uuid.UUID | None
    category: Category | None
    subcategory_id: uuid.UUID | None
    requester_id: uuid.UUID
    requester_name: str
    vendor: str | None
    requested_amount: Decimal
    approved_amount: Decimal | None
    actual_amount: Decimal | None
    status: str
    created_at: datetime
    decided_at: datetime | None
    decided_by: str | None
    decision_comment: str | None
    is_initiative_budget: bool


def _reportable_from_spend_request(sr: SpendRequest, latest_action: ApprovalAction | None) -> ReportableSpend:
    return ReportableSpend(
        id=sr.id,
        description=sr.description,
        initiative_id=sr.initiative_id,
        initiative_name=sr.initiative.name,
        category_id=sr.category_id,
        category=sr.category,
        subcategory_id=sr.subcategory_id,
        requester_id=sr.created_by_id,
        requester_name=sr.created_by.name,
        vendor=sr.vendor,
        requested_amount=sr.requested_amount,
        approved_amount=sr.approved_amount,
        actual_amount=sr.actual_amount,
        status=sr.status,
        created_at=sr.created_at,
        decided_at=sr.decided_at,
        decided_by=latest_action.approver.name if latest_action else None,
        decision_comment=latest_action.comment if latest_action else None,
        is_initiative_budget=False,
    )


def _reportable_from_initiative_budget(initiative: Initiative) -> ReportableSpend:
    return ReportableSpend(
        id=initiative.id,
        description=f"{initiative.name} — total requested budget",
        initiative_id=initiative.id,
        initiative_name=initiative.name,
        category_id=initiative.category_id,
        category=initiative.category,
        subcategory_id=None,
        requester_id=initiative.owner_id,
        requester_name=initiative.owner.name,
        vendor=None,
        requested_amount=initiative.estimated_total_budget,
        approved_amount=initiative.budget_approved_amount,
        actual_amount=None,
        status=_STATUS_BY_INITIATIVE_BUDGET_DECISION[initiative.budget_decision],
        created_at=initiative.created_at,
        decided_at=initiative.budget_decided_at,
        decided_by=initiative.budget_decided_by.name if initiative.budget_decided_by_id else None,
        decision_comment=initiative.budget_decision_comment,
        is_initiative_budget=True,
    )


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


def matching_spend_requests(db: Session, filters: ReportFilters) -> tuple[int | None, list[ReportableSpend]]:
    """Returns (resolved_fiscal_year, matched_rows) for `filters` — `None` for the
    fiscal year iff `filters.all_time`. Shared by the summary view and every
    export so they can never disagree on what "matches". A row is either a real
    SpendRequest line, or (when it has no breakdown of its own) an initiative's
    own decided-or-pending budget."""
    # A draft is a private scratchpad, never a reportable number — excluded here
    # unconditionally, same rule as everywhere else a draft could otherwise leak.
    spend_requests = db.scalars(select(SpendRequest).where(SpendRequest.status != "draft")).all()
    latest_actions = _latest_approval_actions_by_spend_request(db, [sr.id for sr in spend_requests])
    candidates = [_reportable_from_spend_request(sr, latest_actions.get(sr.id)) for sr in spend_requests]

    has_spend_requests = select(SpendRequest.id).where(SpendRequest.initiative_id == Initiative.id).exists()
    budget_only_initiatives = db.scalars(
        select(Initiative)
        .where(Initiative.status != "draft")
        .where(Initiative.estimated_total_budget.isnot(None))
        .where(~has_spend_requests)
    ).all()
    candidates += [_reportable_from_initiative_budget(i) for i in budget_only_initiatives]

    if filters.category_id is not None:
        candidates = [r for r in candidates if r.category_id == filters.category_id]
    # A budget-only row has no subcategory at all — filtering it out here is
    # correct, not a special case: it simply never has one.
    if filters.subcategory_id is not None:
        candidates = [r for r in candidates if r.subcategory_id == filters.subcategory_id]
    if filters.initiative_id is not None:
        candidates = [r for r in candidates if r.initiative_id == filters.initiative_id]
    if filters.requester_id is not None:
        candidates = [r for r in candidates if r.requester_id == filters.requester_id]
    if filters.status_filter is not None:
        candidates = [r for r in candidates if r.status == filters.status_filter]

    target_fiscal_year = None
    if not filters.all_time:
        target_fiscal_year = filters.fiscal_year if filters.fiscal_year is not None else current_fiscal_year()

    matched: list[ReportableSpend] = []
    for row in candidates:
        classification_date = row.created_at.date()
        if target_fiscal_year is not None and fiscal_year_of(classification_date) != target_fiscal_year:
            continue
        if filters.quarter is not None and fiscal_quarter_of(classification_date) != filters.quarter:
            continue
        if filters.month is not None and classification_date.month != filters.month:
            continue
        matched.append(row)

    return target_fiscal_year, matched


def spend_request_rows(db: Session, filters: ReportFilters) -> list[SpendRequestReportRow]:
    """The drill-down behind the summary/KPIs — the exact same matched set, one row
    per spend request (or budget-only initiative), enriched with who last decided
    it and their comment."""
    _, matched = matching_spend_requests(db, filters)
    return [
        SpendRequestReportRow(
            id=row.id,
            description=row.description,
            initiative_id=row.initiative_id,
            initiative_name=row.initiative_name,
            category_name=row.category.name if row.category else "Uncategorized",
            requester_name=row.requester_name,
            vendor=row.vendor,
            requested_amount=row.requested_amount,
            approved_amount=row.approved_amount,
            actual_amount=row.actual_amount,
            status=row.status,
            decided_at=row.decided_at,
            decided_by=row.decided_by,
            decision_comment=row.decision_comment,
            is_initiative_budget=row.is_initiative_budget,
        )
        for row in matched
    ]


def spend_summary(db: Session, filters: ReportFilters) -> SpendSummaryResponse:
    target_fiscal_year, matched = matching_spend_requests(db, filters)

    total_approved = Decimal("0")
    total_actual = Decimal("0")
    by_category: dict[uuid.UUID, dict] = {}
    for row in matched:
        approved = row.approved_amount or Decimal("0")
        actual = row.actual_amount or Decimal("0")
        total_approved += approved
        total_actual += actual

        # An uncategorized budget-only initiative (no category set) still
        # counts toward the totals above, it just can't be bucketed here.
        if row.category_id is None:
            continue
        cat_row = by_category.setdefault(
            row.category_id,
            {"category": row.category, "approved": Decimal("0"), "actual": Decimal("0")},
        )
        cat_row["approved"] += approved
        cat_row["actual"] += actual

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

    for row in matched:
        classification_date = row.created_at.date()
        approved = row.approved_amount or Decimal("0")
        actual = row.actual_amount or Decimal("0")

        month_key = (classification_date.year, classification_date.month)
        month_bucket = monthly_buckets.setdefault(month_key, {"approved": Decimal("0"), "actual": Decimal("0")})
        month_bucket["approved"] += approved
        month_bucket["actual"] += actual

        quarterly_buckets[fiscal_quarter_of(classification_date)]["approved"] += approved
        quarterly_buckets[fiscal_quarter_of(classification_date)]["actual"] += actual

        # As in spend_summary: uncategorized money still counts toward the
        # monthly/quarterly totals above, it just can't be bucketed by category.
        if row.category_id is None:
            continue
        cat_row = category_totals.setdefault(
            row.category_id,
            {"category": row.category, "approved": Decimal("0"), "actual": Decimal("0")},
        )
        cat_row["approved"] += approved
        cat_row["actual"] += actual
        category_months.setdefault(row.category_id, set()).add(month_key)

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
