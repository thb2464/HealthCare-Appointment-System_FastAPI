"""
Seed script — inserts sample data + admin account.
Run from the backend/ directory:
    python seed.py
"""
import asyncio
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.specialty import Specialty
from app.models.availability import Availability
from app.models.appointment import Appointment, AppointmentStatus
from app.utils.security import hash_password


# ── helpers ────────────────────────────────────────────────────────────────────

async def _get_or_create_specialty(db: AsyncSession, name: str, description: str, icon: str) -> Specialty:
    result = await db.execute(select(Specialty).where(Specialty.name == name))
    spec = result.scalar_one_or_none()
    if not spec:
        spec = Specialty(name=name, description=description, icon=icon)
        db.add(spec)
        await db.flush()
    return spec


async def _get_or_create_user(db: AsyncSession, **kwargs) -> tuple[User, bool]:
    result = await db.execute(select(User).where(User.email == kwargs["email"]))
    user = result.scalar_one_or_none()
    if user:
        return user, False
    user = User(**kwargs)
    db.add(user)
    await db.flush()
    return user, True


# ── main ───────────────────────────────────────────────────────────────────────

async def seed() -> None:
    async with AsyncSessionLocal() as db:
        try:
            # ── Specialties ───────────────────────────────────────────────────
            cardiology   = await _get_or_create_specialty(db, "Cardiology",    "Heart and cardiovascular system",       "heart")
            neurology    = await _get_or_create_specialty(db, "Neurology",     "Brain and nervous system disorders",    "brain")
            dermatology  = await _get_or_create_specialty(db, "Dermatology",   "Skin, hair, and nail conditions",       "skin")
            orthopedics  = await _get_or_create_specialty(db, "Orthopedics",   "Bones, joints, and musculoskeletal",    "bone")
            pediatrics   = await _get_or_create_specialty(db, "Pediatrics",    "Medical care for infants and children", "child")

            # ── Admin account ─────────────────────────────────────────────────
            admin, created = await _get_or_create_user(
                db,
                email="Admin1@gmail.com",
                hashed_password=hash_password("Admin1234"),
                full_name="Admin1",
                role=UserRole.ADMIN,
                is_active=True,
            )
            print(f"{'Created' if created else 'Already exists'}: admin  Admin1@gmail.com")

            # ── Doctor users ──────────────────────────────────────────────────
            doc_users_data = [
                dict(email="dr.sarah.chen@medicare.com",   full_name="Dr. Sarah Chen",   specialty=cardiology,  bio="Board-certified cardiologist with 12 years of experience in interventional cardiology.",       fee=375000, exp=12),
                dict(email="dr.james.patel@medicare.com",  full_name="Dr. James Patel",  specialty=neurology,   bio="Specialist in neurodegenerative diseases and stroke management.",                             fee=450000, exp=15),
                dict(email="dr.emily.nguyen@medicare.com", full_name="Dr. Emily Nguyen", specialty=dermatology, bio="Expert in cosmetic and medical dermatology, including acne, eczema, and skin cancer.",       fee=300000, exp=8),
                dict(email="dr.michael.kim@medicare.com",  full_name="Dr. Michael Kim",  specialty=orthopedics, bio="Orthopedic surgeon specialising in sports injuries and joint replacement.",                  fee=500000, exp=18),
                dict(email="dr.lisa.wang@medicare.com",    full_name="Dr. Lisa Wang",    specialty=pediatrics,  bio="Dedicated pediatrician focused on child wellness, vaccinations, and developmental health.",  fee=250000, exp=10),
            ]

            doctors: list[Doctor] = []
            for d in doc_users_data:
                user, created = await _get_or_create_user(
                    db,
                    email=d["email"],
                    hashed_password=hash_password("Doctor1234"),
                    full_name=d["full_name"],
                    role=UserRole.DOCTOR,
                    is_active=True,
                )
                print(f"{'Created' if created else 'Already exists'}: doctor {d['email']}")

                # Doctor profile
                result = await db.execute(select(Doctor).where(Doctor.user_id == user.id))
                doctor = result.scalar_one_or_none()
                if not doctor:
                    doctor = Doctor(
                        user_id=user.id,
                        specialty_id=d["specialty"].id,
                        bio=d["bio"],
                        consultation_fee=d["fee"],
                        years_experience=d["exp"],
                        license_number=f"LIC-{user.id:04d}",
                    )
                    db.add(doctor)
                    await db.flush()

                    # Weekly availability: Mon–Fri 09:00–17:00, 30-min slots
                    from datetime import time
                    for day in range(5):  # 0=Mon … 4=Fri
                        db.add(Availability(
                            doctor_id=doctor.id,
                            day_of_week=day,
                            start_time=time(9, 0),
                            end_time=time(17, 0),
                            slot_duration_minutes=30,
                            is_active=True,
                        ))
                    await db.flush()

                doctors.append(doctor)

            # ── Patient users ─────────────────────────────────────────────────
            patient_data = [
                dict(email="alice.johnson@example.com", full_name="Alice Johnson", phone="+1-555-0101"),
                dict(email="bob.martinez@example.com",  full_name="Bob Martinez",  phone="+1-555-0102"),
                dict(email="carol.white@example.com",   full_name="Carol White",   phone="+1-555-0103"),
                dict(email="david.lee@example.com",     full_name="David Lee",     phone="+1-555-0104"),
                dict(email="eva.brown@example.com",     full_name="Eva Brown",     phone="+1-555-0105"),
            ]

            patients: list[User] = []
            for p in patient_data:
                user, created = await _get_or_create_user(
                    db,
                    email=p["email"],
                    hashed_password=hash_password("Patient1234"),
                    full_name=p["full_name"],
                    phone=p["phone"],
                    role=UserRole.PATIENT,
                    is_active=True,
                )
                print(f"{'Created' if created else 'Already exists'}: patient {p['email']}")
                patients.append(user)

            # ── Sample appointments (one per patient, skip if doctor has no id yet) ──
            now = datetime.now(timezone.utc)

            appt_specs = [
                dict(patient=patients[0], doctor=doctors[0], delta_days=-3,  status=AppointmentStatus.COMPLETED,  reason="Annual heart check-up"),
                dict(patient=patients[1], doctor=doctors[1], delta_days=2,   status=AppointmentStatus.CONFIRMED,  reason="Recurring headaches"),
                dict(patient=patients[2], doctor=doctors[2], delta_days=5,   status=AppointmentStatus.PENDING,    reason="Skin rash evaluation"),
                dict(patient=patients[3], doctor=doctors[3], delta_days=-1,  status=AppointmentStatus.CANCELLED,  reason="Knee pain follow-up"),
                dict(patient=patients[4], doctor=doctors[4], delta_days=7,   status=AppointmentStatus.PENDING,    reason="Child wellness check"),
            ]

            for spec in appt_specs:
                scheduled = (now + timedelta(days=spec["delta_days"])).replace(
                    hour=10, minute=0, second=0, microsecond=0
                )
                # Skip if any appointment (any status) already exists for this doctor+slot
                existing = await db.execute(
                    select(Appointment).where(
                        Appointment.doctor_id == spec["doctor"].id,
                        Appointment.scheduled_at == scheduled,
                    )
                )
                if existing.scalar_one_or_none():
                    print(f"  Skipped duplicate appointment for {spec['patient'].email}")
                    continue

                appt = Appointment(
                    patient_id=spec["patient"].id,
                    doctor_id=spec["doctor"].id,
                    scheduled_at=scheduled,
                    end_at=scheduled + timedelta(minutes=30),
                    status=spec["status"],
                    reason=spec["reason"],
                )
                db.add(appt)
                print(f"  Created appointment: {spec['patient'].full_name} → {spec['doctor'].id} ({spec['status'].value})")

            await db.commit()
            print("\nSeed completed successfully.")

        except Exception:
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(seed())
