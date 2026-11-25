from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.business_unit import BusinessUnit
from app.models.category import Category
from app.models.user import User
from app.schemas.pending_request import LatestPendingRequest
from app.schemas.report import SpendRequestReportRow, SpendSummaryResponse, SpendTrendsResponse
from app.services import pending_requests_service, report_export, report_service
from app.services.csv_export import csv_response
from app.services.report_service import ReportFilters

router = APIRouter(prefix="/reports", tags=["reports"])

# Anyone signed in can download a report; what's in it depends on the role (see
# _scoped_filters). The on-screen JSON reports stay approver/admin-only.
_ANY_ROLE = ("member", "approver", "admin")


def _scoped_filters(filters: ReportFilters, user: User) -> ReportFilters:
    """A requester's export is limited to their own requests, whatever filters
    they send — approvers and admins get everything the filters match."""
    if user.role == "member":
        filters.requester_id = user.id
    return filters


def _filter_notes(db: Session, filters: ReportFilters) -> list[str]:
    notes = []
    if filters.quarter is not None:
        notes.append(f"Quarter: Q{filters.quarter}")
    if filters.month is not None:
        notes.append(f"Month: {datetime(2000, filters.month, 1):%B}")
    if filters.category_id is not None and (category := db.get(Category, filters.category_id)):
        notes.append(f"Category: {category.name}")
    if filters.business_unit_id is not None and (unit := db.get(BusinessUnit, filters.business_unit_id)):
        notes.append(f"Business unit: {unit.name}")
    if filters.requester_id is not None and (requester := db.get(User, filters.requester_id)):
        notes.append(f"Requester: {requester.name}")
    return notes


@router.get("/latest-pending-requests", response_model=list[LatestPendingRequest])
def latest_pending_requests(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("approver", "admin")),
) -> list[LatestPendingRequest]:
    """Feeds the Dashboard's "Pending Approvals" preview table — the 3
    most-recently-submitted requests still awaiting a decision."""
    initiatives = pending_requests_service.latest_pending_requests(db, limit=3)
    return [
        LatestPendingRequest(
            id=i.id,
            name=i.name,
            owner_name=i.owner.name,
            estimated_total_budget=i.estimated_total_budget,
            currency=i.currency,
        )
        for i in initiatives
    ]


@router.get("/spend-summary", response_model=SpendSummaryResponse)
def spend_summary(
    filters: ReportFilters = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("approver", "admin")),
) -> SpendSummaryResponse:
    return report_service.spend_summary(db, filters)


@router.get("/spend-summary/export")
def export_spend_summary_csv(
    filters: ReportFilters = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*_ANY_ROLE)),
) -> StreamingResponse:
    summary = report_service.spend_summary(db, _scoped_filters(filters, user))
    period = f"fy{summary.fiscal_year}" if summary.fiscal_year is not None else "all-time"
    return csv_response(
        filename=f"spend-summary-{period}.csv",
        header=["Category Code", "Category Name", "Approved", "Actual", "Balance"],
        rows=[
            [row.category_code, row.category_name, row.approved, row.actual, row.balance]
            for row in summary.by_category
        ],
    )


@router.get("/spend-trends", response_model=SpendTrendsResponse)
def spend_trends(
    filters: ReportFilters = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("approver", "admin")),
) -> SpendTrendsResponse:
    """Feeds the leadership dashboard's charts: monthly trend, quarterly bar,
    and average monthly spend by category."""
    return report_service.spend_trends(db, filters)


@router.get("/spend-requests", response_model=list[SpendRequestReportRow])
def spend_requests(
    filters: ReportFilters = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("approver", "admin")),
) -> list[SpendRequestReportRow]:
    """The drill-down behind a KPI tile or category row: the individual spend
    requests that make up the matched total, each with its latest decision
    (who, how much, and their comment) — not just the aggregate number."""
    return report_service.spend_request_rows(db, filters)


@router.get("/spend-requests/export")
def export_spend_requests_csv(
    filters: ReportFilters = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*_ANY_ROLE)),
) -> StreamingResponse:
    rows = report_service.spend_request_rows(db, _scoped_filters(filters, user))
    return csv_response(
        filename="spend-requests.csv",
        header=[
            "Request ID", "Date", "Description", "Initiative", "Category", "Business Unit", "Requester", "Vendor",
            "Currency", "Requested", "Approved", "Actual", "Status",
            "Decided By", "Decision Comment",
        ],
        rows=[
            [
                row.id, row.created_at.date().isoformat(), row.description or "", row.initiative_name,
                row.category_name, row.business_unit_name, row.requester_name,
                row.vendor or "", row.currency, row.requested_amount,
                row.approved_amount or "", row.actual_amount or "", row.status,
                row.decided_by or "", row.decision_comment or "",
            ]
            for row in rows
        ],
    )


_EXPORT_MEDIA_TYPES = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


@router.get("/export")
def export_report(
    file_format: Literal["xlsx", "pdf"] = Query(alias="format"),
    filters: ReportFilters = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*_ANY_ROLE)),
) -> Response:
    """The formatted report — an Excel workbook (Summary + Spend Requests sheets) or a
    PDF — built from the same matched set as the on-screen report and the CSV exports."""
    filters = _scoped_filters(filters, user)
    summary = report_service.spend_summary(db, filters)
    rows = report_service.spend_request_rows(db, filters)
    meta = report_export.ReportMeta(
        scope_label="My requests" if user.role == "member" else "All requests",
        generated_by=user.name,
        generated_at=datetime.now(),
        filter_notes=_filter_notes(db, filters),
    )
    builder = report_export.build_xlsx if file_format == "xlsx" else report_export.build_pdf
    period = report_export.period_label(summary).lower().replace(" ", "-")
    return Response(
        content=builder(summary, rows, meta),
        media_type=_EXPORT_MEDIA_TYPES[file_format],
        headers={"Content-Disposition": f'attachment; filename="spend-report-{period}.{file_format}"'},
    )
