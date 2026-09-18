import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from app.core.config import settings

_app: firebase_admin.App | None = None


def _get_app() -> firebase_admin.App:
    global _app
    if _app is None:
        cred = credentials.Certificate(settings.google_application_credentials)
        _app = firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
    return _app


def verify_google_id_token(id_token: str) -> dict:
    """Verifies a Firebase ID token's signature, issuer, audience, and expiry via the
    Admin SDK (library-verified, no manual crypto) and returns its decoded claims.
    Raises firebase_admin.auth.* exceptions (invalid/expired/revoked) on failure —
    callers translate those into a 401."""
    return firebase_auth.verify_id_token(id_token, app=_get_app(), check_revoked=True)
