import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")


class LogEntry(Base):
    __tablename__ = "logs"
    __table_args__ = (Index("ix_logs_created_at", "created_at"), Index("ix_logs_level", "level"))

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    level: Mapped[str] = mapped_column(Enum(*LOG_LEVELS, name="log_level"), nullable=False)
    logger_name: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    module: Mapped[str | None] = mapped_column(String, nullable=True)

    path: Mapped[str | None] = mapped_column(String, nullable=True)
    method: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Denormalized so a log row survives the user being deleted, and so
    # reading logs never needs a join just to show who was involved.
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    user_email: Mapped[str | None] = mapped_column(String, nullable=True)

    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    user: Mapped["User | None"] = relationship()  # noqa: F821
