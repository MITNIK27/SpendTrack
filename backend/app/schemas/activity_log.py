import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserRead


class ActivityLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action: str
    actor: UserRead | None
    log_metadata: dict | None
    created_at: datetime
