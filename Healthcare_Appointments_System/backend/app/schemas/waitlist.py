from datetime import datetime

from pydantic import BaseModel

from app.schemas.doctor import DoctorListItem


class WaitlistCreate(BaseModel):
    doctor_id: int


class WaitlistResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    doctor_id: int
    doctor: DoctorListItem
    created_at: datetime
