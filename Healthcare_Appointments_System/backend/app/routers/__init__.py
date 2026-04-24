from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.doctors import router as doctors_router, specialty_router
from app.routers.appointments import router as appointments_router
from app.routers.admin import router as admin_router
from app.routers.reviews import router as reviews_router

__all__ = [
    "auth_router",
    "users_router",
    "doctors_router",
    "specialty_router",
    "appointments_router",
    "admin_router",
    "reviews_router",
]
