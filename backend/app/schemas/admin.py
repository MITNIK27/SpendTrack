from pydantic import BaseModel


class UserUpdateInput(BaseModel):
    role: str | None = None
    is_active: bool | None = None
