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


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(deps.get_db)):
    """教师登录"""
    # 查询教师账号
    teacher = db.query(models.Teacher).filter(
        models.Teacher.username == payload.username
    ).first()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # 检查账号是否激活
    if not teacher.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    # 验证密码
    if not verify_password(payload.password, teacher.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # 创建 JWT token
    token = create_access_token(data={
        "sub": teacher.username,
        "user_id": teacher.id
    })
    
    return TokenResponse(
        access_token=token,
        username=teacher.username
    )
