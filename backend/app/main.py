from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import activity, auth, categories, initiatives, reports, search, spend_requests, users
from app.core.config import settings

app = FastAPI(title="InfoBeans Marketing Spend Portal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
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
