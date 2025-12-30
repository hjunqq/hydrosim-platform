from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps, auth_deps
from app.schemas.user import User, UserUpdate, UserUpdatePassword
from app.core import security
from app import models

router = APIRouter()

@router.get("/me", response_model=User)
def get_my_profile(
    current_user: models.Teacher = Depends(auth_deps.get_current_user)
):
    """获取当前登录用户信息"""
    return current_user

@router.put("/me", response_model=User)
def update_my_profile(
    user_in: UserUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(auth_deps.get_current_user)
):
    """更新个人资料"""
    update_data = user_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/me/password", response_model=bool)
def change_my_password(
    password_in: UserUpdatePassword,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(auth_deps.get_current_user)
):
    """修改登录密码"""
    if not security.verify_password(password_in.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    current_user.password_hash = security.get_password_hash(password_in.new_password)
    db.add(current_user)
    db.commit()
    return True
