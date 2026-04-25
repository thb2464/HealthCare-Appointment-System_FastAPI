# Import all models here so that SQLAlchemy's mapper registry
# can resolve all string-based relationship references.
from app.models.appointment import Appointment, AppointmentStatus
from app.models.availability import Availability, DayOfWeek
from app.models.doctor import Doctor
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
    "Review",
    "WaitlistEntry",
]
