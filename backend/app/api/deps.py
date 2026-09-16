from collections.abc import Generator

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user as _resolve_dev_user
from app.models.user import User


def get_current_user(
    x_dev_user_email: str | None = Header(default=None, alias="X-Dev-User-Email"),
    db: Session = Depends(get_db),
) -> User:
    return _resolve_dev_user(db, x_dev_user_email)


def require_role(*roles: str):
    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of roles {roles}, you are '{user.role}'.",
            )
        return user

    return _check


__all__ = ["get_current_user", "require_role", "get_db"]
