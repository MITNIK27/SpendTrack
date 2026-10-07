import logging
import time
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.background import BackgroundTask
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import activity, admin, auth, categories, fx, initiatives, reports, search, spend_requests, users
from app.core.config import settings
from app.core.logging_config import configure_logging
from app.services import email_service, email_templates, error_alert_service

configure_logging()
logger = logging.getLogger(__name__)

# Swagger UI / ReDoc / the raw OpenAPI schema expose the entire API surface
# (every route, every request/response shape) to anyone who finds the URL —
# fine for local dev, not for a publicly reachable production deployment.
_docs_enabled = settings.env != "production"

app = FastAPI(
    title="InfoBeans Marketing Spend Portal API",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.middleware("http")
async def request_logging(request: Request, call_next):
    """Persists every request (method, path, status, duration) via the DB
    logger — see app/core/logging_config.py. Only covers requests that
    produce a response here (success, and HTTPException-derived error
    responses); an unhandled exception propagates past this middleware and is
    logged with its full traceback by the exception_handler(Exception) below."""
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    logger.info(
        "%s %s -> %s (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        extra={"path": request.url.path, "method": request.method, "status_code": response.status_code},
    )
    return response


def _alert_task(*, status_code: int, method: str, path: str, message: str, stack_trace: str | None) -> BackgroundTask | None:
    """Builds a BackgroundTask that emails the error — or None for anything
    that isn't a real server-side failure (ordinary 4xx responses, like an
    expired session's 401 or a validation 400, are expected user-side
    conditions, not incidents) or that alerted recently for this (status,
    path). Run as a Response's `background` so the SMTP round trip never
    blocks the error response."""
    if status_code < 500:
        return None
    if not error_alert_service.should_alert(status_code, path):
        return None
    subject, html = email_templates.error_alert(
        status_code=status_code, method=method, path=path, message=message, user_email=None, stack_trace=stack_trace
    )
    return BackgroundTask(email_service.send_email, [settings.error_alert_email], subject, html)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    logger.warning(
        "HTTP %s on %s %s: %s",
        exc.status_code,
        request.method,
        request.url.path,
        exc.detail,
        extra={"path": request.url.path, "method": request.method, "status_code": exc.status_code},
    )
    response = JSONResponse(
        status_code=exc.status_code, content={"detail": exc.detail}, headers=getattr(exc, "headers", None)
    )
    response.background = _alert_task(
        status_code=exc.status_code,
        method=request.method,
        path=request.url.path,
        message=str(exc.detail),
        stack_trace=None,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    stack_trace = traceback.format_exc()
    logger.error(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=exc,
        extra={"path": request.url.path, "method": request.method, "status_code": 500},
    )
    response = JSONResponse(status_code=500, content={"detail": "Internal server error."})
    response.background = _alert_task(
        status_code=500, method=request.method, path=request.url.path, message=str(exc), stack_trace=stack_trace
    )
    return response


app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(fx.router, prefix="/api")
app.include_router(initiatives.router, prefix="/api")
app.include_router(spend_requests.router, prefix="/api")
app.include_router(activity.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(search.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
