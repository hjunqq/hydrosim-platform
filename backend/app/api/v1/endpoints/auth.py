"""
Authentication endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.security import create_access_token, verify_password
from app.api import deps
from app import models

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


@router.post("/login/", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(deps.get_db)):
    """教师或学生登录"""
    # 1. 尝试查询教师账号
    user = db.query(models.Teacher).filter(
        models.Teacher.username == payload.username
    ).first()
    
    # 2. 如果不是教师，尝试查询学生账号 (使用学号登录)
    if not user:
        user = db.query(models.Student).filter(
            models.Student.student_code == payload.username
        ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # 检查账号是否激活
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account password not initialized"
        )
    
    # 验证密码
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # 取角色值
    role_val = user.role.value if hasattr(user.role, 'value') else user.role
    username_val = user.username if hasattr(user, 'username') else user.student_code

    # 创建 JWT token
    token = create_access_token(data={
        "sub": username_val,
        "user_id": user.id,
        "role": role_val
    })
    
    return TokenResponse(
        access_token=token,
        username=username_val,
        role=role_val
    )
