from decimal import Decimal
from datetime import time

from pydantic import BaseModel, Field

from app.schemas.user import UserPublic


# ── Specialty ──────────────────────────────────────────────────────────────────
class SpecialtyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    icon: str | None = None


class SpecialtyCreate(SpecialtyBase):
    pass


class SpecialtyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None
    icon: str | None = None


class SpecialtyResponse(SpecialtyBase):
    model_config = {"from_attributes": True}
    id: int


# ── Availability ───────────────────────────────────────────────────────────────
class AvailabilityBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: time
    end_time: time
    slot_duration_minutes: int = Field(default=30, ge=10, le=120)
    is_active: bool = True


class AvailabilityCreate(AvailabilityBase):
    pass


class AvailabilityResponse(AvailabilityBase):
    model_config = {"from_attributes": True}
    id: int
    doctor_id: int


# ── Doctor ─────────────────────────────────────────────────────────────────────
class DoctorProfileUpdate(BaseModel):
    """Doctor updates their own profile."""
    bio: str | None = None
    license_number: str | None = Field(default=None, max_length=100)
    years_experience: int | None = Field(default=None, ge=0, le=60)
    clinic_address: str | None = Field(default=None, max_length=500)
    consultation_fee: Decimal | None = Field(default=None, ge=0)
    specialty_id: int | None = None


class DoctorResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    user_id: int
    bio: str | None = None
    license_number: str | None = None
    years_experience: int | None = None
    clinic_address: str | None = None
    consultation_fee: Decimal | None = None
    avg_rating: Decimal | None = None
    specialty: SpecialtyResponse | None = None
    user: UserPublic


class DoctorListItem(BaseModel):
    """Compact representation used in search results."""
    model_config = {"from_attributes": True}

    id: int
    user: UserPublic
    specialty: SpecialtyResponse | None = None
    clinic_address: str | None = None
    consultation_fee: Decimal | None = None
    avg_rating: Decimal | None = None
    years_experience: int | None = None


# ── Availability bulk set ─────────────────────────────────────────────────────
class AvailabilityBulkSet(BaseModel):
    """Replace all availability slots for a doctor."""
    slots: list[AvailabilityCreate]
