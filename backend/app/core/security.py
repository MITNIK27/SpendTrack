import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User

JWT_ALGORITHM = "HS256"


def create_access_token(user: User) -> str:
    """Signs our own short-lived session token after a Firebase ID token has already
    been verified. Deliberately carries ONLY `sub` (user id) and `exp` — no `role` —
    so `get_current_user` re-reads role/is_active from the DB on every request. A role
    change or deactivation then takes effect on the user's very next API call, instead
    of being stuck with whatever role was true when the token was issued."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session. Please sign in again.")
    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session. Please sign in again.")


def get_current_user(db: Session, token: str | None) -> User:
    """Resolve the current user from a Bearer app JWT (issued by create_access_token
    after a verified Google sign-in). Every caller of this dependency stays unchanged
    from the dev-auth stub days — this remains the one function whose implementation
    changed."""
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing or invalid Authorization header.")

    user_id = decode_access_token(token)
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session. Please sign in again.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account has been deactivated.")
    return user
