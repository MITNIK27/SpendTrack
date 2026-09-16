import uuid

from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog
from app.models.user import User


def record(
    db: Session,
    *,
    entity_type: str,
    entity_id: uuid.UUID,
    actor: User | None,
    action: str,
    metadata: dict | None = None,
) -> ActivityLog:
    entry = ActivityLog(
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor.id if actor else None,
        action=action,
        log_metadata=metadata,
    )
    db.add(entry)
    db.flush()
    return entry
