from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class BuildStatus(str, Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"
    error = "error"
    cancelled = "cancelled"

class Build(Base):
    __tablename__ = "builds"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    commit_sha = Column(String, nullable=False)
    branch = Column(String, nullable=False)
    image_tag = Column(String, nullable=True)
    status = Column(SAEnum(BuildStatus, name="build_status_enum"), default=BuildStatus.pending, nullable=False)
    message = Column(Text, nullable=True)
    job_name = Column(String, nullable=True)
    log_object_key = Column(String, nullable=True) # Path in MinIO
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration = Column(Integer, nullable=True) # Duration in seconds
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    student = relationship("Student", backref="builds")
    deployments = relationship("Deployment", back_populates="build")
