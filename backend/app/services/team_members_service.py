import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def resolve(db: Session, user_ids: list[uuid.UUID]) -> list[User]:
    if not user_ids:
        return []
    users = list(db.scalars(select(User).where(User.id.in_(user_ids))).all())
    found_ids = {u.id for u in users}
    missing = [str(i) for i in user_ids if i not in found_ids]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown team member id(s): {', '.join(missing)}")
    return users
