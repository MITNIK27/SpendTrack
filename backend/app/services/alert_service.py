from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

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


def list_alerts(db: Session) -> list[AlertItem]:
    now = datetime.now(timezone.utc)
    today = now.date()
    return [
        *_pending_too_long_alerts(db, now),
        *_overspend_alerts(db),
        *_initiative_ending_soon_alerts(db, today),
        *_unutilized_budget_alerts(db, today),
    ]
