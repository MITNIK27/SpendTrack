import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.initiatives import _get_owned_or_visible
from app.api.routes.spend_requests import _get_spend_request_or_404
from app.models.activity_log import ActivityLog
from app.models.user import User
from app.schemas.activity_log import ActivityLogRead

router = APIRouter(tags=["activity"])


def _entries(db: Session, entity_type: str, entity_id: uuid.UUID) -> list[ActivityLog]:
    stmt = (
        select(ActivityLog)
        .where(ActivityLog.entity_type == entity_type, ActivityLog.entity_id == entity_id)
        .order_by(ActivityLog.created_at)
    )
    return list(db.scalars(stmt).all())


@router.get("/spend-requests/{spend_request_id}/activity", response_model=list[ActivityLogRead])
def spend_request_activity(
    spend_request_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ActivityLog]:
    _get_spend_request_or_404(db, spend_request_id, user)
    return _entries(db, "spend_request", spend_request_id)


@router.get("/initiatives/{initiative_id}/activity", response_model=list[ActivityLogRead])
def initiative_activity(
    initiative_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ActivityLog]:
    _get_owned_or_visible(db, initiative_id, user)
    return _entries(db, "initiative", initiative_id)
