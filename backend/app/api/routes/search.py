from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.search import SearchResponse
from app.services import search_service

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResponse)
def search(
    q: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SearchResponse:
    return search_service.search(db, query=q, user=user)
