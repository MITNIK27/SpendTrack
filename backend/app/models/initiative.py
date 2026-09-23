import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.associations import initiative_team_members

INITIATIVE_STATUSES = ("draft", "active", "closed", "archived")
INITIATIVE_BUDGET_DECISIONS = ("approved", "rejected")


class Initiative(Base):
    __tablename__ = "initiatives"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str | None] = mapped_column(String, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(*INITIATIVE_STATUSES, name="initiative_status"), nullable=False, default="draft"
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")

    # The taxonomy category this initiative belongs to (same A-Q list used by
    # spend breakdown rows). Nullable so existing initiatives aren't broken —
    # the frontend requires it going forward. Used for reporting when this
    # initiative has no spend breakdown of its own (each breakdown row's own
    # category drives reporting once one exists).
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)

    target_audience: Mapped[str | None] = mapped_column(Text, nullable=True)
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_total_budget: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    expected_leads_meetings: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The initiative's own budget decision — used only when it has no spend
    # breakdown rows of its own (a budget backed by a real breakdown is
    # decided per-line instead, via SpendRequest/ApprovalAction). One-shot:
    # once set, this initiative's budget is never re-decided.
    budget_decision: Mapped[str | None] = mapped_column(
        Enum(*INITIATIVE_BUDGET_DECISIONS, name="initiative_budget_decision"), nullable=True
    )
    budget_approved_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    budget_decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    budget_decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    budget_decision_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship(foreign_keys=[owner_id])  # noqa: F821
    category: Mapped["Category | None"] = relationship()  # noqa: F821
    budget_decided_by: Mapped["User | None"] = relationship(foreign_keys=[budget_decided_by_id])  # noqa: F821
    spend_requests: Mapped[list["SpendRequest"]] = relationship(  # noqa: F821
        back_populates="initiative", order_by="SpendRequest.created_at"
    )
    team_members: Mapped[list["User"]] = relationship(secondary=initiative_team_members)  # noqa: F821

    @property
    def spend_request_count(self) -> int:
        return len(self.spend_requests)

    @property
    def total_requested_amount(self) -> Decimal | None:
        """Sum of every spend request's requested_amount, or None when there's
        no breakdown at all yet — lets a caller tell "nothing requested" apart
        from "zero requested". Mirrors spend_request_count's simplification of
        summing over every spend request rather than only the ones visible to
        a particular viewer (that filtering only happens on the detail
        endpoint, where the full objects are already loaded per-request)."""
        if not self.spend_requests:
            return None
        return sum((sr.requested_amount for sr in self.spend_requests), start=Decimal("0"))

    @property
    def total_approved_amount(self) -> Decimal:
        """Sum of every spend request's approved_amount (skipping any not yet
        decided), or — for an initiative with no breakdown of its own — its
        own approved budget, if its budget has been approved. Mirrors the
        same fallback `_financial_summary` uses on the detail endpoint, so
        this always lines up with what that page shows."""
        if self.spend_requests:
            return sum(
                (sr.approved_amount for sr in self.spend_requests if sr.approved_amount is not None),
                start=Decimal("0"),
            )
        if self.budget_decision == "approved" and self.budget_approved_amount is not None:
            return self.budget_approved_amount
        return Decimal("0")
