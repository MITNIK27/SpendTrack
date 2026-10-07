from datetime import date

from pydantic import BaseModel


class FxRateRead(BaseModel):
    rate: str
    as_of: date
    is_stale: bool
