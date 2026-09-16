import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.associations import initiative_team_members

INITIATIVE_STATUSES = ("draft", "active", "closed", "archived")


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

    target_audience: Mapped[str | None] = mapped_column(Text, nullable=True)
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_total_budget: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    expected_leads_meetings: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship()  # noqa: F821
    spend_requests: Mapped[list["SpendRequest"]] = relationship(  # noqa: F821
        back_populates="initiative", order_by="SpendRequest.created_at"
    )
    team_members: Mapped[list["User"]] = relationship(secondary=initiative_team_members)  # noqa: F821
