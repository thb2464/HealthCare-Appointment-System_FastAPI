from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentPatient, DBSession
from app.models.appointment import Appointment, AppointmentStatus
from app.models.review import Review
from app.schemas.review import ReviewCreate, ReviewResponse

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


@router.post(
    "",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a review for a completed appointment (patient only)",
)
async def create_review(
    payload: ReviewCreate,
    current_user: CurrentPatient,
    db: DBSession,
) -> Review:
    # Verify appointment belongs to this patient and is COMPLETED
    appt_result = await db.execute(
        select(Appointment).where(
            Appointment.id == payload.appointment_id,
            Appointment.patient_id == current_user.id,
        )
    )
    appt = appt_result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appt.status != AppointmentStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviews can only be submitted for COMPLETED appointments",
        )

    # Prevent duplicate review
    dup = await db.execute(
        select(Review).where(Review.appointment_id == payload.appointment_id)
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A review already exists for this appointment",
        )

    review = Review(
        appointment_id=appt.id,
        patient_id=current_user.id,
        doctor_id=appt.doctor_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    await db.flush()

    # Recalculate doctor avg_rating
    from app.models.doctor import Doctor

    avg_result = await db.execute(
        select(func.avg(Review.rating)).where(Review.doctor_id == appt.doctor_id)
    )
    avg = avg_result.scalar_one_or_none()
    if avg is not None:
        doctor_result = await db.execute(select(Doctor).where(Doctor.id == appt.doctor_id))
        doctor = doctor_result.scalar_one_or_none()
        if doctor:
            doctor.avg_rating = round(float(avg), 2)

    result = await db.execute(
        select(Review).options(selectinload(Review.patient)).where(Review.id == review.id)
    )
    return result.scalar_one()


@router.get(
    "/doctor/{doctor_id}",
    response_model=list[ReviewResponse],
    summary="List reviews for a doctor (public)",
)
async def list_doctor_reviews(
    doctor_id: int,
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> list[Review]:
    result = await db.execute(
        select(Review)
        .options(selectinload(Review.patient))
        .where(Review.doctor_id == doctor_id)
        .order_by(Review.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all())
