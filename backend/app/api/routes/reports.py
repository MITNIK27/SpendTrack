from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.user import User
from app.schemas.alert import AlertItem
from app.schemas.report import SpendRequestReportRow, SpendSummaryResponse, SpendTrendsResponse
from app.services import alert_service, report_service
from app.services.csv_export import csv_response
from app.services.report_service import ReportFilters

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/alerts", response_model=list[AlertItem])
def alerts(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("approver", "admin")),
) -> list[AlertItem]:
    return alert_service.list_alerts(db)


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
    user: User = Depends(require_role("approver", "admin")),
) -> StreamingResponse:
    summary = report_service.spend_summary(db, filters)
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
    user: User = Depends(require_role("approver", "admin")),
) -> StreamingResponse:
    rows = report_service.spend_request_rows(db, filters)
    return csv_response(
        filename="spend-requests.csv",
        header=[
            "Request ID", "Description", "Initiative", "Category", "Requester", "Vendor",
            "Requested", "Approved", "Actual", "Status",
            "Decided By", "Decision Comment",
        ],
        rows=[
            [
                row.id, row.description or "", row.initiative_name, row.category_name, row.requester_name,
                row.vendor or "", row.requested_amount,
                row.approved_amount or "", row.actual_amount or "", row.status,
                row.decided_by or "", row.decision_comment or "",
            ]
            for row in rows
        ],
    )
