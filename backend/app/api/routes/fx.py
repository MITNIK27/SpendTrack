from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.fx import FxRateRead
from app.services import fx_service

router = APIRouter(prefix="/fx", tags=["fx"])


@router.get("/rates", response_model=list[FxRateRead])
def get_rates(db: Session = Depends(get_db), _user=Depends(get_current_user)) -> list[FxRateRead]:
    """Today's INR value of one unit of each non-INR currency."""
    book = fx_service.RateBook.load(db)
    today = date.today()
    return [
        FxRateRead(currency=c, rate_to_inr=str(r.rate_to_inr), as_of=r.as_of, is_stale=r.is_stale)
        for c in fx_service.PRICED_CURRENCIES
        for r in [book.rate(c, today)]
    ]
