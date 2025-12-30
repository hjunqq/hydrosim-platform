from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from app.models.user import UserRole

class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = UserRole.teacher
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    full_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None

class UserUpdatePassword(BaseModel):
    current_password: str
    new_password: str
