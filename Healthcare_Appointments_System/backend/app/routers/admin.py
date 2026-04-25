from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentAdmin, DBSession
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.user import UserResponse, UserActiveUpdate
from app.models.waitlist import WaitlistEntry  # noqa: F401 — ensures mapper sees WaitlistEntry

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ── List all users ─────────────────────────────────────────────────────────────
@router.get(
    "/users",
    response_model=list[UserResponse],
    summary="List all users (admin only)",
)
async def list_users(
    _: CurrentAdmin,
    db: DBSession,
    role: UserRole | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> list[User]:
    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    stmt = (
        stmt.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ── Activate / Deactivate user ─────────────────────────────────────────────────
@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Activate or deactivate a user account (admin only)",
)
async def toggle_user_active(
    user_id: int,
    payload: UserActiveUpdate,
    _: CurrentAdmin,
    db: DBSession,
) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = payload.is_active
    await db.flush()
    await db.refresh(user)
    return user


# ── Platform stats ─────────────────────────────────────────────────────────────
@router.get(
    "/stats",
    summary="Platform-wide statistics (admin only)",
)
async def get_stats(_: CurrentAdmin, db: DBSession) -> dict:
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_patients = (
        await db.execute(select(func.count(User.id)).where(User.role == UserRole.PATIENT))
    ).scalar_one()
    total_doctors = (
        await db.execute(select(func.count(User.id)).where(User.role == UserRole.DOCTOR))
    ).scalar_one()
    total_appointments = (await db.execute(select(func.count(Appointment.id)))).scalar_one()

    # Per-status counts (lowercase keys to match frontend expectations)
    status_counts: dict[str, int] = {}
    for appt_status in AppointmentStatus:
        count = (
            await db.execute(
                select(func.count(Appointment.id)).where(Appointment.status == appt_status)
            )
        ).scalar_one()
        status_counts[appt_status.value.lower()] = count

    # Total revenue from completed appointments (sum of doctor consultation fees)
    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Doctor.consultation_fee), 0))
        .join(Appointment, Appointment.doctor_id == Doctor.id)
        .where(Appointment.status == AppointmentStatus.COMPLETED)
    )
    total_revenue = float(revenue_result.scalar_one())

    # Waitlist depth per platform
    total_waitlist = (
        await db.execute(select(func.count(WaitlistEntry.id)))
    ).scalar_one()

    return {
        "users": {
            "total": total_users,
            "patients": total_patients,
            "doctors": total_doctors,
        },
        "appointments": {
            "total": total_appointments,
            **{k.lower(): v for k, v in status_counts.items()},
        },
        "revenue": {
            "total_completed": total_revenue,
        },
        "waitlist": {
            "total": total_waitlist,
        },
    }
