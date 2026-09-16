import uuid
from decimal import Decimal

from pydantic import BaseModel


class SearchInitiativeResult(BaseModel):
    id: uuid.UUID
    name: str
    status: str


class SearchSpendRequestResult(BaseModel):
    id: uuid.UUID
    description: str | None
    initiative_id: uuid.UUID
    initiative_name: str
    category_name: str
    vendor: str | None
    status: str
    requested_amount: Decimal


class SearchResponse(BaseModel):
    initiatives: list[SearchInitiativeResult]
    spend_requests: list[SearchSpendRequestResult]
