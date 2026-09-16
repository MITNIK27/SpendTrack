import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(1), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    requires_freetext_description: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    subcategories: Mapped[list["Subcategory"]] = relationship(
        back_populates="category", order_by="Subcategory.sort_order"
    )


class Subcategory(Base):
    __tablename__ = "subcategories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Admin-configurable list of extra justification questions to ask when this
    # subcategory is selected, e.g. [{"key": "attendees", "label": "Number of attendees",
    # "type": "number", "required": false}, ...]. Answers land in
    # SpendRequest.dynamic_answers, keyed the same way. Null/empty = no extra questions.
    dynamic_field_schema: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    category: Mapped[Category] = relationship(back_populates="subcategories")
