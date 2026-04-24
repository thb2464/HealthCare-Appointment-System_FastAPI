"""
seed_db.py — Populate the database with realistic sample data.

Usage (from backend/ with venv active):
    python scripts/seed_db.py
"""

import asyncio
import sys
import os
from datetime import time, datetime, timezone, timedelta

# Make sure `app` package is importable when running from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, engine, Base
from app.models import (
    User, UserRole,
    Doctor,
    Specialty,
    Availability, DayOfWeek,
    Appointment, AppointmentStatus,
    Review,
)
from app.utils.security import hash_password


# ── Sample data ────────────────────────────────────────────────────────────────

SPECIALTIES = [
    {"name": "General Practice",      "description": "Primary healthcare for all ages",              "icon": "stethoscope"},
    {"name": "Cardiology",            "description": "Heart and cardiovascular system",              "icon": "heart"},
    {"name": "Dermatology",           "description": "Skin, hair, and nail conditions",              "icon": "skin"},
    {"name": "Pediatrics",            "description": "Medical care for infants, children & teens",   "icon": "baby"},
    {"name": "Orthopedics",           "description": "Bones, joints, muscles and ligaments",        "icon": "bone"},
    {"name": "Neurology",             "description": "Brain and nervous system disorders",           "icon": "brain"},
    {"name": "Gynecology",            "description": "Female reproductive health",                  "icon": "female"},
    {"name": "Psychiatry",            "description": "Mental health and behavioural disorders",      "icon": "mind"},
]

DOCTORS = [
    {
        "full_name": "Dr. Alice Nguyen",
        "email": "alice.nguyen@clinic.com",
        "password": "Doctor@123",
        "phone": "0901234567",
        "specialty": "Cardiology",
        "bio": "Board-certified cardiologist with 12 years of experience in interventional cardiology.",
        "license_number": "VN-CARD-001",
        "years_experience": 12,
        "clinic_address": "15 Le Loi St, District 1, Ho Chi Minh City",
        "consultation_fee": 350000,
        "avg_rating": 4.8,
    },
    {
        "full_name": "Dr. Minh Tran",
        "email": "minh.tran@clinic.com",
        "password": "Doctor@123",
        "phone": "0912345678",
        "specialty": "General Practice",
        "bio": "Family physician committed to preventive care and chronic disease management.",
        "license_number": "VN-GP-002",
        "years_experience": 8,
        "clinic_address": "42 Nguyen Hue Blvd, District 1, Ho Chi Minh City",
        "consultation_fee": 200000,
        "avg_rating": 4.5,
    },
    {
        "full_name": "Dr. Lan Pham",
        "email": "lan.pham@clinic.com",
        "password": "Doctor@123",
        "phone": "0923456789",
        "specialty": "Dermatology",
        "bio": "Specialist in acne, eczema, and cosmetic dermatology procedures.",
        "license_number": "VN-DERM-003",
        "years_experience": 6,
        "clinic_address": "8 Pasteur St, District 3, Ho Chi Minh City",
        "consultation_fee": 300000,
        "avg_rating": 4.7,
    },
    {
        "full_name": "Dr. Duc Le",
        "email": "duc.le@clinic.com",
        "password": "Doctor@123",
        "phone": "0934567890",
        "specialty": "Pediatrics",
        "bio": "Dedicated pediatrician specialising in neonatal care and childhood development.",
        "license_number": "VN-PED-004",
        "years_experience": 10,
        "clinic_address": "22 Dien Bien Phu, Binh Thanh, Ho Chi Minh City",
        "consultation_fee": 250000,
        "avg_rating": 4.9,
    },
    {
        "full_name": "Dr. Hoa Vo",
        "email": "hoa.vo@clinic.com",
        "password": "Doctor@123",
        "phone": "0945678901",
        "specialty": "Neurology",
        "bio": "Neurologist with expertise in stroke management and epilepsy.",
        "license_number": "VN-NEURO-005",
        "years_experience": 15,
        "clinic_address": "5 Vo Van Tan, District 3, Ho Chi Minh City",
        "consultation_fee": 400000,
        "avg_rating": 4.6,
    },
]

