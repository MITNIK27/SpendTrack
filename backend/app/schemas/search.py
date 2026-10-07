import uuid
from decimal import Decimal

from pydantic import BaseModel


class SearchRequestResult(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    budget_decision: str | None
    approval_progress: str | None
    spend_request_count: int
    category_name: str | None
    estimated_total_budget: Decimal | None
    currency: str
    owner_name: str | None


class SearchResponse(BaseModel):
    requests: list[SearchRequestResult]
