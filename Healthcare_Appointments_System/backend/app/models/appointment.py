import enum

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
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
    RESCHEDULE_REQUESTED = "RESCHEDULE_REQUESTED"


class RefundStatus(str, enum.Enum):
    NONE = "NONE"
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"


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

    # ── Payment / financial tracking ──────────────────────────────────────────
    deposit_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    vnpay_txn_ref: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    deposit_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True, default=None)
    refund_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True, default=None)
    penalty_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True, default=None)
    refund_status: Mapped[RefundStatus] = mapped_column(
        Enum(RefundStatus, name="refundstatus"),
        nullable=False,
        default=RefundStatus.NONE,
    )
    payment_expires_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None,
        comment="Server-side slot hold expiry for VNPay payment window",
    )

    # ── Reschedule tracking ───────────────────────────────────────────────────
    reschedule_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reschedule_fee_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    proposed_new_time: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None,
    )
    reschedule_requested_by: Mapped[str | None] = mapped_column(
        String(10), nullable=True, default=None,
        comment="'patient' or 'doctor'",
    )
    status_before_reschedule_request: Mapped[str | None] = mapped_column(
        String(30), nullable=True, default=None,
        comment="Status to revert to if reschedule is declined",
    )

    # ── Reminder deduplication ────────────────────────────────────────────────
    reminder_24h_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reminder_2h_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── Follow-up tracking ────────────────────────────────────────────────────
    follow_up_of: Mapped[int | None] = mapped_column(
        ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, default=None,
    )
    follow_up_recommended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    follow_up_date: Mapped[Date | None] = mapped_column(Date, nullable=True, default=None)

    # ── Timestamps ────────────────────────────────────────────────────────────
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
    encounter: Mapped["Encounter"] = relationship(  # noqa: F821
        "Encounter", back_populates="appointment", uselist=False, cascade="all, delete-orphan"
    )
    parent_appointment: Mapped["Appointment | None"] = relationship(
        "Appointment", remote_side=[id], foreign_keys=[follow_up_of],
    )

    def __repr__(self) -> str:
        return (
            f"<Appointment id={self.id} patient_id={self.patient_id} "
            f"doctor_id={self.doctor_id} status={self.status}>"
        )
