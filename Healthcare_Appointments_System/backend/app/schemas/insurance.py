from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.insurance import ClaimStatus


# ── Insurance Coverage schemas ────────────────────────────────────────────────

class InsuranceCoverageCreate(BaseModel):
    provider_name: str = Field(..., min_length=1, max_length=255)
    policy_number: str = Field(..., min_length=1, max_length=100)
    group_number: str | None = Field(default=None, max_length=100)
    coverage_start: date
    coverage_end: date
    copay_percentage: Decimal = Field(default=Decimal("20"), ge=0, le=100)


class InsuranceCoverageResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    patient_id: int
    provider_name: str
    policy_number: str
    group_number: str | None = None
    coverage_start: date
    coverage_end: date
    is_active: bool
    copay_percentage: Decimal
    created_at: datetime
    updated_at: datetime


# ── Insurance Claim schemas ───────────────────────────────────────────────────

class InsuranceClaimCreate(BaseModel):
    coverage_id: int


class InsuranceClaimUpdate(BaseModel):
    status: ClaimStatus
    denial_reason: str | None = None


class InsuranceClaimResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    appointment_id: int
    coverage_id: int
    total_amount: Decimal
    covered_amount: Decimal
    patient_responsibility: Decimal
    status: ClaimStatus
    denial_reason: str | None = None
    submitted_at: datetime
    processed_at: datetime | None = None
