import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_current_user, get_db, require_role
from app.api.routes.initiatives import _get_owned_or_visible
from app.models.approval_action import ApprovalAction
from app.models.category import Category
from app.models.initiative import Initiative
from app.models.spend_request import SpendRequest
from app.models.user import User
from app.schemas.approval_action import ApprovalDecisionInput, ApproveBatchInput
from app.schemas.spend_request import ActualSpendInput, SpendRequestCreate, SpendRequestRead, SpendRequestUpdate
from app.services import approval_service, spend_request_service
from app.services.spend_request_visibility import is_spend_request_visible, visible_spend_requests_clause

router = APIRouter(tags=["spend-requests"])

# Every relationship SpendRequestRead actually serializes (including
# latest_decision_comment, which walks approval_actions -> approver). Without
# this, each row lazy-loads 6 relationships one at a time — against a remote
# DB that's 6x round-trip latency per row, which is exactly what was making
# the approve flow feel like a multi-second page reload.
SPEND_REQUEST_EAGER_LOAD = (
    # To-one relationships: joined into the same query (no extra round trip)
    # rather than selectinload's separate SELECT — against a remote DB where
    # each round trip costs 150-300ms, folding these in matters much more
    # than avoiding SQLAlchemy's small in-process row-dedup cost.
    joinedload(SpendRequest.created_by),
    joinedload(SpendRequest.category).selectinload(Category.subcategories),
    joinedload(SpendRequest.subcategory),
    # Collections: selectinload, so a request with several line items/team
    # members/approval actions doesn't multiply the main result set.
    selectinload(SpendRequest.team_members),
    selectinload(SpendRequest.line_items),
    selectinload(SpendRequest.approval_actions).joinedload(ApprovalAction.approver),
)


