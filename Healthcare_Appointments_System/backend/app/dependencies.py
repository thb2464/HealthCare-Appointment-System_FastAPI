from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.utils.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ── Type aliases ───────────────────────────────────────────────────────────────
DBSession = Annotated[AsyncSession, Depends(get_db)]
BearerToken = Annotated[str, Depends(oauth2_scheme)]


# ── Core auth dependency ───────────────────────────────────────────────────────
async def get_current_user(
    token: BearerToken,
    db: DBSession,
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exc
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exc
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )
    return current_user


# ── Role guard factories ───────────────────────────────────────────────────────
def require_roles(*roles: UserRole):
    """Return a dependency that enforces one of the given roles."""

    async def _check(
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _check


require_patient = require_roles(UserRole.PATIENT)
require_doctor  = require_roles(UserRole.DOCTOR)
require_admin   = require_roles(UserRole.ADMIN)
require_doctor_or_admin = require_roles(UserRole.DOCTOR, UserRole.ADMIN)

# Annotated shortcuts for cleaner router signatures
CurrentUser         = Annotated[User, Depends(get_current_active_user)]
CurrentPatient      = Annotated[User, Depends(require_patient)]
CurrentDoctor       = Annotated[User, Depends(require_doctor)]
CurrentAdmin        = Annotated[User, Depends(require_admin)]
CurrentDoctorOrAdmin = Annotated[User, Depends(require_doctor_or_admin)]
