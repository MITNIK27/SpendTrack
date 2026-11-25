from datetime import date

from pydantic import BaseModel


class FxRateRead(BaseModel):
    currency: str
    rate_to_inr: str
    as_of: date
    is_stale: bool
