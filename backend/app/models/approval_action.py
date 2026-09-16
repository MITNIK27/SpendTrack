import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

APPROVAL_ACTIONS = ("approve", "approve_different_amount", "reject", "request_changes")


class ApprovalAction(Base):
    """One approver decision on a spend request. Append-only — no PATCH/DELETE route
    is ever exposed on this table; it's the immutable record behind `spend_requests`'
    current `status`/`approved_amount`, which are just a denormalized snapshot of the
    latest decision for querying convenience."""

    __tablename__ = "approval_actions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spend_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("spend_requests.id", ondelete="CASCADE"), nullable=False
    )
    # Matches spend_requests.current_cycle at the time of this action, so a decision
    # from an earlier submit/resubmit cycle is never confused with the current one.
    cycle: Mapped[int] = mapped_column(Integer, nullable=False)
    approver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action: Mapped[str] = mapped_column(Enum(*APPROVAL_ACTIONS, name="approval_action_type"), nullable=False)
    # Snapshot of the amount as it stood when this decision was made — immune to any
    # later edits to the spend request (which can't happen once decided out anyway,
    # but this keeps the history honest even if that rule ever changes).
    requested_amount_at_time: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    approved_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    spend_request: Mapped["SpendRequest"] = relationship(back_populates="approval_actions")  # noqa: F821
    approver: Mapped["User"] = relationship()  # noqa: F821
