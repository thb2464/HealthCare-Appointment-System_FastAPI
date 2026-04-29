"""
Appointments router — booking, listing, status updates, rescheduling, cancellation, check-in.
Booking logic is co-located here in the monolith.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import time as _time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, CurrentPatient, DBSession
from app.models.appointment import Appointment, AppointmentStatus, RefundStatus
from app.models.availability import Availability
from app.models.doctor import Doctor
from app.models.user import UserRole
from app.models.waitlist import WaitlistEntry
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentStatusUpdate,
    AppointmentReschedule,
    AppointmentNoShowRequest,
    AppointmentCancelRequest,
    AppointmentFollowUpCreate,
    AppointmentResponse,
    AppointmentListResponse,
    CheckinTokenResponse,
)
from app.utils.email import (
    send_appointment_confirmation,
    send_appointment_confirmed_by_doctor,
    send_appointment_cancelled,
    send_appointment_completed,
    send_waitlist_slot_available,
    send_followup_suggestion,
    send_noshow_recorded,
)

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])

_LOAD = [
    selectinload(Appointment.patient),
    selectinload(Appointment.doctor).selectinload(Doctor.user),
    selectinload(Appointment.doctor).selectinload(Doctor.specialty),
]

# Token validity window (seconds)
_CHECKIN_TOKEN_TTL = 3600  

# Financial constants
_PENALTY_RATE = 0.30  


_VN_TZ = timezone(timedelta(hours=7))



# Booking helpers


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
    # Availability windows are in Vietnam local time, so convert to VN for comparison
    vn_dt = scheduled_at.astimezone(_VN_TZ)
    slot_time = vn_dt.time().replace(second=0, microsecond=0)
    weekday = vn_dt.weekday()
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
    # Availability windows are in Vietnam local time, so convert for comparison
    vn_dt = utc_dt.astimezone(_VN_TZ)
    slot_time = vn_dt.time().replace(second=0, microsecond=0)
    weekday = vn_dt.weekday()

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

    now = datetime.now(timezone.utc)
    conflict = await db.execute(
        select(Appointment.id).where(
            Appointment.doctor_id == doctor_id,
            Appointment.scheduled_at == utc_dt.replace(second=0, microsecond=0),
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NOSHOW]),
            # Exclude expired payment holds (PENDING with expired payment_expires_at)
            ~(
                (Appointment.status == AppointmentStatus.PENDING)
                & (Appointment.payment_expires_at != None)  # noqa: E711
                & (Appointment.payment_expires_at < now)
            ),
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
            AppointmentStatus.ARRIVED,
            AppointmentStatus.COMPLETED,
            AppointmentStatus.CANCELLED,
            AppointmentStatus.RESCHEDULED,
            AppointmentStatus.NOSHOW,
            AppointmentStatus.RESCHEDULE_REQUESTED,
        },
        AppointmentStatus.ARRIVED: {
            AppointmentStatus.COMPLETED,
            AppointmentStatus.CANCELLED,
            AppointmentStatus.NOSHOW,
        },
        AppointmentStatus.RESCHEDULED: {AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED},
        AppointmentStatus.RESCHEDULE_REQUESTED: {
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.CANCELLED,
            AppointmentStatus.RESCHEDULED,
        },
        AppointmentStatus.COMPLETED: set(),
        AppointmentStatus.CANCELLED: set(),
        AppointmentStatus.NOSHOW: set(),
    }
    if new not in allowed.get(current, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Transition {current.value} → {new.value} is not allowed. "
                f"Valid transitions: {[s.value for s in allowed.get(current, set())]}"
            ),
        )
    if new == AppointmentStatus.COMPLETED and role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can mark appointments as COMPLETED",
        )
    if new == AppointmentStatus.CONFIRMED and role == UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors or admins can confirm appointments",
        )
    if new == AppointmentStatus.ARRIVED and role not in (
        UserRole.RECEPTIONIST, UserRole.ADMIN, UserRole.DOCTOR
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only receptionists, doctors, or admins can mark a patient as arrived",
        )
    if new == AppointmentStatus.NOSHOW and role not in (
        UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors, receptionists, or admins can mark a no-show",
        )


async def _book(
    *,
    db: AsyncSession,
    patient_id: int,
    doctor_id: int,
    scheduled_at: datetime,
    reason: str | None,
    follow_up_of: int | None = None,
) -> Appointment:
    await _get_active_doctor(db, doctor_id)

    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    else:
        scheduled_at = scheduled_at.astimezone(timezone.utc)

    now = datetime.now(timezone.utc)
    if scheduled_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot book an appointment in the past",
        )
    if scheduled_at < now + timedelta(days=2):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointments must be booked at least 2 days in advance",
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
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NOSHOW]),
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
        follow_up_of=follow_up_of,
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


# ── Financial helpers ─────────────────────────────────────────────────────────

def _calculate_cancellation_penalty(appt: Appointment) -> tuple[float, float]:
    """Returns (penalty_amount, refund_amount) based on TASK.md rules."""
    deposit = float(appt.deposit_amount or 0)
    if deposit <= 0 or not appt.deposit_paid:
        return 0.0, 0.0

    hours_until = (appt.scheduled_at - datetime.now(timezone.utc)).total_seconds() / 3600

    if hours_until >= 48:
        # Early cancel: 30% fee, 70% refund
        penalty = round(deposit * _PENALTY_RATE, 2)
        refund = round(deposit - penalty, 2)
    else:
        # Late cancel: forfeit 100%
        penalty = deposit
        refund = 0.0

    return penalty, refund


def _calculate_reschedule_penalty(appt: Appointment, new_time: datetime) -> float:
    """Returns penalty amount for rescheduling per TASK.md rules."""
    deposit = float(appt.deposit_amount or 0)
    if deposit <= 0 or not appt.deposit_paid:
        return 0.0

    count = (appt.reschedule_count or 0) + 1  # this will be the Nth reschedule
    hours_until = (new_time - datetime.now(timezone.utc)).total_seconds() / 3600

    if count == 1 and hours_until >= 48:
        return 0.0  # 1st reschedule >48h: free
    elif hours_until < 48:
        return round(deposit * _PENALTY_RATE, 2)  # late reschedule: 30%
    else:
        return round(deposit * _PENALTY_RATE, 2)  # subsequent reschedule >48h: surcharge


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
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NOSHOW]),
            Appointment.id != appointment.id,
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This slot was just booked by someone else. Please choose another time.",
        )

    slot_minutes = await _get_slot_duration(db, appointment.doctor_id, new_time)

    # Financial penalty
    penalty = _calculate_reschedule_penalty(appointment, new_time)
    appointment.reschedule_count = (appointment.reschedule_count or 0) + 1
    if penalty > 0:
        appointment.reschedule_fee_applied = True
        appointment.penalty_amount = (float(appointment.penalty_amount or 0)) + penalty

    appointment.scheduled_at = new_time
    appointment.end_at = new_time + timedelta(minutes=slot_minutes)
    appointment.status = AppointmentStatus.RESCHEDULED
    appointment.proposed_new_time = None
    appointment.reschedule_requested_by = None
    appointment.status_before_reschedule_request = None
    await db.flush()


async def _notify_waitlist(db: AsyncSession, doctor_id: int) -> None:
    """Notify the oldest waitlist patient for a doctor when a slot is freed."""
    result = await db.execute(
        select(WaitlistEntry)
        .options(
            selectinload(WaitlistEntry.patient),
            selectinload(WaitlistEntry.doctor).selectinload(Doctor.user),
        )
        .where(WaitlistEntry.doctor_id == doctor_id)
        .order_by(WaitlistEntry.created_at)
        .limit(1)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return
    doctor_name = entry.doctor.user.full_name if entry.doctor and entry.doctor.user else "your doctor"
    asyncio.create_task(
        send_waitlist_slot_available(
            to_email=entry.patient.email,
            patient_name=entry.patient.full_name,
            doctor_name=doctor_name,
        )
    )
    await db.delete(entry)
    await db.flush()


async def _auto_noshow_conflicts(
    db: AsyncSession,
    doctor_id: int,
    scheduled_at: datetime,
    exclude_appointment_id: int,
) -> None:
    """Auto-mark conflicting CONFIRMED/ARRIVED appointments as NOSHOW when a slot is definitively taken."""
    result = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.scheduled_at == scheduled_at,
            Appointment.id != exclude_appointment_id,
            Appointment.status.in_([AppointmentStatus.CONFIRMED, AppointmentStatus.ARRIVED]),
        )
    )
    conflicts = result.scalars().all()
    for appt in conflicts:
        appt.status = AppointmentStatus.NOSHOW
    if conflicts:
        await db.flush()


# ── Encounter auto-creation helper ────────────────────────────────────────────

async def _create_encounter_on_arrival(db: AsyncSession, appointment: Appointment) -> None:
    """Create an Encounter record when a patient arrives."""
    from app.models.encounter import Encounter
    existing = await db.execute(
        select(Encounter).where(Encounter.appointment_id == appointment.id)
    )
    if existing.scalar_one_or_none():
        return
    enc = Encounter(
        appointment_id=appointment.id,
        doctor_id=appointment.doctor_id,
        patient_id=appointment.patient_id,
    )
    db.add(enc)
    await db.flush()


# ── Check-in token helpers ─────────────────────────────────────────────────────

def _generate_checkin_token(appointment_id: int, secret: str) -> tuple[str, int]:
    """Returns (token, expires_at_unix)."""
    expires_at = int(_time.time()) + _CHECKIN_TOKEN_TTL
    msg = f"{appointment_id}:{expires_at}".encode()
    sig = hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()
    return f"{appointment_id}:{expires_at}:{sig}", expires_at


def _verify_checkin_token(token: str, secret: str) -> int:
    """Returns appointment_id if valid, raises HTTPException otherwise."""
    try:
        appt_id_str, expires_str, sig = token.split(":", 2)
        appt_id = int(appt_id_str)
        expires_at = int(expires_str)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid check-in token")

    if int(_time.time()) > expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Check-in token has expired")

    msg = f"{appt_id}:{expires_at}".encode()
    expected_sig = hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid check-in token")

    return appt_id


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
    appt = result.scalar_one()
    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "your doctor"
    asyncio.create_task(
        send_appointment_confirmation(
            to_email=current_user.email,
            patient_name=current_user.full_name,
            scheduled_at=appt.scheduled_at.isoformat(),
            doctor_name=doctor_name,
        )
    )
    return appt


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
    # Admin and Receptionist see all

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

    prev_status = appt.status
    new_status = payload.status
    appt.status = new_status
    if payload.notes is not None:
        appt.notes = payload.notes
    if payload.cancellation_reason is not None:
        appt.cancellation_reason = payload.cancellation_reason
    if new_status == AppointmentStatus.CONFIRMED:
        await _auto_noshow_conflicts(db, appt.doctor_id, appt.scheduled_at, appt.id)
    if new_status == AppointmentStatus.ARRIVED:
        await _create_encounter_on_arrival(db, appt)

    # Follow-up tracking (on COMPLETED)
    if new_status == AppointmentStatus.COMPLETED:
        if payload.follow_up_recommended is not None:
            appt.follow_up_recommended = payload.follow_up_recommended
        if payload.follow_up_date is not None:
            appt.follow_up_date = payload.follow_up_date

    await db.flush()
    await db.refresh(appt)

    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "your doctor"
    patient_email = appt.patient.email
    patient_name = appt.patient.full_name
    scheduled_str = appt.scheduled_at.isoformat()

    if payload.status == AppointmentStatus.CONFIRMED:
        asyncio.create_task(
            send_appointment_confirmed_by_doctor(
                to_email=patient_email,
                patient_name=patient_name,
                scheduled_at=scheduled_str,
                doctor_name=doctor_name,
            )
        )
    elif payload.status == AppointmentStatus.CANCELLED:
        # Apply cancellation penalty
        penalty, refund = _calculate_cancellation_penalty(appt)
        if penalty > 0 or refund > 0:
            appt.penalty_amount = penalty
            appt.refund_amount = refund
            appt.refund_status = RefundStatus.PENDING if refund > 0 else RefundStatus.NONE
            await db.flush()

        asyncio.create_task(
            send_appointment_cancelled(
                to_email=patient_email,
                patient_name=patient_name,
                scheduled_at=scheduled_str,
                doctor_name=doctor_name,
            )
        )
        if prev_status in (AppointmentStatus.CONFIRMED, AppointmentStatus.RESCHEDULED):
            await _notify_waitlist(db, appt.doctor_id)
    elif payload.status == AppointmentStatus.COMPLETED:
        asyncio.create_task(
            send_appointment_completed(
                to_email=patient_email,
                patient_name=patient_name,
                doctor_name=doctor_name,
            )
        )
        asyncio.create_task(
            send_followup_suggestion(
                to_email=patient_email,
                patient_name=patient_name,
                doctor_name=doctor_name,
            )
        )
    elif payload.status == AppointmentStatus.NOSHOW:
        # No-show: forfeit 100% deposit
        deposit = float(appt.deposit_amount or 0)
        if deposit > 0 and appt.deposit_paid:
            appt.penalty_amount = deposit
            appt.refund_amount = 0
            await db.flush()

        asyncio.create_task(
            send_noshow_recorded(
                to_email=patient_email,
                patient_name=patient_name,
                doctor_name=doctor_name,
            )
        )
        await _notify_waitlist(db, appt.doctor_id)

    return appt


# ── Reschedule negotiation ────────────────────────────────────────────────────

@router.patch(
    "/{appointment_id}/reschedule",
    response_model=AppointmentResponse,
    summary="Request or perform a reschedule",
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

    # Admin/receptionist: immediate reschedule (bypass negotiation)
    if current_user.role in (UserRole.ADMIN, UserRole.RECEPTIONIST):
        old_doctor_id = appt.doctor_id
        await _reschedule(db=db, appointment=appt, new_time=payload.scheduled_at)
        await _notify_waitlist(db, old_doctor_id)
        await db.refresh(appt)
        return appt

    # Patient or doctor: initiate negotiation
    if current_user.role == UserRole.PATIENT:
        if appt.status != AppointmentStatus.PENDING:
            # For CONFIRMED appointments, patient must request (doctor must accept)
            appt.status_before_reschedule_request = appt.status.value
            appt.proposed_new_time = payload.scheduled_at
            appt.reschedule_requested_by = "patient"
            appt.status = AppointmentStatus.RESCHEDULE_REQUESTED
            await db.flush()
            await db.refresh(appt)
            return appt
        else:
            # PENDING: patient can reschedule directly
            old_doctor_id = appt.doctor_id
            await _reschedule(db=db, appointment=appt, new_time=payload.scheduled_at)
            await _notify_waitlist(db, old_doctor_id)
            await db.refresh(appt)
            return appt

    if current_user.role == UserRole.DOCTOR:
        if appt.status != AppointmentStatus.CONFIRMED:
            raise HTTPException(status_code=403, detail="Doctors can only reschedule CONFIRMED appointments")
        appt.status_before_reschedule_request = appt.status.value
        appt.proposed_new_time = payload.scheduled_at
        appt.reschedule_requested_by = "doctor"
        appt.status = AppointmentStatus.RESCHEDULE_REQUESTED
        await db.flush()
        await db.refresh(appt)
        return appt

    raise HTTPException(status_code=403, detail="Not authorised to reschedule")


@router.patch(
    "/{appointment_id}/reschedule/accept",
    response_model=AppointmentResponse,
    summary="Accept a reschedule request (the other party)",
)
async def accept_reschedule(
    appointment_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    _assert_access(current_user, appt)

    if appt.status != AppointmentStatus.RESCHEDULE_REQUESTED:
        raise HTTPException(status_code=400, detail="No pending reschedule request")

    if not appt.proposed_new_time:
        raise HTTPException(status_code=400, detail="No proposed time found")

    # Verify the OTHER party is accepting
    if appt.reschedule_requested_by == "patient" and current_user.role == UserRole.PATIENT:
        raise HTTPException(status_code=403, detail="You cannot accept your own reschedule request")
    if appt.reschedule_requested_by == "doctor" and current_user.role == UserRole.DOCTOR:
        raise HTTPException(status_code=403, detail="You cannot accept your own reschedule request")

    old_doctor_id = appt.doctor_id
    await _reschedule(db=db, appointment=appt, new_time=appt.proposed_new_time)
    await _notify_waitlist(db, old_doctor_id)
    await db.refresh(appt)
    return appt


@router.patch(
    "/{appointment_id}/reschedule/decline",
    response_model=AppointmentResponse,
    summary="Decline a reschedule request",
)
async def decline_reschedule(
    appointment_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    _assert_access(current_user, appt)

    if appt.status != AppointmentStatus.RESCHEDULE_REQUESTED:
        raise HTTPException(status_code=400, detail="No pending reschedule request")

    # Revert to previous status
    prev = appt.status_before_reschedule_request or AppointmentStatus.CONFIRMED.value
    appt.status = AppointmentStatus(prev)
    appt.proposed_new_time = None
    appt.reschedule_requested_by = None
    appt.status_before_reschedule_request = None
    await db.flush()
    await db.refresh(appt)
    return appt


# ── Follow-up booking ─────────────────────────────────────────────────────────

@router.post(
    "/{appointment_id}/follow-up",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book a follow-up appointment for a completed visit",
)
async def book_follow_up(
    appointment_id: int,
    payload: AppointmentFollowUpCreate,
    current_user: CurrentPatient,
    db: DBSession,
) -> Appointment:
    # Fetch parent appointment
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    parent = result.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if parent.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your appointment")
    if parent.status != AppointmentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Follow-ups can only be booked for COMPLETED appointments")

    appt = await _book(
        db=db,
        patient_id=current_user.id,
        doctor_id=parent.doctor_id,
        scheduled_at=payload.scheduled_at,
        reason=payload.reason or f"Follow-up for appointment #{parent.id}",
        follow_up_of=parent.id,
    )
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appt.id)
    )
    appt = result.scalar_one()
    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "your doctor"
    asyncio.create_task(
        send_appointment_confirmation(
            to_email=current_user.email,
            patient_name=current_user.full_name,
            scheduled_at=appt.scheduled_at.isoformat(),
            doctor_name=doctor_name,
        )
    )
    return appt


# ── Arrive / Check-in / No-show ──────────────────────────────────────────────

@router.patch(
    "/{appointment_id}/arrive",
    response_model=AppointmentResponse,
    summary="Mark patient as arrived (receptionist / doctor / admin only)",
)
async def mark_arrived(
    appointment_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    if current_user.role not in (UserRole.RECEPTIONIST, UserRole.ADMIN, UserRole.DOCTOR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only receptionists, doctors, or admins can mark a patient as arrived",
        )

    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appt.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only CONFIRMED appointments can be marked as arrived (current: {appt.status.value})",
        )

    appt.status = AppointmentStatus.ARRIVED
    await _create_encounter_on_arrival(db, appt)
    await db.flush()
    await db.refresh(appt)
    return appt


@router.patch(
    "/{appointment_id}/noshow",
    response_model=AppointmentResponse,
    summary="Mark appointment as no-show (doctor / receptionist / admin only)",
)
async def mark_noshow(
    appointment_id: int,
    payload: AppointmentNoShowRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> Appointment:
    if current_user.role not in (UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors, receptionists, or admins can mark a no-show",
        )

    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appt.status not in (AppointmentStatus.CONFIRMED, AppointmentStatus.ARRIVED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only CONFIRMED or ARRIVED appointments can be marked as no-show (current: {appt.status.value})",
        )

    appt.status = AppointmentStatus.NOSHOW
    if payload.cancellation_reason:
        appt.cancellation_reason = payload.cancellation_reason

    # No-show: forfeit 100% deposit
    deposit = float(appt.deposit_amount or 0)
    if deposit > 0 and appt.deposit_paid:
        appt.penalty_amount = deposit
        appt.refund_amount = 0

    await db.flush()
    await db.refresh(appt)

    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "your doctor"
    asyncio.create_task(
        send_noshow_recorded(
            to_email=appt.patient.email,
            patient_name=appt.patient.full_name,
            doctor_name=doctor_name,
        )
    )
    await _notify_waitlist(db, appt.doctor_id)
    return appt


@router.get(
    "/{appointment_id}/checkin-token",
    response_model=CheckinTokenResponse,
    summary="Generate a QR check-in token for an appointment (doctor / admin only)",
)
async def get_checkin_token(
    appointment_id: int,
    request: Request,
    current_user: CurrentUser,
    db: DBSession,
) -> CheckinTokenResponse:
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN, UserRole.RECEPTIONIST):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors, receptionists, or admins can generate check-in tokens",
        )

    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appt.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-in tokens can only be generated for CONFIRMED appointments",
        )

    from app.config import settings
    secret = settings.SECRET_KEY
    token, expires_unix = _generate_checkin_token(appointment_id, secret)
    expires_dt = datetime.fromtimestamp(expires_unix, tz=timezone.utc)

    base_url = str(request.base_url).rstrip("/")
    checkin_url = f"{base_url}/api/appointments/{appointment_id}/checkin?token={token}"

    return CheckinTokenResponse(token=token, expires_at=expires_dt, checkin_url=checkin_url)


@router.post(
    "/{appointment_id}/checkin",
    response_model=AppointmentResponse,
    summary="Patient QR check-in (public — validates signed token)",
)
async def checkin_appointment(
    appointment_id: int,
    db: DBSession,
    token: str = Query(..., description="Signed check-in token from the QR code"),
) -> Appointment:
    from app.config import settings
    verified_id = _verify_checkin_token(token, settings.SECRET_KEY)
    if verified_id != appointment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token does not match appointment")

    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appt.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot check in: appointment is {appt.status.value} (expected CONFIRMED)",
        )

    appt.status = AppointmentStatus.ARRIVED
    await _create_encounter_on_arrival(db, appt)
    await db.flush()
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
    payload: AppointmentCancelRequest = AppointmentCancelRequest(),
) -> Appointment:
    result = await db.execute(
        select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    _assert_access(current_user, appt)

    if current_user.role == UserRole.PATIENT and appt.status == AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patients cannot cancel a confirmed appointment. Please contact the clinic.",
        )

    if appt.status in (AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NOSHOW):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a {appt.status.value} appointment",
        )

    was_confirmed = appt.status in (AppointmentStatus.CONFIRMED, AppointmentStatus.RESCHEDULED)
    appt.status = AppointmentStatus.CANCELLED
    if payload.cancellation_reason:
        appt.cancellation_reason = payload.cancellation_reason

    # Apply cancellation penalty
    penalty, refund = _calculate_cancellation_penalty(appt)
    if penalty > 0 or refund > 0:
        appt.penalty_amount = penalty
        appt.refund_amount = refund
        appt.refund_status = RefundStatus.PENDING if refund > 0 else RefundStatus.NONE

    await db.flush()
    await db.refresh(appt)

    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "your doctor"
    asyncio.create_task(
        send_appointment_cancelled(
            to_email=appt.patient.email,
            patient_name=appt.patient.full_name,
            scheduled_at=appt.scheduled_at.isoformat(),
            doctor_name=doctor_name,
        )
    )
    if was_confirmed:
        await _notify_waitlist(db, appt.doctor_id)

    return appt


# ── Access guard ───────────────────────────────────────────────────────────────
def _assert_access(user, appt: Appointment) -> None:
    if user.role in (UserRole.ADMIN, UserRole.RECEPTIONIST):
        return
    if user.role == UserRole.PATIENT and appt.patient_id == user.id:
        return
    if user.role == UserRole.DOCTOR and appt.doctor.user_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorised to access this appointment",
    )
