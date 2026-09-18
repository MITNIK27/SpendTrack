import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.user import USER_ROLES, User
from app.schemas.admin import UserUpdateInput
from app.schemas.user import UserRead
from app.services import activity_log_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserRead])
def list_all_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
) -> list[User]:
    """Admin-only: every user including inactive ones (unlike the public,
    active-only GET /api/users directory used for team-member pickers)."""
    stmt = select(User).order_by(User.name)
    return list(db.scalars(stmt).all())


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateInput,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
) -> User:
    """The only place in the application a role is ever assigned by another
    person — gated to existing admins, so privilege can only be granted by
    someone who already has it. Every change is written to the same audit
    log the rest of the app already uses."""
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")

    if target.id == admin.id and (
        (payload.role is not None and payload.role != admin.role)
        or (payload.is_active is False)
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You can't change your own role or deactivate your own account."
        )

    if payload.role is not None:
        if payload.role not in USER_ROLES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Role must be one of {USER_ROLES}.")
        if payload.role != target.role:
            activity_log_service.record(
                db,
                entity_type="user",
                entity_id=target.id,
                actor=admin,
                action="role_changed",
                metadata={"from": target.role, "to": payload.role},
            )
            target.role = payload.role

    if payload.is_active is not None and payload.is_active != target.is_active:
        activity_log_service.record(
            db,
            entity_type="user",
            entity_id=target.id,
            actor=admin,
            action="user_activated" if payload.is_active else "user_deactivated",
        )
        target.is_active = payload.is_active

    db.commit()
    db.refresh(target)
    return target
