from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import CurrentUser, CurrentAdmin, DBSession
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate

router = APIRouter(prefix="/api/users", tags=["Users"])


# ── Update current user ────────────────────────────────────────────────────────
@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update own profile (name, phone, avatar)",
)
async def update_my_profile(
    payload: UserUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> User:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    await db.flush()
    await db.refresh(current_user)
    return current_user


# ── Get user by id (admin or self) ─────────────────────────────────────────────
@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get a user by ID (self or admin only)",
)
async def get_user(
    user_id: int,
    current_user: CurrentUser,
    db: DBSession,
) -> User:
    from app.models.user import UserRole

    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorised to view this user",
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
