from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID

from app.core.db import Base

initiative_team_members = Table(
    "initiative_team_members",
    Base.metadata,
    Column("initiative_id", UUID(as_uuid=True), ForeignKey("initiatives.id"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
)

spend_request_team_members = Table(
    "spend_request_team_members",
    Base.metadata,
    Column("spend_request_id", UUID(as_uuid=True), ForeignKey("spend_requests.id"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
)