def _get_spend_request_or_404(db: Session, spend_request_id: uuid.UUID, user: User) -> SpendRequest:
    spend_request = db.get(SpendRequest, spend_request_id, options=SPEND_REQUEST_EAGER_LOAD)
    if spend_request is None or not is_spend_request_visible(spend_request, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Spend request not found.")
    return spend_request


def _reload_spend_request(db: Session, spend_request_id: uuid.UUID) -> SpendRequest:
    """A commit expires every relationship on an object, so a plain
    db.refresh() afterward just means each one lazy-loads again individually
    the moment the response serializer touches it — re-fetching once with the
    same eager-load options avoids that."""
    return db.scalar(select(SpendRequest).options(*SPEND_REQUEST_EAGER_LOAD).where(SpendRequest.id == spend_request_id))


@router.post(
    "/initiatives/{initiative_id}/spend-requests",
    response_model=SpendRequestRead,
    status_code=status.HTTP_201_CREATED,
)
def create_spend_request(
    initiative_id: uuid.UUID,
    payload: SpendRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SpendRequest:
    initiative = _get_owned_or_visible(db, initiative_id, user)
    if initiative.owner_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the initiative's owner can add spend to it.")
    spend_request = spend_request_service.create(db, initiative=initiative, creator=user, data=payload.model_dump())
    db.commit()
    return _reload_spend_request(db, spend_request.id)


@router.get("/spend-requests", response_model=list[SpendRequestRead])
def list_spend_requests(
    initiative_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    category_id: uuid.UUID | None = None,
    created_by_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SpendRequest]:
    stmt = select(SpendRequest).options(*SPEND_REQUEST_EAGER_LOAD).where(visible_spend_requests_clause(user))
    if user.role != "member" and created_by_id is not None:
        stmt = stmt.where(SpendRequest.created_by_id == created_by_id)
    if initiative_id is not None:
        stmt = stmt.where(SpendRequest.initiative_id == initiative_id)
    if status_filter is not None:
        stmt = stmt.where(SpendRequest.status == status_filter)
    if category_id is not None:
        stmt = stmt.where(SpendRequest.category_id == category_id)
    stmt = stmt.order_by(SpendRequest.created_at.desc())
    return list(db.scalars(stmt).all())


@router.get("/spend-requests/{spend_request_id}", response_model=SpendRequestRead)
def read_spend_request(
    spend_request_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SpendRequest:
    return _get_spend_request_or_404(db, spend_request_id, user)


@router.patch("/spend-requests/{spend_request_id}", response_model=SpendRequestRead)
def update_spend_request(
    spend_request_id: uuid.UUID,
    payload: SpendRequestUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SpendRequest:
    spend_request = _get_spend_request_or_404(db, spend_request_id, user)
    if spend_request.created_by_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the request's owner can edit it.")
    spend_request_service.update(
        db, spend_request=spend_request, actor=user, data=payload.model_dump(exclude_unset=True)
    )
    db.commit()
    return _reload_spend_request(db, spend_request.id)


@router.post("/spend-requests/{spend_request_id}/submit", response_model=SpendRequestRead)
def submit_spend_request(
    spend_request_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SpendRequest:
    spend_request = _get_spend_request_or_404(db, spend_request_id, user)
    spend_request_service.submit(db, spend_request=spend_request, actor=user)
    db.commit()
    return _reload_spend_request(db, spend_request.id)


@router.post("/spend-requests/approve-batch", response_model=list[SpendRequestRead])
def approve_batch(
    payload: ApproveBatchInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("approver", "admin")),
) -> list[SpendRequest]:
    """Approves a hand-picked set of pending spend requests in one go, each
    with its own optional remark — the everyday decision flow now: select
    what to approve, say why if it's worth saying, done. Anything not listed
    here (or no longer pending by the time this runs) is silently skipped
    rather than erroring the whole batch — a stale/already-decided id is not
    the caller's fault to fix before retrying."""
    approved_ids: list[uuid.UUID] = []
    for item in payload.decisions:
        spend_request = db.get(SpendRequest, item.spend_request_id)
        if (
            spend_request is None
            or not is_spend_request_visible(spend_request, user)
            or spend_request.status not in approval_service.PENDING_DECISION_STATUSES
        ):
            continue
        approval_service.decide(
            db,
            spend_request=spend_request,
            approver=user,
            action="approve",
            approved_amount=None,
            comment=item.comment,
        )
        approved_ids.append(spend_request.id)
    db.commit()
    if not approved_ids:
        return []
    # One eager-loaded query for the whole batch rather than a refresh per row
    # (each of which would otherwise lazy-load its relationships one at a
    # time after the commit above expires them).
    by_id = {
        sr.id: sr
        for sr in db.scalars(
            select(SpendRequest).options(*SPEND_REQUEST_EAGER_LOAD).where(SpendRequest.id.in_(approved_ids))
        ).all()
    }
    return [by_id[sr_id] for sr_id in approved_ids]


@router.post("/spend-requests/{spend_request_id}/decisions", response_model=SpendRequestRead)
def decide_spend_request(
    spend_request_id: uuid.UUID,
    payload: ApprovalDecisionInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("approver", "admin")),
) -> SpendRequest:
    spend_request = _get_spend_request_or_404(db, spend_request_id, user)
    approval_service.decide(
        db,
        spend_request=spend_request,
        approver=user,
        action=payload.action,
        approved_amount=payload.approved_amount,
        comment=payload.comment,
    )
    db.commit()
    return _reload_spend_request(db, spend_request.id)


@router.post("/spend-requests/{spend_request_id}/actual", response_model=SpendRequestRead)
def record_actual_spend(
    spend_request_id: uuid.UUID,
    payload: ActualSpendInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SpendRequest:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only Admin can record actual spend.")
    spend_request = _get_spend_request_or_404(db, spend_request_id, user)
    spend_request_service.record_actual(
        db,
        spend_request=spend_request,
        actor=user,
        actual_amount=payload.actual_amount,
        actual_spend_date=payload.actual_spend_date,
    )
    db.commit()
    return _reload_spend_request(db, spend_request.id)


@router.delete("/spend-requests/{spend_request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_spend_request(
    spend_request_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    spend_request = _get_spend_request_or_404(db, spend_request_id, user)
    spend_request_service.delete_draft(db, spend_request=spend_request, actor=user)
    db.commit()
