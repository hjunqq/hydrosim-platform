from fastapi import Depends, HTTPException, status
from app.api import deps
from app.api.auth_deps import get_current_user
from app.models.user import Teacher, UserRole

def get_current_admin(
    current_user: Teacher = Depends(get_current_user),
) -> Teacher:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )
    return current_user
