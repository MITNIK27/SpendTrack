from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.user import UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[User]:
    """A lightweight, read-only directory of registered users — any authenticated user
    can fetch it (e.g. to pick team members on an initiative or spend request).
    Role management (assigning Member/Approver/Admin) is a separate, Admin-only
    concern that lands with the Admin category-management screen."""
    stmt = select(User).where(User.is_active).order_by(User.name)
    return list(db.scalars(stmt).all())
