import uuid
from decimal import Decimal
from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.orm.interfaces import LoaderOption

from app.api.deps import get_current_user, get_db, require_role
from app.models.approval_action import ApprovalAction
from app.models.category import Category
from app.models.initiative import INITIATIVE_STATUSES, Initiative
from app.models.spend_request import SpendRequest
from app.models.user import User
from app.schemas.initiative import (
    InitiativeBudgetDecisionInput,
    InitiativeCreate,
    InitiativeDetail,
    InitiativeFinancialSummary,
    InitiativeRead,
    InitiativeStatusUpdate,
    InitiativeSubmitInput,
    InitiativeUpdate,
)
from app.services import (
    activity_log_service,
    initiative_service,
    spend_request_service,
    team_members_service,
)
from app.services.initiative_visibility import is_initiative_visible, visible_initiatives_clause
from app.services.spend_request_visibility import is_spend_request_visible, visible_spend_requests_clause

router = APIRouter(prefix="/initiatives", tags=["initiatives"])

# Every relationship InitiativeRead itself serializes, plus the shallow
# spend_requests collection the spend_request_count/total_requested_amount/
# total_approved_amount properties need — without this, listing initiatives
# lazy-loads owner/category/team_members/spend_requests one relationship at a
# time per row against a remote DB, which adds up fast.
INITIATIVE_LIST_EAGER_LOAD: Sequence[LoaderOption] = (
    # To-one: joined into the same query rather than a separate round trip —
    # against a remote DB where each round trip costs 150-300ms, that matters
    # far more than SQLAlchemy's small in-process row-dedup cost.
    joinedload(Initiative.owner),
    joinedload(Initiative.category).selectinload(Category.subcategories),
    joinedload(Initiative.budget_decided_by),
    # Collections: selectinload, so this doesn't multiply the main result set.
    selectinload(Initiative.team_members),
    selectinload(Initiative.spend_requests),
)

# InitiativeDetail additionally serializes each spend request in full
# (SpendRequestRead) — same relationships spend_requests.py's
# SPEND_REQUEST_EAGER_LOAD covers, just reached through Initiative.spend_requests.
INITIATIVE_DETAIL_EAGER_LOAD: Sequence[LoaderOption] = (
    joinedload(Initiative.owner),
    joinedload(Initiative.category).selectinload(Category.subcategories),
    joinedload(Initiative.budget_decided_by),
    selectinload(Initiative.team_members),
    selectinload(Initiative.spend_requests).joinedload(SpendRequest.created_by),
    selectinload(Initiative.spend_requests).joinedload(SpendRequest.category).selectinload(Category.subcategories),
    selectinload(Initiative.spend_requests).joinedload(SpendRequest.subcategory),
    selectinload(Initiative.spend_requests).selectinload(SpendRequest.team_members),
    selectinload(Initiative.spend_requests).selectinload(SpendRequest.line_items),
    selectinload(Initiative.spend_requests)
    .selectinload(SpendRequest.approval_actions)
    .joinedload(ApprovalAction.approver),
)


