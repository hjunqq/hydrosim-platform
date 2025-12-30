from sqlalchemy import Column, Integer, String, Boolean, DateTime, func, text
from app.db.base_class import Base

class Registry(Base):
    __tablename__ = "registries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    url = Column(String, nullable=False)
    username = Column(String, nullable=True)
    password = Column(String, nullable=True)
    is_active = Column(Boolean(), default=True, server_default=text("true"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
