import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class SpendRequestLineItem(Base):
    """One row of a spend request's cost breakdown (e.g. Registration ₹2,00,000,
    Booth ₹5,00,000, ...). Optional — a simple spend request can have zero line items
    and rely on `requested_amount` alone; when present, the service layer validates
    that they sum to `requested_amount`."""

    __tablename__ = "spend_request_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spend_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("spend_requests.id", ondelete="CASCADE"), nullable=False
    )
    item: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    spend_request: Mapped["SpendRequest"] = relationship(back_populates="line_items")  # noqa: F821
