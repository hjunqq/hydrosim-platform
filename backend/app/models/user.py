from sqlalchemy import Boolean, Column, Integer, String, DateTime, func, text
from app.db.base_class import Base

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    email = Column(String, nullable=True)
    is_active = Column(Boolean(), default=True, server_default=text("true"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
