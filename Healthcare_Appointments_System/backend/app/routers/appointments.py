"""
Appointments router — booking, listing, status updates, rescheduling, cancellation.

Booking logic (formerly BookingService) is co-located here in the monolith.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, CurrentPatient, DBSession
from app.models.appointment import Appointment, AppointmentStatus
from app.models.availability import Availability
from app.models.doctor import Doctor
from app.models.user import UserRole
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentStatusUpdate,
    AppointmentReschedule,
    AppointmentResponse,
    AppointmentListResponse,
)

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])

_LOAD = [
    selectinload(Appointment.patient),
    selectinload(Appointment.doctor).selectinload(Doctor.user),
    selectinload(Appointment.doctor).selectinload(Doctor.specialty),
]


# ══════════════════════════════════════════════════════════════════════════════
# Booking helpers (inlined from BookingService)
# ══════════════════════════════════════════════════════════════════════════════

def _slot_lock_key(doctor_id: int, scheduled_at: datetime) -> int:
    """Stable 64-bit integer for pg_try_advisory_xact_lock."""
    epoch_minutes = int(scheduled_at.timestamp()) // 60
    return ((doctor_id & 0xFFFFFFFF) << 32) | (epoch_minutes & 0xFFFFFFFF)


async def _acquire_advisory_lock(db: AsyncSession, lock_key: int) -> None:
    try:
        result = await db.execute(
            text("SELECT pg_try_advisory_xact_lock(:key)"),
            {"key": lock_key},
        )
        if not result.scalar_one():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This slot is currently being booked. Please try again.",
            )
    except OperationalError:
        # pg_try_advisory_xact_lock is PostgreSQL-only; silently skip on other
        # engines (e.g. SQLite used in tests).  The DB-level unique constraint
        # on (doctor_id, scheduled_at) still prevents double-booking.
        pass


async def _get_active_doctor(db: AsyncSession, doctor_id: int) -> Doctor:
    from app.models.user import User

    result = await db.execute(
        select(Doctor)
        .join(Doctor.user)
        .where(Doctor.id == doctor_id, User.is_active == True)  # noqa: E712
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found or account is inactive",
        )
    return doctor


async def _get_slot_duration(db: AsyncSession, doctor_id: int, scheduled_at: datetime) -> int:
    """Return slot_duration_minutes from matching availability window, default 30."""
    slot_time = scheduled_at.astimezone(timezone.utc).time().replace(second=0, microsecond=0)
    weekday = scheduled_at.astimezone(timezone.utc).weekday()
    result = await db.execute(
        select(Availability).where(
            Availability.doctor_id == doctor_id,
            Availability.day_of_week == weekday,
            Availability.start_time <= slot_time,
            Availability.end_time > slot_time,
            Availability.is_active == True,  # noqa: E712
        )
    )
    window = result.scalar_one_or_none()
    return window.slot_duration_minutes if window else 30


async def _is_slot_available(db: AsyncSession, doctor_id: int, scheduled_at: datetime) -> bool:
    utc_dt = scheduled_at.astimezone(timezone.utc)
    slot_time = utc_dt.time().replace(second=0, microsecond=0)
    weekday = utc_dt.weekday()

    result = await db.execute(
        select(Availability).where(
            Availability.doctor_id == doctor_id,
            Availability.day_of_week == weekday,
            Availability.is_active == True,  # noqa: E712
        )
    )
    windows = list(result.scalars().all())
    if not windows or not any(w.start_time <= slot_time < w.end_time for w in windows):
        return False

    conflict = await db.execute(
        select(Appointment.scheduled_at).where(
            Appointment.doctor_id == doctor_id,
            Appointment.scheduled_at == utc_dt.replace(second=0, microsecond=0),
            Appointment.status.notin_([AppointmentStatus.CANCELLED]),
        )
    )
    return conflict.scalar_one_or_none() is None


def _validate_status_transition(
    current: AppointmentStatus,
    new: AppointmentStatus,
    role: UserRole,
) -> None:
    allowed: dict[AppointmentStatus, set[AppointmentStatus]] = {
        AppointmentStatus.PENDING: {AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED},
        AppointmentStatus.CONFIRMED: {
            AppointmentStatus.COMPLETED,
            AppointmentStatus.CANCELLED,
            AppointmentStatus.RESCHEDULED,
        },
        AppointmentStatus.RESCHEDULED: {AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED},
        AppointmentStatus.COMPLETED: set(),
        AppointmentStatus.CANCELLED: set(),
    }
    if new not in allowed.get(current, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Transition {current.value} → {new.value} is not allowed. "
                f"Valid transitions: {[s.value for s in allowed.get(current, set())]}"
            ),
        )
    if new == AppointmentStatus.COMPLETED and role != UserRole.DOCTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can mark appointments as COMPLETED",
        )
    if new == AppointmentStatus.CONFIRMED and role == UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors or admins can confirm appointments",
        )


async def _book(
    *,
    db: AsyncSession,
    patient_id: int,
    doctor_id: int,
    scheduled_at: datetime,
    reason: str | None,
) -> Appointment:
    await _get_active_doctor(db, doctor_id)

    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    else:
        scheduled_at = scheduled_at.astimezone(timezone.utc)

    if scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot book an appointment in the past",
        )

    if not await _is_slot_available(db, doctor_id, scheduled_at):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requested time slot is not available for this doctor",
        )

    lock_key = _slot_lock_key(doctor_id, scheduled_at)
    await _acquire_advisory_lock(db, lock_key)

    conflict = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.scheduled_at == scheduled_at,
            Appointment.status.notin_([AppointmentStatus.CANCELLED]),
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This slot was just booked by someone else. Please choose another time.",
        )

    slot_minutes = await _get_slot_duration(db, doctor_id, scheduled_at)
    appt = Appointment(
        patient_id=patient_id,
        doctor_id=doctor_id,
        scheduled_at=scheduled_at,
        end_at=scheduled_at + timedelta(minutes=slot_minutes),
        status=AppointmentStatus.PENDING,
        reason=reason,
    )
    db.add(appt)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This slot is already booked (concurrent request). Please choose another time.",
        )
    return appt


async def _reschedule(
    *,
    db: AsyncSession,
    appointment: Appointment,
    new_time: datetime,
) -> None:
    if new_time.tzinfo is None:
        new_time = new_time.replace(tzinfo=timezone.utc)
    else:
        new_time = new_time.astimezone(timezone.utc)

    if new_time <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reschedule to a time in the past",
        )

    available = await _is_slot_available(db, appointment.doctor_id, new_time)
    if not available and new_time != appointment.scheduled_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requested time slot is not available for this doctor",
        )

    lock_key = _slot_lock_key(appointment.doctor_id, new_time)
    await _acquire_advisory_lock(db, lock_key)

    conflict = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == appointment.doctor_id,
            Appointment.scheduled_at == new_time,
            Appointment.status.notin_([AppointmentStatus.CANCELLED]),
            Appointment.id != appointment.id,
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This slot was just booked by someone else. Please choose another time.",
        )

    slot_minutes = await _get_slot_duration(db, appointment.doctor_id, new_time)
    appointment.scheduled_at = new_time
    appointment.end_at = new_time + timedelta(minutes=slot_minutes)
    appointment.status = AppointmentStatus.RESCHEDULED
    await db.flush()


# ══════════════════════════════════════════════════════════════════════════════
# Route handlers
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book an appointment (patient only)",
)
async def book_appointment(
    payload: AppointmentCreate,
    current_user: CurrentPatient,
    db: DBSession,
) -> Appointment:
    appt = await _book(
        db=db,
        patient_id=current_user.id,
        doctor_id=payload.doctor_id,
        scheduled_at=payload.scheduled_at,
        reason=payload.reason,
    )
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appt.id)
    )
    return result.scalar_one()


@router.get(
    "",
    response_model=list[AppointmentListResponse],
    summary="List appointments for current user",
)
async def list_appointments(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: AppointmentStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> list[Appointment]:
    stmt = select(Appointment).options(*_LOAD)

    if current_user.role == UserRole.PATIENT:
        stmt = stmt.where(Appointment.patient_id == current_user.id)
    elif current_user.role == UserRole.DOCTOR:
        doctor_result = await db.execute(
            select(Doctor).where(Doctor.user_id == current_user.id)
        )
        doctor = doctor_result.scalar_one_or_none()
        if not doctor:
            return []
        stmt = stmt.where(Appointment.doctor_id == doctor.id)
    # Admin sees all

    if status_filter:
        stmt = stmt.where(Appointment.status == status_filter)

    stmt = (
        stmt.order_by(Appointment.scheduled_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Get appointment detail",
)
async def get_appointment(
    appointment_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    _assert_access(current_user, appt)
    return appt


@router.patch(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Update appointment status / notes",
)
async def update_appointment(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    _assert_access(current_user, appt)
    _validate_status_transition(appt.status, payload.status, current_user.role)

    appt.status = payload.status
    if payload.notes is not None:
        appt.notes = payload.notes
    await db.flush()
    await db.refresh(appt)
    return appt


@router.patch(
    "/{appointment_id}/reschedule",
    response_model=AppointmentResponse,
    summary="Reschedule an appointment",
)
async def reschedule_appointment(
    appointment_id: int,
    payload: AppointmentReschedule,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    _assert_access(current_user, appt)

    if appt.status not in (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PENDING or CONFIRMED appointments can be rescheduled",
        )

    await _reschedule(db=db, appointment=appt, new_time=payload.scheduled_at)
    await db.refresh(appt)
    return appt


@router.delete(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Cancel an appointment",
)
async def cancel_appointment(
    appointment_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    _assert_access(current_user, appt)

    if appt.status in (AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a {appt.status.value} appointment",
        )
    appt.status = AppointmentStatus.CANCELLED
    await db.flush()
    await db.refresh(appt)
    return appt


# ── Access guard ───────────────────────────────────────────────────────────────
def _assert_access(user, appt: Appointment) -> None:
    if user.role == UserRole.ADMIN:
        return
    if user.role == UserRole.PATIENT and appt.patient_id == user.id:
        return
    if user.role == UserRole.DOCTOR and appt.doctor.user_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorised to access this appointment",
    )
