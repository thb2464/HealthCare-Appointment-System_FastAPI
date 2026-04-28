from datetime import datetime

from pydantic import BaseModel, Field

from app.models.encounter import LabResultStatus


# ── Prescription schemas ──────────────────────────────────────────────────────

class PrescriptionCreate(BaseModel):
    medication_name: str = Field(..., min_length=1, max_length=500)
    dosage: str | None = None
    frequency: str | None = None
    duration: str | None = None
    instructions: str | None = None


class PrescriptionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    encounter_id: int
    medication_name: str
    dosage: str | None = None
    frequency: str | None = None
    duration: str | None = None
    instructions: str | None = None
    created_at: datetime


# ── Lab result schemas ────────────────────────────────────────────────────────

class LabResultCreate(BaseModel):
    test_name: str = Field(..., min_length=1, max_length=500)
    result_value: str | None = None
    unit: str | None = None
    reference_range: str | None = None


class LabResultUpdate(BaseModel):
    result_value: str | None = None
    unit: str | None = None
    reference_range: str | None = None
    status: LabResultStatus | None = None


class LabResultResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    encounter_id: int
    test_name: str
    result_value: str | None = None
    unit: str | None = None
    reference_range: str | None = None
    status: LabResultStatus
    ordered_at: datetime
    completed_at: datetime | None = None


# ── Encounter schemas ─────────────────────────────────────────────────────────

class EncounterUpdate(BaseModel):
    chief_complaint: str | None = None
    diagnosis: str | None = None
    treatment_notes: str | None = None
    vitals_json: dict | None = None


class EncounterResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    appointment_id: int
    doctor_id: int
    patient_id: int
    chief_complaint: str | None = None
    diagnosis: str | None = None
    treatment_notes: str | None = None
    vitals_json: dict | None = None
    created_at: datetime
    updated_at: datetime
    prescriptions: list[PrescriptionResponse] = []
    lab_results: list[LabResultResponse] = []
