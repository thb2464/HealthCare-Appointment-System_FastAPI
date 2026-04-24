from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.user import UserPublic


# ── Request schemas ────────────────────────────────────────────────────────────
class ReviewCreate(BaseModel):
    appointment_id: int
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


# ── Response schemas ───────────────────────────────────────────────────────────
class ReviewResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    appointment_id: int
    rating: int
    comment: str | None = None
    created_at: datetime
    patient: UserPublic
