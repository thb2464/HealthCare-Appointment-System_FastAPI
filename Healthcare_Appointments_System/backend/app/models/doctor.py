from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    specialty_id: Mapped[int | None] = mapped_column(
        ForeignKey("specialties.id", ondelete="SET NULL"), nullable=True
    )
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    license_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    years_experience: Mapped[int | None] = mapped_column(nullable=True)
    clinic_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    consultation_fee: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    avg_rating: Mapped[float | None] = mapped_column(
        Numeric(3, 2), nullable=True, default=None
    )

    # ── Relationships ──────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="doctor_profile"
    )
    specialty: Mapped["Specialty"] = relationship(  # noqa: F821
        "Specialty", back_populates="doctors"
    )
    availabilities: Mapped[list["Availability"]] = relationship(  # noqa: F821
        "Availability", back_populates="doctor", cascade="all, delete-orphan"
    )
    appointments: Mapped[list["Appointment"]] = relationship(  # noqa: F821
        "Appointment", back_populates="doctor", foreign_keys="Appointment.doctor_id"
    )
    reviews: Mapped[list["Review"]] = relationship(  # noqa: F821
        "Review", back_populates="doctor", foreign_keys="Review.doctor_id"
    )

    def __repr__(self) -> str:
        return f"<Doctor id={self.id} user_id={self.user_id}>"
