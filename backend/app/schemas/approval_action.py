import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserRead


class ApprovalDecisionInput(BaseModel):
    action: str
    approved_amount: Decimal | None = Field(default=None, gt=0)
    comment: str | None = None


class ApproveBatchItem(BaseModel):
    spend_request_id: uuid.UUID
    comment: str | None = None


class ApproveBatchInput(BaseModel):
    decisions: list[ApproveBatchItem] = []


class ApprovalActionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cycle: int
    approver: UserRead
    action: str
    requested_amount_at_time: Decimal
    approved_amount: Decimal | None
    comment: str | None
    created_at: datetime
