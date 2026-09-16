from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.initiative import Initiative
from app.models.spend_request import SpendRequest
from app.services import activity_log_service

# A spend request that has left the decision/edit loop for good. An initiative
# is only ever auto-completed once every one of its requests lands here.
TERMINAL_SPEND_STATUSES = ("approved", "rejected", "spent", "closed")


def sync_status(db: Session, *, initiative: Initiative) -> None:
    """Keeps an Initiative's status honest relative to its spend requests, once
    it's been published (never touches draft/archived — those are manual).
    Closes it when every request under it is decided one way or another, and
    reopens it the moment new spend work starts again — nothing about a
    'closed' initiative is locked, it's just a reflection of current state."""
    if initiative.status not in ("active", "closed"):
        return
    # Queried fresh rather than via the `initiative.spend_requests` relationship,
    # which may not yet reflect a spend request added earlier in this same
    # transaction (its FK is set directly, not through the ORM collection).
    statuses = db.scalars(select(SpendRequest.status).where(SpendRequest.initiative_id == initiative.id)).all()
    if not statuses:
        return
    all_terminal = all(s in TERMINAL_SPEND_STATUSES for s in statuses)
    if all_terminal and initiative.status == "active":
        initiative.status = "closed"
        activity_log_service.record(
            db, entity_type="initiative", entity_id=initiative.id, actor=None, action="initiative_closed"
        )
    elif not all_terminal and initiative.status == "closed":
        initiative.status = "active"
        activity_log_service.record(
            db, entity_type="initiative", entity_id=initiative.id, actor=None, action="initiative_reopened"
        )


def has_submitted_spend(db: Session, initiative: Initiative) -> bool:
    """True once any spend request under this initiative has ever left draft —
    from that point on leadership may already be tracking it, so the initiative
    can only be edited, never deleted outright."""
    return (
        db.scalar(
            select(SpendRequest.id)
            .where(SpendRequest.initiative_id == initiative.id)
            .where(SpendRequest.status != "draft")
            .limit(1)
        )
        is not None
    )


def delete(db: Session, initiative: Initiative) -> None:
    """Deletes the initiative along with its spend requests (only ever drafts,
    per `has_submitted_spend`). Goes through the ORM object-by-object so
    relationship-owned rows (line items, team-member associations) are cleaned
    up correctly rather than left orphaned or blocked by a FK constraint."""
    for spend_request in list(initiative.spend_requests):
        db.delete(spend_request)
    db.delete(initiative)
