from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import UserRole


# ── Base ───────────────────────────────────────────────────────────────────────
class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    avatar_url: str | None = None


# ── Request schemas ────────────────────────────────────────────────────────────
class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole = UserRole.PATIENT

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("role")
    @classmethod
    def role_is_registrable(cls, v: UserRole) -> UserRole:
        if v in (UserRole.ADMIN, UserRole.RECEPTIONIST):
            raise ValueError("Cannot self-register as ADMIN or RECEPTIONIST")
        return v


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    avatar_url: str | None = None


class UserUpdatePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


# ── Response schemas ───────────────────────────────────────────────────────────
class UserResponse(UserBase):
    model_config = {"from_attributes": True}

    id: int
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserPublic(BaseModel):
    """Minimal user info safe to expose publicly."""
    model_config = {"from_attributes": True}

    id: int
    full_name: str
    avatar_url: str | None = None


class UserActiveUpdate(BaseModel):
    is_active: bool


class AdminUserCreate(BaseModel):
    """Used by admins to create doctor / receptionist accounts — no role restriction."""
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole = UserRole.DOCTOR
