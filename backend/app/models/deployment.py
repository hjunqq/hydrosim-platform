from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, Enum as SAEnum, Text, text
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class DeploymentStatus(str, Enum):
    pending = "pending"
    running = "running"
    failed = "failed"

class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    image_tag = Column(String, nullable=False)
    status = Column(
        SAEnum(DeploymentStatus, name="deployment_status_enum"),
        nullable=False,
        server_default=text("'pending'"),
    )
    last_deploy_time = Column(DateTime(timezone=True), nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    student = relationship("Student", back_populates="deployments")
