from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.appointment import AppointmentStatus, RefundStatus
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
    cancellation_reason: str | None = Field(default=None, max_length=500)
    follow_up_recommended: bool | None = None
    follow_up_date: date | None = None


class AppointmentReschedule(BaseModel):
    scheduled_at: datetime = Field(..., description="New ISO-8601 UTC datetime")


class AppointmentNoShowRequest(BaseModel):
    cancellation_reason: str | None = Field(default=None, max_length=500)


class AppointmentCancelRequest(BaseModel):
    cancellation_reason: str | None = Field(default=None, max_length=500)


class AppointmentFollowUpCreate(BaseModel):
    scheduled_at: datetime = Field(..., description="ISO-8601 UTC datetime for the follow-up slot")
    reason: str | None = Field(default=None, max_length=500)


# ── Response schemas ───────────────────────────────────────────────────────────
class AppointmentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    scheduled_at: datetime
    end_at: datetime
    status: AppointmentStatus
    reason: str | None = None
    notes: str | None = None
    cancellation_reason: str | None = None
    deposit_paid: bool = False
    deposit_amount: Decimal | None = None
    refund_amount: Decimal | None = None
    penalty_amount: Decimal | None = None
    refund_status: RefundStatus = RefundStatus.NONE
    reschedule_count: int = 0
    reschedule_fee_applied: bool = False
    proposed_new_time: datetime | None = None
    reschedule_requested_by: str | None = None
    follow_up_of: int | None = None
    follow_up_recommended: bool = False
    follow_up_date: date | None = None
    reminder_24h_sent: bool = False
    reminder_2h_sent: bool = False
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
    cancellation_reason: str | None = None
    deposit_paid: bool = False
    deposit_amount: Decimal | None = None
    refund_amount: Decimal | None = None
    penalty_amount: Decimal | None = None
    refund_status: RefundStatus = RefundStatus.NONE
    reschedule_count: int = 0
    reschedule_fee_applied: bool = False
    proposed_new_time: datetime | None = None
    reschedule_requested_by: str | None = None
    follow_up_of: int | None = None
    follow_up_recommended: bool = False
    follow_up_date: date | None = None
    created_at: datetime
    patient: UserPublic
    doctor: DoctorListItem


class CheckinTokenResponse(BaseModel):
    token: str
    expires_at: datetime
    checkin_url: str
