import enum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AppointmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    ARRIVED = "ARRIVED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    RESCHEDULED = "RESCHEDULED"
    NOSHOW = "NOSHOW"


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        # Prevent double-booking: a doctor cannot have two appointments at the same time
        UniqueConstraint("doctor_id", "scheduled_at", name="uq_doctor_scheduled_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scheduled_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, name="appointmentstatus"),
        nullable=False,
        default=AppointmentStatus.PENDING,
        index=True,
    )
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Cancellation / no-show
    cancellation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Payment tracking
    deposit_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Reschedule tracking
    reschedule_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reschedule_fee_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ── Relationships ──────────────────────────────────────────────────────
    patient: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="appointments_as_patient", foreign_keys=[patient_id]
    )
    doctor: Mapped["Doctor"] = relationship(  # noqa: F821
        "Doctor", back_populates="appointments", foreign_keys=[doctor_id]
    )
    review: Mapped["Review"] = relationship(  # noqa: F821
        "Review", back_populates="appointment", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<Appointment id={self.id} patient_id={self.patient_id} "
            f"doctor_id={self.doctor_id} status={self.status}>"
        )
