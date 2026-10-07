from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.fx import FxRateRead
from app.services import fx_service

router = APIRouter(prefix="/fx", tags=["fx"])


@router.get("/usd-inr", response_model=FxRateRead)
def get_usd_inr_rate(_user=Depends(get_current_user)) -> FxRateRead:
    rate, as_of, is_stale = fx_service.get_usd_inr_rate()
    return FxRateRead(rate=str(rate), as_of=as_of, is_stale=is_stale)
