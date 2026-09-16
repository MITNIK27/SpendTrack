import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import CategoryRead, SubcategoryRead
from app.schemas.user import UserRead


class SpendRequestLineItemInput(BaseModel):
    item: str = Field(min_length=1)
    amount: Decimal = Field(gt=0)


class SpendRequestLineItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    item: str
    amount: Decimal


class SpendRequestCreate(BaseModel):
    category_id: uuid.UUID
    subcategory_id: uuid.UUID | None = None
    other_description: str | None = None

    description: str | None = None
    vendor: str | None = None

    requested_amount: Decimal = Field(gt=0)
    currency: str = "INR"

    team_member_ids: list[uuid.UUID] = []

    vendor_quotation_amount: Decimal | None = Field(default=None, ge=0)
    dynamic_answers: dict | None = None
    line_items: list[SpendRequestLineItemInput] = []


class SpendRequestUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    subcategory_id: uuid.UUID | None = None
    other_description: str | None = None

    description: str | None = None
    vendor: str | None = None

    requested_amount: Decimal | None = Field(default=None, gt=0)
    currency: str | None = None

    team_member_ids: list[uuid.UUID] | None = None

    vendor_quotation_amount: Decimal | None = Field(default=None, ge=0)
    dynamic_answers: dict | None = None
    line_items: list[SpendRequestLineItemInput] | None = None


class ActualSpendInput(BaseModel):
    actual_amount: Decimal = Field(gt=0)
    actual_spend_date: datetime | None = None


class SpendRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    initiative_id: uuid.UUID
    created_by: UserRead
    category: CategoryRead
    subcategory: SubcategoryRead | None
    other_description: str | None

    description: str | None
    vendor: str | None

    requested_amount: Decimal
    approved_amount: Decimal | None
    actual_amount: Decimal | None
    currency: str
    variance: Decimal | None
    latest_decision_comment: str | None

    status: str
    current_cycle: int
    submitted_at: datetime | None
    decided_at: datetime | None
    spent_at: datetime | None
    team_members: list[UserRead] = []

    vendor_quotation_amount: Decimal | None
    dynamic_answers: dict | None
    line_items: list[SpendRequestLineItemRead] = []

    created_at: datetime
    updated_at: datetime
