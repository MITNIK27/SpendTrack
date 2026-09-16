from fastapi import Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_current_user(
    db: Session,
    x_dev_user_email: str | None,
) -> User:
    """Resolve the current user.

    V1: looks up `users` by the `X-Dev-User-Email` header — no token verification.
    Phase 12 replaces the body of this function with Firebase ID token verification
    (looking up by `firebase_uid`, auto-provisioning a new `employee` row on first
    real login). Every caller of this dependency stays unchanged.
    """
    if not x_dev_user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Dev-User-Email header. Pick a dev user in the app first.",
        )

    user = db.scalar(select(User).where(User.email == x_dev_user_email))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active user found for {x_dev_user_email}. Run the seed script first.",
        )
    return user
