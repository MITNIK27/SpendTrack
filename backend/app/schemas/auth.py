from pydantic import BaseModel

from app.schemas.user import UserRead


class GoogleSignInInput(BaseModel):
    id_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
