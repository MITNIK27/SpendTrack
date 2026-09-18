from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import exceptions as firebase_exceptions
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.firebase import verify_google_id_token
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import GoogleSignInInput, TokenResponse
from app.schemas.user import UserRead
from app.services import activity_log_service

router = APIRouter(tags=["auth"])


@router.post("/auth/google", response_model=TokenResponse)
def sign_in_with_google(
    payload: GoogleSignInInput,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Exchanges a Firebase ID token (obtained by the frontend via the Google sign-in
    popup) for our own short-lived app session. This is the only entry point into the
    application's session — every claim used below comes from Firebase's own verified
    decode, never anything the client could have supplied unverified."""
    try:
        claims = verify_google_id_token(payload.id_token)
    except firebase_exceptions.FirebaseError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired Google sign-in. Please try again.")

    email: str | None = claims.get("email")
    email_verified: bool = claims.get("email_verified", False)
    firebase_uid: str = claims["sub"]
    name: str = claims.get("name") or (email.split("@")[0] if email else "Unknown")

    if not email or not email_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your Google account's email must be verified to sign in.")
    if not email.lower().endswith(f"@{settings.google_allowed_domain}"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Sign in with your @{settings.google_allowed_domain} account.",
        )

    user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
    if user is None:
        # Fall back to matching an existing row by email once (covers dev-seeded
        # accounts created before real Google sign-in existed), backfilling their
        # firebase_uid so every later login matches directly above.
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, name=name, role="member", firebase_uid=firebase_uid)
            db.add(user)
            db.flush()
            activity_log_service.record(
                db, entity_type="user", entity_id=user.id, actor=user, action="user_created"
            )
        else:
            user.firebase_uid = firebase_uid

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account has been deactivated.")

    user.name = name
    user.last_login_at = datetime.now(timezone.utc)
    activity_log_service.record(db, entity_type="user", entity_id=user.id, actor=user, action="login")
    db.commit()
    db.refresh(user)

    return TokenResponse(access_token=create_access_token(user), user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def read_current_user(user: User = Depends(get_current_user)) -> User:
    return user
