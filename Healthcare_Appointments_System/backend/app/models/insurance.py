import enum

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InsuranceCoverage(Base):
    """A patient's health insurance coverage record."""
    __tablename__ = "insurance_coverages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_name: Mapped[str] = mapped_column(String(255), nullable=False)
    policy_number: Mapped[str] = mapped_column(String(100), nullable=False)
    group_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    coverage_start: Mapped[Date] = mapped_column(Date, nullable=False)
    coverage_end: Mapped[Date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    copay_percentage: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=20,
        comment="Percentage the patient pays, e.g. 20 means insurer covers 80%",
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # ── Relationships ──────────────────────────────────────────────────────
    patient: Mapped["User"] = relationship("User", foreign_keys=[patient_id])  # noqa: F821
    claims: Mapped[list["InsuranceClaim"]] = relationship(
        "InsuranceClaim", back_populates="coverage", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<InsuranceCoverage id={self.id} patient_id={self.patient_id} provider={self.provider_name}>"


class ClaimStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    DENIED = "DENIED"


class InsuranceClaim(Base):
    """Insurance claim linked to a completed appointment."""
    __tablename__ = "insurance_claims"
    __table_args__ = (
        UniqueConstraint("appointment_id", name="uq_claim_appointment"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    coverage_id: Mapped[int] = mapped_column(
        ForeignKey("insurance_coverages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    covered_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    patient_responsibility: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[ClaimStatus] = mapped_column(
        Enum(ClaimStatus, name="claimstatus"),
        nullable=False,
        default=ClaimStatus.PENDING,
    )
    denial_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    submitted_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    # ── Relationships ──────────────────────────────────────────────────────
    appointment: Mapped["Appointment"] = relationship("Appointment", foreign_keys=[appointment_id])  # noqa: F821
    coverage: Mapped["InsuranceCoverage"] = relationship(
        "InsuranceCoverage", back_populates="claims"
    )

    def __repr__(self) -> str:
        return f"<InsuranceClaim id={self.id} appointment_id={self.appointment_id} status={self.status}>"
