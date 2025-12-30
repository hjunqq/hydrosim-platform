from enum import Enum
from sqlalchemy import Boolean, Column, Integer, String, DateTime, func, text, Enum as SAEnum
from app.db.base_class import Base

class UserRole(str, Enum):
    admin = "admin"
    teacher = "teacher"
    student = "student"

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    email = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    department = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    role = Column(SAEnum(UserRole), default=UserRole.teacher, server_default="teacher", nullable=False)
    is_active = Column(Boolean(), default=True, server_default=text("true"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
