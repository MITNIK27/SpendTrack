import uuid

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

# Fixed id (seeded by migration d5e1a7c3b9f2) so a NOT NULL server_default on
# spend_requests.business_unit_id can point at it — rows inserted by code that
# predates this column still land on Corporate instead of failing.
CORPORATE_BUSINESS_UNIT_ID = uuid.UUID("6b1f9d2e-3c4a-4e8b-9f70-c0a2e5d81b36")


class BusinessUnit(Base):
    __tablename__ = "business_units"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
