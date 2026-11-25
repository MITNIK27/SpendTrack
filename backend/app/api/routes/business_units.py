from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.business_unit import BusinessUnit
from app.schemas.business_unit import BusinessUnitRead

router = APIRouter(prefix="/business-units", tags=["business-units"])


@router.get("", response_model=list[BusinessUnitRead])
def list_business_units(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
) -> list[BusinessUnit]:
    stmt = select(BusinessUnit).where(BusinessUnit.is_active).order_by(BusinessUnit.sort_order)
    return list(db.scalars(stmt).all())
