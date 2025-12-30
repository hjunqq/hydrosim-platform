"""Authentication dependencies for protected routes."""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.security import verify_token
from app.api import deps
from app import models

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(deps.get_db)
):
    """
    Validate JWT token and return current teacher or student user.
    """
    token = credentials.credentials
    
    try:
        payload = verify_token(token)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    username: Optional[str] = payload.get("sub")
    role: Optional[str] = payload.get("role")
    
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check role derived from token (if exists) or try both tables
    user = None
    
    # 1. Try Teachers
    user = db.query(models.Teacher).filter(
        models.Teacher.username == username
    ).first()
    
    # 2. Try Students if not found in Teachers
    if user is None:
        user = db.query(models.Student).filter(
            models.Student.student_code == username
        ).first()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    return user
