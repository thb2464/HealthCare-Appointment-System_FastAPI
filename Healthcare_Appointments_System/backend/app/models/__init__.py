# Import all models here so that SQLAlchemy's mapper registry
# can resolve all string-based relationship references.
from app.models.appointment import Appointment, AppointmentStatus, RefundStatus
from app.models.availability import Availability, DayOfWeek
from app.models.doctor import Doctor
from app.models.encounter import Encounter, Prescription, LabResult, LabResultStatus
from app.models.insurance import InsuranceCoverage, InsuranceClaim, ClaimStatus
from app.models.review import Review
from app.models.specialty import Specialty
from app.models.user import User, UserRole
from app.models.waitlist import WaitlistEntry

__all__ = [
    "User",
    "UserRole",
    "Doctor",
    "Specialty",
    "Availability",
    "DayOfWeek",
    "Appointment",
    "AppointmentStatus",
    "RefundStatus",
    "Review",
    "WaitlistEntry",
    "Encounter",
    "Prescription",
    "LabResult",
    "LabResultStatus",
    "InsuranceCoverage",
    "InsuranceClaim",
    "ClaimStatus",
]
