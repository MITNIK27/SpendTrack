from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import activity, admin, auth, categories, initiatives, reports, search, spend_requests, users
from app.core.config import settings

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


app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(initiatives.router, prefix="/api")
app.include_router(spend_requests.router, prefix="/api")
app.include_router(activity.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(search.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
