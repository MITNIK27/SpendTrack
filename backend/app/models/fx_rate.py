import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class FxRate(Base):
    """One row per (currency, day): how many INR one unit of `currency` was
    worth that day. INR itself is never stored — it's always 1."""

    __tablename__ = "fx_rates"
    __table_args__ = (UniqueConstraint("currency", "as_of", name="uq_fx_rates_currency_as_of"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    rate_to_inr: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
