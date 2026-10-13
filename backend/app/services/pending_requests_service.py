import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.activity_log import ActivityLog
from app.models.initiative import Initiative
from app.models.spend_request import SpendRequest
from app.services.approval_service import PENDING_DECISION_STATUSES


def _pending_spend_requests(db: Session) -> list[SpendRequest]:
    stmt = (
        select(SpendRequest)
        .where(SpendRequest.status.in_(PENDING_DECISION_STATUSES), SpendRequest.submitted_at.isnot(None))
        .options(joinedload(SpendRequest.initiative).joinedload(Initiative.owner))
    )
    return list(db.scalars(stmt).unique().all())


def _pending_budget_only_initiatives(db: Session) -> list[Initiative]:
    """Initiatives with no spend breakdown of their own yet, still awaiting a
    decision on their own budget."""
    stmt = (
        select(Initiative)
        .where(Initiative.status == "active", Initiative.budget_decision.is_(None))
        .options(joinedload(Initiative.owner))
    )
    return [i for i in db.scalars(stmt).unique().all() if i.spend_request_count == 0]


def latest_pending_requests(db: Session, limit: int = 3) -> list[Initiative]:
    """Up to `limit` most-recently-submitted requests still awaiting a decision
    — feeds the Dashboard's "Pending Approvals" preview table. Combines
    spend-breakdown submissions (keyed by each request's latest submitted_at)
    and budget-only initiatives awaiting their own budget decision (keyed by
    their "initiative_submitted" activity-log timestamp, since they have no
    submitted_at of their own), deduped by initiative, newest-first."""
    latest_activity: dict[uuid.UUID, datetime] = {}
    initiatives_by_id: dict[uuid.UUID, Initiative] = {}

    for sr in _pending_spend_requests(db):
        iid = sr.initiative_id
        if iid not in latest_activity or sr.submitted_at > latest_activity[iid]:
            latest_activity[iid] = sr.submitted_at
            initiatives_by_id[iid] = sr.initiative

    budget_only = _pending_budget_only_initiatives(db)
    if budget_only:
        submitted_at_by_id = dict(
            db.execute(
                select(ActivityLog.entity_id, func.max(ActivityLog.created_at))
                .where(
                    ActivityLog.entity_type == "initiative",
                    ActivityLog.action == "initiative_submitted",
                    ActivityLog.entity_id.in_([i.id for i in budget_only]),
                )
                .group_by(ActivityLog.entity_id)
            ).all()
        )
        for i in budget_only:
            ts = submitted_at_by_id.get(i.id) or i.created_at
            if i.id not in latest_activity or ts > latest_activity[i.id]:
                latest_activity[i.id] = ts
                initiatives_by_id[i.id] = i

    ordered_ids = sorted(latest_activity, key=lambda iid: latest_activity[iid], reverse=True)
    return [initiatives_by_id[iid] for iid in ordered_ids[:limit]]
