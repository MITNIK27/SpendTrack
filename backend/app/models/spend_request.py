import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.associations import spend_request_team_members

SPEND_REQUEST_STATUSES = (
    "draft",
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "changes_requested",
    "resubmitted",
    "spent",
    "closed",
)

# Statuses in which the financial fields (amount, category, ...) may still be edited.
EDITABLE_STATUSES = ("draft", "changes_requested")


class SpendRequest(Base):
    __tablename__ = "spend_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    initiative_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("initiatives.id"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    category_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False)
    subcategory_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subcategories.id"), nullable=True
    )
    other_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    vendor: Mapped[str | None] = mapped_column(String, nullable=True)

    requested_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    approved_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    actual_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")

    vendor_quotation_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    # Answers to the category/subcategory-specific dynamic justification questions
    # (schema for the questions themselves lives on Subcategory.dynamic_field_schema).
    dynamic_answers: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    status: Mapped[str] = mapped_column(
        Enum(*SPEND_REQUEST_STATUSES, name="spend_request_status"), nullable=False, default="draft"
    )
    current_cycle: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    spent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    initiative: Mapped["Initiative"] = relationship(back_populates="spend_requests")  # noqa: F821
    created_by: Mapped["User"] = relationship()  # noqa: F821
    category: Mapped["Category"] = relationship()  # noqa: F821
    subcategory: Mapped["Subcategory | None"] = relationship()  # noqa: F821
    team_members: Mapped[list["User"]] = relationship(secondary=spend_request_team_members)  # noqa: F821
    line_items: Mapped[list["SpendRequestLineItem"]] = relationship(
        back_populates="spend_request", order_by="SpendRequestLineItem.sort_order", cascade="all, delete-orphan"
    )
    approval_actions: Mapped[list["ApprovalAction"]] = relationship(  # noqa: F821
        back_populates="spend_request", order_by="ApprovalAction.created_at"
    )

    @property
    def variance(self) -> Decimal | None:
        """approved_amount - requested_amount. None until a decision has been made."""
        if self.approved_amount is None:
            return None
        return self.approved_amount - self.requested_amount

    @property
    def latest_decision_comment(self) -> str | None:
        """The remark attached to this request's most recent decision, if any —
        what the UI calls "Approval Remarks" once a request is no longer pending."""
        if not self.approval_actions:
            return None
        return self.approval_actions[-1].comment
