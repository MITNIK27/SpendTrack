import uuid
from decimal import Decimal

from pydantic import BaseModel


class LatestPendingRequest(BaseModel):
    id: uuid.UUID
    name: str
    owner_name: str
    estimated_total_budget: Decimal | None
    currency: str
