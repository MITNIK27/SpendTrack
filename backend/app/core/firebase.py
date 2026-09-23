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
    callers translate those into a 401.

    No `check_revoked` — that flag makes the SDK do a live network round-trip to
    Google on every sign-in just to check revocation, which was the dominant source
    of sign-in latency here. A revoked/deactivated account is still caught within
    `jwt_expires_minutes` (the app session expiring forces re-auth), so this trades
    near-instant revocation detection for a materially faster sign-in every time.

    `clock_skew_seconds` tolerates small, ordinary drift between this machine's clock
    and Google's — the Admin SDK otherwise rejects a token whose `iat` is even one
    second ahead of the local clock ("Token used too early")."""
    return firebase_auth.verify_id_token(id_token, app=_get_app(), clock_skew_seconds=10)
