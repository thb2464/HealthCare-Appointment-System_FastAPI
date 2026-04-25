from datetime import datetime

from pydantic import BaseModel, Field

from app.models.appointment import AppointmentStatus
from app.schemas.user import UserPublic
from app.schemas.doctor import DoctorListItem


# ── Request schemas ────────────────────────────────────────────────────────────
class AppointmentCreate(BaseModel):
    doctor_id: int
    scheduled_at: datetime = Field(..., description="ISO-8601 UTC datetime for the slot start")
    reason: str | None = Field(default=None, max_length=500)


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus
    notes: str | None = Field(default=None, max_length=2000)


class AppointmentReschedule(BaseModel):
    scheduled_at: datetime = Field(..., description="New ISO-8601 UTC datetime")


# ── Response schemas ───────────────────────────────────────────────────────────
class AppointmentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    scheduled_at: datetime
    end_at: datetime
    status: AppointmentStatus
    reason: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    patient: UserPublic
    doctor: DoctorListItem


class AppointmentListResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    scheduled_at: datetime
    end_at: datetime
    status: AppointmentStatus
    reason: str | None = None
    notes: str | None = None
    created_at: datetime
    patient: UserPublic
    doctor: DoctorListItem
