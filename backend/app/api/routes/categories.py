from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.category import Category
from app.schemas.category import CategoryRead

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
def list_categories(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
) -> list[Category]:
    stmt = select(Category).where(Category.is_active).order_by(Category.sort_order)
    return list(db.scalars(stmt).all())
