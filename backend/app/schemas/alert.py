import uuid

from pydantic import BaseModel


class AlertItem(BaseModel):
    type: str
    severity: str  # "warning" | "critical"
    message: str
    entity_type: str  # "spend_request" | "initiative"
    entity_id: uuid.UUID