PATIENTS = [
    {"full_name": "Nguyen Van An",   "email": "van.an@email.com",   "password": "Patient@123", "phone": "0961234567"},
    {"full_name": "Tran Thi Bich",   "email": "thi.bich@email.com", "password": "Patient@123", "phone": "0972345678"},
    {"full_name": "Le Van Cuong",    "email": "van.cuong@email.com", "password": "Patient@123", "phone": "0983456789"},
    {"full_name": "Pham Thi Dung",   "email": "thi.dung@email.com", "password": "Patient@123", "phone": "0994567890"},
    {"full_name": "Hoang Van Em",    "email": "van.em@email.com",   "password": "Patient@123", "phone": "0905678901"},
]

ADMIN = {
    "full_name": "System Admin",
    "email": "admin@healthcare.com",
    "password": "Admin@123",
    "phone": "0900000000",
}

# Availability: Mon–Fri 08:00–17:00 (30-min slots), Sat 08:00–12:00
WEEKDAY_AVAILABILITY = [
    {"day_of_week": DayOfWeek.MONDAY,    "start_time": time(8, 0),  "end_time": time(17, 0), "slot_duration_minutes": 30},
    {"day_of_week": DayOfWeek.TUESDAY,   "start_time": time(8, 0),  "end_time": time(17, 0), "slot_duration_minutes": 30},
    {"day_of_week": DayOfWeek.WEDNESDAY, "start_time": time(8, 0),  "end_time": time(17, 0), "slot_duration_minutes": 30},
    {"day_of_week": DayOfWeek.THURSDAY,  "start_time": time(8, 0),  "end_time": time(17, 0), "slot_duration_minutes": 30},
    {"day_of_week": DayOfWeek.FRIDAY,    "start_time": time(8, 0),  "end_time": time(17, 0), "slot_duration_minutes": 30},
    {"day_of_week": DayOfWeek.SATURDAY,  "start_time": time(8, 0),  "end_time": time(12, 0), "slot_duration_minutes": 30},
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def next_weekday(weekday: int) -> datetime:
    """Return next occurrence of a weekday (0=Mon) as a timezone-aware datetime."""
    today = datetime.now(timezone.utc).date()
    days_ahead = weekday - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    target = today + timedelta(days=days_ahead)
    return datetime(target.year, target.month, target.day, 9, 0, tzinfo=timezone.utc)


# ── Seeding logic ──────────────────────────────────────────────────────────────

async def seed(session: AsyncSession) -> None:
    print("🌱 Seeding database...")

    # 1. Specialties
    specialty_map: dict[str, Specialty] = {}
    for spec_data in SPECIALTIES:
        spec = Specialty(**spec_data)
        session.add(spec)
        specialty_map[spec_data["name"]] = spec
    await session.flush()
    print(f"  ✔ {len(SPECIALTIES)} specialties created")

    # 2. Admin user
    admin_user = User(
        email=ADMIN["email"],
        hashed_password=hash_password(ADMIN["password"]),
        full_name=ADMIN["full_name"],
        phone=ADMIN["phone"],
        role=UserRole.ADMIN,
        is_active=True,
    )
    session.add(admin_user)
    await session.flush()
    print("  ✔ Admin user created")

    # 3. Doctor users + profiles
    doctor_profiles: list[Doctor] = []
    for doc_data in DOCTORS:
        user = User(
            email=doc_data["email"],
            hashed_password=hash_password(doc_data["password"]),
            full_name=doc_data["full_name"],
            phone=doc_data["phone"],
            role=UserRole.DOCTOR,
            is_active=True,
        )
        session.add(user)
        await session.flush()

        doctor = Doctor(
            user_id=user.id,
            specialty_id=specialty_map[doc_data["specialty"]].id,
            bio=doc_data["bio"],
            license_number=doc_data["license_number"],
            years_experience=doc_data["years_experience"],
            clinic_address=doc_data["clinic_address"],
            consultation_fee=doc_data["consultation_fee"],
            avg_rating=doc_data["avg_rating"],
        )
        session.add(doctor)
        await session.flush()

        # Availability slots
        for avail_data in WEEKDAY_AVAILABILITY:
            avail = Availability(
                doctor_id=doctor.id,
                day_of_week=avail_data["day_of_week"].value,
                start_time=avail_data["start_time"],
                end_time=avail_data["end_time"],
                slot_duration_minutes=avail_data["slot_duration_minutes"],
                is_active=True,
            )
            session.add(avail)

        doctor_profiles.append(doctor)

    await session.flush()
    print(f"  ✔ {len(DOCTORS)} doctors + availability created")

    # 4. Patient users
    patient_users: list[User] = []
    for pat_data in PATIENTS:
        user = User(
            email=pat_data["email"],
            hashed_password=hash_password(pat_data["password"]),
            full_name=pat_data["full_name"],
            phone=pat_data["phone"],
            role=UserRole.PATIENT,
            is_active=True,
        )
        session.add(user)
        patient_users.append(user)
    await session.flush()
    print(f"  ✔ {len(PATIENTS)} patients created")

    # 5. Sample appointments
    sample_appointments = [
        # Past completed appointment → can have a review
        {
            "patient": patient_users[0],
            "doctor": doctor_profiles[0],
            "scheduled_at": datetime.now(timezone.utc) - timedelta(days=7, hours=2),
            "end_at": datetime.now(timezone.utc) - timedelta(days=7, hours=1, minutes=30),
            "status": AppointmentStatus.COMPLETED,
            "reason": "Chest pain check-up",
            "notes": "Patient reports mild chest pain. ECG normal. Follow-up in 1 month.",
        },
        # Upcoming confirmed
        {
            "patient": patient_users[1],
            "doctor": doctor_profiles[1],
            "scheduled_at": next_weekday(0),  # Next Monday 09:00
            "end_at": next_weekday(0) + timedelta(minutes=30),
            "status": AppointmentStatus.CONFIRMED,
            "reason": "Annual check-up",
            "notes": None,
        },
        # Upcoming pending
        {
            "patient": patient_users[2],
            "doctor": doctor_profiles[2],
            "scheduled_at": next_weekday(1),  # Next Tuesday 09:00
            "end_at": next_weekday(1) + timedelta(minutes=30),
            "status": AppointmentStatus.PENDING,
            "reason": "Skin rash evaluation",
            "notes": None,
        },
        # Cancelled
        {
            "patient": patient_users[3],
            "doctor": doctor_profiles[3],
            "scheduled_at": datetime.now(timezone.utc) - timedelta(days=3),
            "end_at": datetime.now(timezone.utc) - timedelta(days=3) + timedelta(minutes=30),
            "status": AppointmentStatus.CANCELLED,
            "reason": "Fever in child",
            "notes": "Appointment cancelled by patient.",
        },
        # Another completed
        {
            "patient": patient_users[4],
            "doctor": doctor_profiles[4],
            "scheduled_at": datetime.now(timezone.utc) - timedelta(days=14),
            "end_at": datetime.now(timezone.utc) - timedelta(days=14) + timedelta(minutes=30),
            "status": AppointmentStatus.COMPLETED,
            "reason": "Migraine consultation",
            "notes": "Prescribed topiramate. Review in 6 weeks.",
        },
    ]

    appt_objects: list[Appointment] = []
    for appt_data in sample_appointments:
        appt = Appointment(
            patient_id=appt_data["patient"].id,
            doctor_id=appt_data["doctor"].id,
            scheduled_at=appt_data["scheduled_at"],
            end_at=appt_data["end_at"],
            status=appt_data["status"],
            reason=appt_data["reason"],
            notes=appt_data["notes"],
        )
        session.add(appt)
        appt_objects.append(appt)
    await session.flush()
    print(f"  ✔ {len(sample_appointments)} appointments created")

    # 6. Reviews for completed appointments
    completed_appts = [
        (appt_objects[0], patient_users[0], doctor_profiles[0], 5, "Excellent doctor, very thorough!"),
        (appt_objects[4], patient_users[4], doctor_profiles[4], 4, "Very knowledgeable. Waiting time was a bit long."),
    ]
    for appt, patient, doctor, rating, comment in completed_appts:
        review = Review(
            appointment_id=appt.id,
            patient_id=patient.id,
            doctor_id=doctor.id,
            rating=rating,
            comment=comment,
        )
        session.add(review)
    await session.flush()
    print(f"  ✔ {len(completed_appts)} reviews created")

    print("\n✅ Seed complete!")
    print(f"   Admin login  : {ADMIN['email']} / {ADMIN['password']}")
    print(f"   Doctor login : {DOCTORS[0]['email']} / {DOCTORS[0]['password']}")
    print(f"   Patient login: {PATIENTS[0]['email']} / {PATIENTS[0]['password']}")


async def main() -> None:
    async with AsyncSessionLocal() as session:
        try:
            await seed(session)
            await session.commit()
        except Exception as exc:
            await session.rollback()
            print(f"\n❌ Seed failed: {exc}")
            raise


if __name__ == "__main__":
    asyncio.run(main())
