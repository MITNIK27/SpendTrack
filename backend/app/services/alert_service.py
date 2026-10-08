from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog
from app.models.initiative import Initiative
from app.models.spend_request import SpendRequest
from app.schemas.alert import AlertItem
from app.services.approval_service import PENDING_DECISION_STATUSES

# Tunable thresholds — deliberately plain module constants (not admin-configurable
# yet) so the four rules in docs' "Spend Control Alerts" section are easy to find
# and adjust in one place.
PENDING_TOO_LONG_DAYS = 3
INITIATIVE_ENDING_SOON_DAYS = 14
SIGNIFICANT_UNUTILIZED_RATIO = Decimal("0.10")


def _pending_too_long_alerts(db: Session, now: datetime) -> list[AlertItem]:
    cutoff = now - timedelta(days=PENDING_TOO_LONG_DAYS)
    stmt = select(SpendRequest).where(
        SpendRequest.status.in_(PENDING_DECISION_STATUSES),
        SpendRequest.submitted_at.isnot(None),
        SpendRequest.submitted_at <= cutoff,
    )
    alerts = []
    for sr in db.scalars(stmt).all():
        waiting_days = (now - sr.submitted_at).days
        alerts.append(
            AlertItem(
                type="approval_pending",
                severity="warning",
                message=f"\"{sr.description}\" has been awaiting a decision for {waiting_days} day(s).",
                entity_type="spend_request",
                entity_id=sr.id,
            )
        )
    return alerts


def _overspend_alerts(db: Session) -> list[AlertItem]:
    stmt = select(SpendRequest).where(
        SpendRequest.status != "draft",
        SpendRequest.approved_amount.isnot(None),
        SpendRequest.actual_amount.isnot(None),
        SpendRequest.actual_amount > SpendRequest.approved_amount,
    )
    alerts = []
    for sr in db.scalars(stmt).all():
        overage = sr.actual_amount - sr.approved_amount
        alerts.append(
            AlertItem(
                type="overspend",
                severity="critical",
                message=f"\"{sr.description}\" actual spend exceeds its approved amount by {overage}.",
                entity_type="spend_request",
                entity_id=sr.id,
            )
        )
    return alerts


def _initiative_ending_soon_alerts(db: Session, today: date) -> list[AlertItem]:
    """Flags an active initiative whose event is coming up soon — named for the
    original "ends soon" concept, now keyed off the single `event_date`."""
    horizon = today + timedelta(days=INITIATIVE_ENDING_SOON_DAYS)
    stmt = select(Initiative).where(
        Initiative.status == "active",
        Initiative.event_date.isnot(None),
        Initiative.event_date >= today,
        Initiative.event_date <= horizon,
    )
    alerts = []
    for initiative in db.scalars(stmt).all():
        days_left = (initiative.event_date - today).days
        alerts.append(
            AlertItem(
                type="initiative_ending_soon",
                severity="warning",
                message=f"\"{initiative.name}\" happens in {days_left} day(s).",
                entity_type="initiative",
                entity_id=initiative.id,
            )
        )
    return alerts


def _unutilized_budget_alerts(db: Session, today: date) -> list[AlertItem]:
    stmt = select(Initiative).where(Initiative.event_date.isnot(None), Initiative.event_date < today)
    alerts = []
    for initiative in db.scalars(stmt).all():
        approved = Decimal("0")
        actual = Decimal("0")
        for sr in initiative.spend_requests:
            if sr.status == "draft":
                continue
            approved += sr.approved_amount or Decimal("0")
            actual += sr.actual_amount or Decimal("0")
        if approved <= 0:
            continue
        balance = approved - actual
        if balance / approved >= SIGNIFICANT_UNUTILIZED_RATIO:
            alerts.append(
                AlertItem(
                    type="unutilized_budget",
                    severity="warning",
                    message=f"\"{initiative.name}\" has {balance} of its approved budget unspent after the event.",
                    entity_type="initiative",
                    entity_id=initiative.id,
                )
            )
    return alerts


def _pending_spend_requests(db: Session, since: datetime | None = None) -> list[SpendRequest]:
    conditions = [SpendRequest.status.in_(PENDING_DECISION_STATUSES), SpendRequest.submitted_at.isnot(None)]
    if since is not None:
        conditions.append(SpendRequest.submitted_at > since)
    return list(db.scalars(select(SpendRequest).where(*conditions)).all())


def _pending_budget_only_initiatives(db: Session, since: datetime | None = None) -> list[Initiative]:
    """Initiatives with no spend breakdown of their own yet, still awaiting a
    decision on their own budget. These have no submitted_at of their own —
    `since` is answered via the activity log entry submit_initiative writes."""
    budget_only = [
        i
        for i in db.scalars(
            select(Initiative).where(Initiative.status == "active", Initiative.budget_decision.is_(None))
        ).all()
        if i.spend_request_count == 0
    ]
    if since is None or not budget_only:
        return budget_only
    submitted_ids = set(
        db.scalars(
            select(ActivityLog.entity_id).where(
                ActivityLog.entity_type == "initiative",
                ActivityLog.action == "initiative_submitted",
                ActivityLog.entity_id.in_([i.id for i in budget_only]),
                ActivityLog.created_at > since,
            )
        ).all()
    )
    return [i for i in budget_only if i.id in submitted_ids]


def count_new_requests(db: Session, since: datetime | None) -> int:
    """Distinct REQUESTS (initiatives) with something newly (re)submitted
    since the approver's last visit to the Approvals queue — drives the "N
    New Requests Submitted" banner. Counts *initiatives*, not spend-breakdown
    rows: one request submitted with a 3-line breakdown is one new request,
    not three. since=None (never visited) counts every currently-pending
    request, so a first-time approver sees the real queue size instead of
    zero."""
    new_initiative_ids = {sr.initiative_id for sr in _pending_spend_requests(db, since)}
    new_initiative_ids |= {i.id for i in _pending_budget_only_initiatives(db, since)}
    return len(new_initiative_ids)


def count_pending_items(db: Session) -> int:
    """Total shown by the Dashboard's fallback "N Pending Items" banner, once
    there's nothing new left to call out. Every spend-request-level item
    currently awaiting a decision, regardless of how long it's been waiting
    (list_alerts's own _pending_too_long_alerts only flags the subset stale
    3+ days — too narrow to serve as "the total backlog size"), plus the
    other three alert types' own counts (each about a different entity, so
    none of this double-counts)."""
    today = datetime.now(timezone.utc).date()
    total = len(_pending_spend_requests(db)) + len(_pending_budget_only_initiatives(db))
    total += len(_overspend_alerts(db)) + len(_initiative_ending_soon_alerts(db, today)) + len(_unutilized_budget_alerts(db, today))
    return total


def list_alerts(db: Session) -> list[AlertItem]:
    now = datetime.now(timezone.utc)
    today = now.date()
    return [
        *_pending_too_long_alerts(db, now),
        *_overspend_alerts(db),
        *_initiative_ending_soon_alerts(db, today),
        *_unutilized_budget_alerts(db, today),
    ]
