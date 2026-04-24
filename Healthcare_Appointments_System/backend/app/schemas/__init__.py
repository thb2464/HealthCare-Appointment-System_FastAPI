from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str       # user id as string
    role: str
    type: str      # "access" or "refresh"


class RefreshRequest(BaseModel):
    refresh_token: str


class MessageResponse(BaseModel):
    """Generic success message envelope."""
    message: str


class PaginatedResponse(BaseModel):
    """Generic pagination wrapper — subclass or use as-is."""
    total: int
    page: int
    page_size: int
    items: list
