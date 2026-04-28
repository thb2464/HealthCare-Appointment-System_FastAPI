import enum

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Encounter(Base):
    """
    Clinical encounter record created when a patient arrives for their appointment.
    Stores diagnosis, treatment notes, vitals, and links to prescriptions and lab results.
    """
    __tablename__ = "encounters"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    treatment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    vitals_json: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=None,
        comment="e.g. {blood_pressure, heart_rate, temperature, weight, height}",
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # ── Relationships ──────────────────────────────────────────────────────
    appointment: Mapped["Appointment"] = relationship(  # noqa: F821
        "Appointment", back_populates="encounter"
    )
    doctor: Mapped["Doctor"] = relationship("Doctor", foreign_keys=[doctor_id])  # noqa: F821
    patient: Mapped["User"] = relationship("User", foreign_keys=[patient_id])  # noqa: F821
    prescriptions: Mapped[list["Prescription"]] = relationship(  # noqa: F821
        "Prescription", back_populates="encounter", cascade="all, delete-orphan"
    )
    lab_results: Mapped[list["LabResult"]] = relationship(  # noqa: F821
        "LabResult", back_populates="encounter", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Encounter id={self.id} appointment_id={self.appointment_id}>"


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    encounter_id: Mapped[int] = mapped_column(
        ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    medication_name: Mapped[str] = mapped_column(Text, nullable=False)
    dosage: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration: Mapped[str | None] = mapped_column(Text, nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    encounter: Mapped["Encounter"] = relationship("Encounter", back_populates="prescriptions")

    def __repr__(self) -> str:
        return f"<Prescription id={self.id} medication={self.medication_name}>"


class LabResultStatus(str, enum.Enum):
    ORDERED = "ORDERED"
    COMPLETED = "COMPLETED"


class LabResult(Base):
    __tablename__ = "lab_results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    encounter_id: Mapped[int] = mapped_column(
        ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    test_name: Mapped[str] = mapped_column(Text, nullable=False)
    result_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_range: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[LabResultStatus] = mapped_column(
        Enum(LabResultStatus, name="labresultstatus"),
        nullable=False,
        default=LabResultStatus.ORDERED,
    )

    ordered_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    encounter: Mapped["Encounter"] = relationship("Encounter", back_populates="lab_results")

    def __repr__(self) -> str:
        return f"<LabResult id={self.id} test={self.test_name} status={self.status}>"