def _get_owned_or_visible(
    db: Session, initiative_id: uuid.UUID, user: User, options: Sequence[LoaderOption] | None = None
) -> Initiative:
    initiative = db.get(Initiative, initiative_id, options=options)
    if initiative is None or not is_initiative_visible(initiative, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Initiative not found.")
    return initiative


def _reload_initiative(db: Session, initiative_id: uuid.UUID, options: Sequence[LoaderOption]) -> Initiative:
    """A commit expires every relationship on an object, so a plain
    db.refresh() afterward just means each one lazy-loads again individually
    the moment the response serializer touches it — re-fetching once with the
    same eager-load options avoids that."""
    return db.scalar(select(Initiative).options(*options).where(Initiative.id == initiative_id))


def _visible_spend_requests(initiative: Initiative, user: User) -> list:
    return [sr for sr in initiative.spend_requests if is_spend_request_visible(sr, user)]


def _financial_summary(initiative: Initiative, spend_requests: list) -> InitiativeFinancialSummary:
    total_requested = Decimal("0")
    total_approved = Decimal("0")
    total_actual = Decimal("0")
    for sr in spend_requests:
        total_requested += sr.requested_amount
        if sr.approved_amount is not None:
            total_approved += sr.approved_amount
        if sr.actual_amount is not None:
            total_actual += sr.actual_amount
    # An initiative with no spend-breakdown rows of its own is decided
    # directly on its own budget (see decide_budget) — fold that in the same
    # way a spend request's requested/approved amount would be.
    if not spend_requests and initiative.estimated_total_budget is not None:
        total_requested += initiative.estimated_total_budget
        if initiative.budget_decision == "approved" and initiative.budget_approved_amount is not None:
            total_approved += initiative.budget_approved_amount
    total_pending = total_requested - total_approved
    total_balance = total_approved - total_actual
    return InitiativeFinancialSummary(
        total_requested=str(total_requested),
        total_approved=str(total_approved),
        total_pending=str(total_pending),
        total_actual=str(total_actual),
        total_balance=str(total_balance),
        spend_request_count=len(spend_requests),
    )


@router.post("", response_model=InitiativeRead, status_code=status.HTTP_201_CREATED)
def create_initiative(
    payload: InitiativeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Initiative:
    data = payload.model_dump()
    team_member_ids = data.pop("team_member_ids")
    initiative = Initiative(owner_id=user.id, status="draft", **data)
    initiative.team_members = team_members_service.resolve(db, team_member_ids)
    db.add(initiative)
    db.flush()
    activity_log_service.record(
        db, entity_type="initiative", entity_id=initiative.id, actor=user, action="initiative_created"
    )
    db.commit()
    return _reload_initiative(db, initiative.id, INITIATIVE_LIST_EAGER_LOAD)


@router.post("/{initiative_id}/submit", response_model=InitiativeDetail)
def submit_initiative(
    initiative_id: uuid.UUID,
    payload: InitiativeSubmitInput = InitiativeSubmitInput(),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Initiative:
    initiative = _get_owned_or_visible(db, initiative_id, user, options=INITIATIVE_DETAIL_EAGER_LOAD)
    if initiative.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can submit this initiative.")
    if initiative.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, f"This initiative is '{initiative.status}', not a draft.")

    # Zero spend requests is a legitimate, deliberately-submitted state — an
    # initiative with only a budget and no breakdown is approved directly on
    # its own budget (see decide_budget), never by faking a spend request.

    # Flip the initiative to active *before* submitting any bundled spend
    # requests below — spend_request_service.submit() now refuses to submit a
    # request whose initiative is still a draft (that's exactly the bug this
    # ordering avoids: a spend request going to Siddharth's queue "under no
    # initiative" because the initiative itself was never actually published).
    initiative.status = "active"
    activity_log_service.record(
        db, entity_type="initiative", entity_id=initiative.id, actor=user, action="initiative_submitted"
    )

    # Submit whichever currently-draft spend requests the team member chose to
    # bundle along with the initiative. Anything left unchecked stays a draft,
    # submittable later on its own (once this initiative is no longer a draft).
    draft_by_id = {sr.id: sr for sr in initiative.spend_requests if sr.status == "draft"}
    for sr_id in payload.spend_request_ids:
        spend_request = draft_by_id.get(sr_id)
        if spend_request is not None:
            spend_request_service.submit(db, spend_request=spend_request, actor=user)

    db.commit()
    initiative = _reload_initiative(db, initiative.id, INITIATIVE_DETAIL_EAGER_LOAD)
    visible_spend_requests = _visible_spend_requests(initiative, user)
    return InitiativeDetail(
        **InitiativeRead.model_validate(initiative).model_dump(),
        spend_requests=visible_spend_requests,
        financial_summary=_financial_summary(initiative, visible_spend_requests),
    )


@router.post("/{initiative_id}/budget-decision", response_model=InitiativeDetail)
def decide_initiative_budget(
    initiative_id: uuid.UUID,
    payload: InitiativeBudgetDecisionInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("approver", "admin")),
) -> Initiative:
    initiative = _get_owned_or_visible(db, initiative_id, user, options=INITIATIVE_DETAIL_EAGER_LOAD)
    initiative_service.decide_budget(db, initiative=initiative, approver=user, action=payload.action, comment=payload.comment)
    db.commit()
    initiative = _reload_initiative(db, initiative.id, INITIATIVE_DETAIL_EAGER_LOAD)
    visible_spend_requests = _visible_spend_requests(initiative, user)
    return InitiativeDetail(
        **InitiativeRead.model_validate(initiative).model_dump(),
        spend_requests=visible_spend_requests,
        financial_summary=_financial_summary(initiative, visible_spend_requests),
    )


@router.get("", response_model=list[InitiativeRead])
def list_initiatives(
    owner_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    name: str | None = None,
    category_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Initiative]:
    stmt = select(Initiative).options(*INITIATIVE_LIST_EAGER_LOAD).where(visible_initiatives_clause(user))
    if user.role != "member" and owner_id is not None:
        stmt = stmt.where(Initiative.owner_id == owner_id)
    if status_filter is not None:
        stmt = stmt.where(Initiative.status == status_filter)
    if name is not None:
        stmt = stmt.where(Initiative.name.ilike(f"%{name}%"))
    if category_id is not None:
        # Only initiatives with at least one (visible) spend request in this
        # category — a cascading filter for the leadership report's Initiative
        # picker. Zero matches is a legitimate result, not an error.
        has_category_spend = (
            select(SpendRequest.id)
            .where(SpendRequest.initiative_id == Initiative.id)
            .where(SpendRequest.category_id == category_id)
            .where(visible_spend_requests_clause(user))
            .exists()
        )
        stmt = stmt.where(has_category_spend)
    stmt = stmt.order_by(Initiative.created_at.desc())
    return list(db.scalars(stmt).all())


@router.get("/{initiative_id}", response_model=InitiativeDetail)
def read_initiative(
    initiative_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Initiative:
    initiative = _get_owned_or_visible(db, initiative_id, user, options=INITIATIVE_DETAIL_EAGER_LOAD)
    visible_spend_requests = _visible_spend_requests(initiative, user)
    return InitiativeDetail(
        **InitiativeRead.model_validate(initiative).model_dump(),
        spend_requests=visible_spend_requests,
        financial_summary=_financial_summary(initiative, visible_spend_requests),
    )


@router.patch("/{initiative_id}", response_model=InitiativeRead)
def update_initiative(
    initiative_id: uuid.UUID,
    payload: InitiativeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Initiative:
    initiative = _get_owned_or_visible(db, initiative_id, user)
    if initiative.owner_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner or an admin can edit this initiative.")
    data = payload.model_dump(exclude_unset=True)
    team_member_ids = data.pop("team_member_ids", None)
    for field, value in data.items():
        setattr(initiative, field, value)
    if team_member_ids is not None:
        initiative.team_members = team_members_service.resolve(db, team_member_ids)
    db.commit()
    return _reload_initiative(db, initiative.id, INITIATIVE_LIST_EAGER_LOAD)


@router.delete("/{initiative_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_initiative(
    initiative_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    initiative = _get_owned_or_visible(db, initiative_id, user)
    if initiative.owner_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner or an admin can delete this initiative.")
    if initiative_service.has_submitted_spend(db, initiative):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This initiative has spend requests that have already been submitted, "
            "so it can no longer be deleted — only edited.",
        )
    activity_log_service.record(
        db,
        entity_type="initiative",
        entity_id=initiative_id,
        actor=user,
        action="initiative_deleted",
        metadata={"name": initiative.name},
    )
    initiative_service.delete(db, initiative)
    db.commit()


@router.post("/{initiative_id}/status", response_model=InitiativeRead)
def update_initiative_status(
    initiative_id: uuid.UUID,
    payload: InitiativeStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Initiative:
    initiative = _get_owned_or_visible(db, initiative_id, user)
    if initiative.owner_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner or an admin can change this status.")
    if payload.status not in INITIATIVE_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid status. Must be one of {INITIATIVE_STATUSES}.")
    initiative.status = payload.status
    activity_log_service.record(
        db,
        entity_type="initiative",
        entity_id=initiative.id,
        actor=user,
        action="initiative_status_changed",
        metadata={"status": payload.status},
    )
    db.commit()
    return _reload_initiative(db, initiative.id, INITIATIVE_LIST_EAGER_LOAD)
