from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.approval_action import APPROVAL_ACTIONS, ApprovalAction
from app.models.spend_request import SpendRequest
from app.models.user import User
from app.services import activity_log_service, initiative_service

# Statuses in which a decision can actually be made — mirrors the frontend's
# PENDING_DECISION_STATUSES (types/domain.ts) so both sides agree on what "pending" means.
PENDING_DECISION_STATUSES = ("submitted", "under_review", "resubmitted")

_ACTIVITY_ACTION_BY_DECISION = {
    "approve": "spend_approved",
    "approve_different_amount": "spend_approved_different_amount",
    "reject": "spend_rejected",
    "request_changes": "spend_changes_requested",
}

_NEW_STATUS_BY_DECISION = {
    "approve": "approved",
    "approve_different_amount": "approved",
    "reject": "rejected",
    "request_changes": "changes_requested",
}


def decide(
    db: Session,
    *,
    spend_request: SpendRequest,
    approver: User,
    action: str,
    approved_amount: Decimal | None,
    comment: str | None,
) -> SpendRequest:
    if action not in APPROVAL_ACTIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown decision '{action}'.")

    if spend_request.status not in PENDING_DECISION_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This spend request is '{spend_request.status}' and isn't awaiting a decision.",
        )

    if action != "approve" and not (comment and comment.strip()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"A comment is required to {action.replace('_', ' ')}.")

    if action == "approve_different_amount" and approved_amount is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "approved_amount is required for approve_different_amount."
        )

    resolved_approved_amount: Decimal | None = None
    if action == "approve":
        resolved_approved_amount = approved_amount if approved_amount is not None else spend_request.requested_amount
    elif action == "approve_different_amount":
        resolved_approved_amount = approved_amount

    db.add(
        ApprovalAction(
            spend_request_id=spend_request.id,
            cycle=spend_request.current_cycle,
            approver_id=approver.id,
            action=action,
            requested_amount_at_time=spend_request.requested_amount,
            approved_amount=resolved_approved_amount,
            comment=comment,
        )
    )

    spend_request.status = _NEW_STATUS_BY_DECISION[action]
    if action in ("approve", "approve_different_amount", "reject"):
        spend_request.approved_amount = resolved_approved_amount
        spend_request.decided_at = datetime.now(timezone.utc)

    activity_log_service.record(
        db,
        entity_type="spend_request",
        entity_id=spend_request.id,
        actor=approver,
        action=_ACTIVITY_ACTION_BY_DECISION[action],
        metadata={"comment": comment, "approved_amount": str(resolved_approved_amount) if resolved_approved_amount is not None else None},
    )
    initiative_service.sync_status(db, initiative=spend_request.initiative)
    return spend_request
