import uuid

from pydantic import BaseModel, ConfigDict


class SubcategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    dynamic_field_schema: list[dict] | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    requires_freetext_description: bool
    subcategories: list[SubcategoryRead] = []
