from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.initiative import INITIATIVE_BUDGET_DECISIONS, Initiative
from app.models.spend_request import SpendRequest
from app.models.user import User
from app.services import activity_log_service

# A spend request that has left the decision/edit loop for good. An initiative
# is only ever auto-completed once every one of its requests lands here.
TERMINAL_SPEND_STATUSES = ("approved", "rejected", "spent", "closed")

_ACTIVITY_ACTION_BY_BUDGET_DECISION = {
    "approve": "initiative_budget_approved",
    "reject": "initiative_budget_rejected",
}


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


def decide_budget(db: Session, *, initiative: Initiative, approver: User, action: str, comment: str | None) -> Initiative:
    """Approves or rejects an initiative's own top-line budget — only ever
    applicable to one with zero spend-breakdown rows of its own; a breakdown
    is decided per-line instead (see approval_service.decide). One-shot: once
    decided, an initiative's budget is never re-decided."""
    if action not in ("approve", "reject"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown decision '{action}'.")
    if initiative.status == "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "This initiative hasn't been submitted yet.")
    if initiative.spend_requests:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This initiative has its own spend breakdown — decide its spend requests individually instead.",
        )
    if initiative.estimated_total_budget is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This initiative has no budget amount to decide on.")
    if initiative.budget_decision is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"This initiative's budget was already {initiative.budget_decision}.")

    decision = "approved" if action == "approve" else "rejected"
    assert decision in INITIATIVE_BUDGET_DECISIONS

    initiative.budget_decision = decision
    initiative.budget_approved_amount = initiative.estimated_total_budget if action == "approve" else None
    initiative.budget_decided_at = datetime.now(timezone.utc)
    initiative.budget_decided_by_id = approver.id
    initiative.budget_decision_comment = comment

    activity_log_service.record(
        db,
        entity_type="initiative",
        entity_id=initiative.id,
        actor=approver,
        action=_ACTIVITY_ACTION_BY_BUDGET_DECISION[action],
        metadata={"comment": comment, "approved_amount": str(initiative.budget_approved_amount) if initiative.budget_approved_amount is not None else None},
    )

    # A decided budget-only initiative has nothing left pending — same rule
    # sync_status applies once every one of an initiative's spend requests is
    # terminal, just reached from the other side (no spend requests at all,
    # but its own budget is now decided either way).
    if initiative.status == "active":
        initiative.status = "closed"
        activity_log_service.record(
            db, entity_type="initiative", entity_id=initiative.id, actor=approver, action="initiative_closed"
        )
    return initiative


def delete(db: Session, initiative: Initiative) -> None:
    """Deletes the initiative along with its spend requests (only ever drafts,
    per `has_submitted_spend`). Goes through the ORM object-by-object so
    relationship-owned rows (line items, team-member associations) are cleaned
    up correctly rather than left orphaned or blocked by a FK constraint."""
    for spend_request in list(initiative.spend_requests):
        db.delete(spend_request)
    db.delete(initiative)
