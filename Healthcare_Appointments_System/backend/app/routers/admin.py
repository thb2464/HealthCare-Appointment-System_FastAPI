from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentAdmin, DBSession
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.appointment import Appointment, AppointmentStatus
from app.models.specialty import Specialty
from app.schemas.user import UserResponse, UserActiveUpdate, AdminUserCreate
from app.schemas.appointment import AppointmentListResponse, AppointmentStatusUpdate
from app.schemas.doctor import DoctorResponse, DoctorProfileUpdate
from app.models.waitlist import WaitlistEntry  # noqa: F401
from app.utils.security import hash_password

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ── List all users ─────────────────────────────────────────────────────────────
@router.get("/users", response_model=list[UserResponse])
async def list_users(
    _: CurrentAdmin,
    db: DBSession,
    role: UserRole | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> list[User]:
    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    if search:
        term = f"%{search.lower()}%"
        stmt = stmt.where(
            func.lower(User.full_name).like(term) | func.lower(User.email).like(term)
        )
    stmt = stmt.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ── Create user (doctor / receptionist) ───────────────────────────────────────
@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(payload: AdminUserCreate, _: CurrentAdmin, db: DBSession) -> User:
    if payload.role not in (UserRole.DOCTOR, UserRole.RECEPTIONIST):
        raise HTTPException(status_code=400, detail="Admin can only create DOCTOR or RECEPTIONIST accounts")
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    if payload.role == UserRole.DOCTOR:
        db.add(Doctor(user_id=user.id))
        await db.flush()
    await db.refresh(user)
    return user


# ── Toggle user active ─────────────────────────────────────────────────────────
@router.patch("/users/{user_id}", response_model=UserResponse)
async def toggle_user_active(user_id: int, payload: UserActiveUpdate, _: CurrentAdmin, db: DBSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = payload.is_active
    await db.flush()
    await db.refresh(user)
    return user


# ── List all appointments ──────────────────────────────────────────────────────
@router.get("/appointments", response_model=list[AppointmentListResponse])
async def list_appointments(
    _: CurrentAdmin,
    db: DBSession,
    appt_status: AppointmentStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, description="Patient name search"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> list[Appointment]:
    _LOAD = [
        selectinload(Appointment.patient),
        selectinload(Appointment.doctor).selectinload(Doctor.user),
        selectinload(Appointment.doctor).selectinload(Doctor.specialty),
    ]
    stmt = select(Appointment).options(*_LOAD)
    if appt_status:
        stmt = stmt.where(Appointment.status == appt_status)
    if search:
        stmt = stmt.join(Appointment.patient).where(
            func.lower(User.full_name).like(f"%{search.lower()}%")
        )
    stmt = stmt.order_by(Appointment.scheduled_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ── Update appointment status ──────────────────────────────────────────────────
@router.patch("/appointments/{appointment_id}", response_model=AppointmentListResponse)
async def update_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    _: CurrentAdmin,
    db: DBSession,
) -> Appointment:
    _LOAD = [
        selectinload(Appointment.patient),
        selectinload(Appointment.doctor).selectinload(Doctor.user),
        selectinload(Appointment.doctor).selectinload(Doctor.specialty),
    ]
    result = await db.execute(select(Appointment).options(*_LOAD).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appt.status = payload.status
    if payload.notes is not None:
        appt.notes = payload.notes
    await db.flush()
    await db.refresh(appt)
    return appt


# ── List all doctors (with profile) ───────────────────────────────────────────
@router.get("/doctors", response_model=list[DoctorResponse])
async def list_doctors(
    _: CurrentAdmin,
    db: DBSession,
    specialty_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> list[Doctor]:
    stmt = (
        select(Doctor)
        .options(selectinload(Doctor.user), selectinload(Doctor.specialty))
    )
    if specialty_id:
        stmt = stmt.where(Doctor.specialty_id == specialty_id)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ── Update doctor profile ──────────────────────────────────────────────────────
@router.patch("/doctors/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(
    doctor_id: int,
    payload: DoctorProfileUpdate,
    _: CurrentAdmin,
    db: DBSession,
) -> Doctor:
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.user), selectinload(Doctor.specialty))
        .where(Doctor.id == doctor_id)
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(doctor, field, value)
    await db.flush()
    await db.refresh(doctor)
    return doctor


# ── Platform stats ─────────────────────────────────────────────────────────────
@router.get("/stats")
async def get_stats(_: CurrentAdmin, db: DBSession) -> dict:
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_patients = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.PATIENT))).scalar_one()
    total_doctors = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.DOCTOR))).scalar_one()
    total_appointments = (await db.execute(select(func.count(Appointment.id)))).scalar_one()

    status_counts: dict[str, int] = {}
    for appt_status in AppointmentStatus:
        count = (await db.execute(select(func.count(Appointment.id)).where(Appointment.status == appt_status))).scalar_one()
        status_counts[appt_status.value.lower()] = count

    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Doctor.consultation_fee), 0))
        .join(Appointment, Appointment.doctor_id == Doctor.id)
        .where(Appointment.status == AppointmentStatus.COMPLETED)
    )
    total_revenue = float(revenue_result.scalar_one())

    total_waitlist = (await db.execute(select(func.count(WaitlistEntry.id)))).scalar_one()

    # Recent 7 days daily appointment counts
    from sqlalchemy import cast, Date, text
    daily_rows = await db.execute(
        select(
            cast(Appointment.scheduled_at, Date).label("day"),
            func.count(Appointment.id).label("count"),
        )
        .group_by("day")
        .order_by("day")
        .limit(30)
    )
    daily = [{"date": str(r.day), "count": r.count} for r in daily_rows]

    return {
        "users": {"total": total_users, "patients": total_patients, "doctors": total_doctors},
        "appointments": {"total": total_appointments, **status_counts},
        "revenue": {"total_completed": total_revenue},
        "waitlist": {"total": total_waitlist},
        "daily_appointments": daily,
    }
