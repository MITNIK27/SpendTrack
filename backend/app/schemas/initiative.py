import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import CategoryRead
from app.schemas.spend_request import SpendRequestRead
from app.schemas.user import UserRead


class InitiativeCreate(BaseModel):
    name: str = Field(min_length=1)
    type: str | None = None
    category_id: uuid.UUID | None = None
    event_date: date | None = None
    location: str | None = None
    currency: str = "INR"
    team_member_ids: list[uuid.UUID] = []

    target_audience: str | None = None
    objective: str | None = None
    estimated_total_budget: Decimal | None = Field(default=None, ge=0)
    expected_leads_meetings: str | None = None


class InitiativeUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    category_id: uuid.UUID | None = None
    event_date: date | None = None
    location: str | None = None
    currency: str | None = None
    team_member_ids: list[uuid.UUID] | None = None

    target_audience: str | None = None
    objective: str | None = None
    estimated_total_budget: Decimal | None = Field(default=None, ge=0)
    expected_leads_meetings: str | None = None


class InitiativeStatusUpdate(BaseModel):
    status: str


class InitiativeSubmitInput(BaseModel):
    # Which currently-draft spend requests to submit alongside the initiative
    # itself, so it never goes live with spend hidden inside it. Defaults to
    # none — the frontend always sends the team member's actual selection.
    spend_request_ids: list[uuid.UUID] = []


class InitiativeBudgetDecisionInput(BaseModel):
    # Only ever applies to an initiative with zero spend-breakdown rows —
    # one with a real breakdown is decided per-line instead. Comment is
    # optional either way (unlike a SpendRequest reject, which requires one).
    action: str
    comment: str | None = None


class InitiativeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    type: str | None
    category: CategoryRead | None = None
    owner: UserRead
    event_date: date | None
    location: str | None
    currency: str
    status: str
    team_members: list[UserRead] = []

    target_audience: str | None
    objective: str | None
    estimated_total_budget: Decimal | None
    expected_leads_meetings: str | None

    budget_decision: str | None
    budget_approved_amount: Decimal | None
    budget_decided_at: datetime | None
    budget_decision_comment: str | None
    spend_request_count: int
    total_requested_amount: Decimal | None
    total_approved_amount: Decimal

    created_at: datetime


class InitiativeFinancialSummary(BaseModel):
    total_requested: str
    total_approved: str
    total_pending: str
    total_actual: str
    total_balance: str
    spend_request_count: int


class InitiativeDetail(InitiativeRead):
    spend_requests: list[SpendRequestRead]
    financial_summary: InitiativeFinancialSummary
