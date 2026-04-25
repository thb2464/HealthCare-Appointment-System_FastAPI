from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WaitlistEntry(Base):
    """
    A patient waiting for any free slot with a specific doctor.
    When a confirmed appointment is cancelled, the oldest entry for that
    doctor is notified by email and then removed from the waitlist.
    """
    __tablename__ = "waitlist"
    __table_args__ = (
        UniqueConstraint("patient_id", "doctor_id", name="uq_waitlist_patient_doctor"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # ── Relationships ──────────────────────────────────────────────────────
    patient: Mapped["User"] = relationship("User", foreign_keys=[patient_id])  # noqa: F821
    doctor: Mapped["Doctor"] = relationship("Doctor", foreign_keys=[doctor_id])  # noqa: F821

    def __repr__(self) -> str:
        return f"<WaitlistEntry id={self.id} patient_id={self.patient_id} doctor_id={self.doctor_id}>"
