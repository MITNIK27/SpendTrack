from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.spend_request import EDITABLE_STATUSES, SpendRequest
from app.models.spend_request_line_item import SpendRequestLineItem
from app.models.user import User
from app.services import activity_log_service, initiative_service, team_members_service


def _validate_category(db: Session, category_id, subcategory_id, other_description: str | None) -> Category:
    category = db.get(Category, category_id)
    if category is None or not category.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown or inactive category.")
    if category.requires_freetext_description and not (other_description and other_description.strip()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"'{category.name}' requires a description of what this spend is for.",
        )
    if subcategory_id is not None:
        matching = [s for s in category.subcategories if s.id == subcategory_id]
        if not matching:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Subcategory does not belong to this category.")
    return category


def _validate_line_items(line_items: list[dict], requested_amount: Decimal) -> None:
    if not line_items:
        return
    total = sum((li["amount"] for li in line_items), start=Decimal("0"))
    if total != requested_amount:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Spend breakdown line items total {total} but the requested amount is {requested_amount}. "
            "They must match.",
        )


def create(db: Session, *, initiative, creator: User, data: dict) -> SpendRequest:
    category = _validate_category(db, data["category_id"], data.get("subcategory_id"), data.get("other_description"))
    team_member_ids = data.pop("team_member_ids", [])
    line_items_data = data.pop("line_items", [])
    _validate_line_items(line_items_data, data["requested_amount"])

    if not data.get("description"):
        subcategory_id = data.get("subcategory_id")
        subcategory = next((s for s in category.subcategories if s.id == subcategory_id), None)
        data["description"] = f"{category.name} – {subcategory.name}" if subcategory else category.name

    # A spend request always uses its initiative's currency — there is no
    # per-request currency choice in the UI.
    data["currency"] = initiative.currency

    spend_request = SpendRequest(initiative_id=initiative.id, created_by_id=creator.id, status="draft", **data)
    spend_request.team_members = team_members_service.resolve(db, team_member_ids)
    spend_request.line_items = [
        SpendRequestLineItem(item=li["item"], amount=li["amount"], sort_order=i)
        for i, li in enumerate(line_items_data)
    ]
    db.add(spend_request)
    db.flush()
    activity_log_service.record(
        db,
        entity_type="spend_request",
        entity_id=spend_request.id,
        actor=creator,
        action="spend_created",
        metadata={"initiative_id": str(initiative.id)},
    )
    initiative_service.sync_status(db, initiative=initiative)
    return spend_request


def update(db: Session, *, spend_request: SpendRequest, actor: User, data: dict) -> SpendRequest:
    if spend_request.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This spend request is '{spend_request.status}' and its financial details are locked. "
            "Create a new spend request for additional money instead.",
        )

    category_id = data.get("category_id", spend_request.category_id)
    subcategory_id = data.get("subcategory_id", spend_request.subcategory_id)
    other_description = data.get("other_description", spend_request.other_description)
    _validate_category(db, category_id, subcategory_id, other_description)

    team_member_ids = data.pop("team_member_ids", None)
    line_items_data = data.pop("line_items", None)
    if line_items_data is not None:
        requested_amount = data.get("requested_amount", spend_request.requested_amount)
        _validate_line_items(line_items_data, requested_amount)

    for field, value in data.items():
        setattr(spend_request, field, value)
    if team_member_ids is not None:
        spend_request.team_members = team_members_service.resolve(db, team_member_ids)
    if line_items_data is not None:
        spend_request.line_items = [
            SpendRequestLineItem(item=li["item"], amount=li["amount"], sort_order=i)
            for i, li in enumerate(line_items_data)
        ]

    activity_log_service.record(
        db, entity_type="spend_request", entity_id=spend_request.id, actor=actor, action="spend_edited"
    )
    return spend_request


def submit(db: Session, *, spend_request: SpendRequest, actor: User) -> SpendRequest:
    if spend_request.created_by_id != actor.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the request's owner can submit it.")

    if spend_request.initiative.status == "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This spend request's initiative hasn't been submitted for approval yet — "
            "submit the initiative first (its own Submit for Approval lets you bundle this in).",
        )

    if spend_request.status == "draft":
        spend_request.status = "submitted"
        action = "spend_submitted"
    elif spend_request.status == "changes_requested":
        spend_request.status = "resubmitted"
        spend_request.current_cycle += 1
        action = "spend_resubmitted"
    else:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot submit a spend request that is '{spend_request.status}'.",
        )

    spend_request.submitted_at = datetime.now(timezone.utc)
    activity_log_service.record(
        db, entity_type="spend_request", entity_id=spend_request.id, actor=actor, action=action
    )
    initiative_service.sync_status(db, initiative=spend_request.initiative)
    return spend_request


def record_actual(
    db: Session, *, spend_request: SpendRequest, actor: User, actual_amount: Decimal, actual_spend_date: datetime | None
) -> SpendRequest:
    if spend_request.status != "approved":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot record actual spend on a request that is '{spend_request.status}'. "
            "It must be 'approved' first.",
        )

    spend_request.actual_amount = actual_amount
    spend_request.spent_at = actual_spend_date or datetime.now(timezone.utc)
    spend_request.status = "spent"

    activity_log_service.record(
        db,
        entity_type="spend_request",
        entity_id=spend_request.id,
        actor=actor,
        action="actual_recorded",
        metadata={"actual_amount": str(actual_amount)},
    )
    initiative_service.sync_status(db, initiative=spend_request.initiative)
    return spend_request


def delete_draft(db: Session, *, spend_request: SpendRequest, actor: User) -> None:
    if spend_request.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a draft spend request can be deleted.")
    if spend_request.created_by_id != actor.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the request's owner can delete it.")
    db.delete(spend_request)
