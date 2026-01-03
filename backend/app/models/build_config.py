from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class BuildConfig(Base):
    __tablename__ = "build_configs"

    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True, index=True)
    repo_url = Column(String, nullable=False)
    branch = Column(String, default="main", nullable=False)
    dockerfile_path = Column(String, default="Dockerfile", nullable=False)
    context_path = Column(String, default=".", nullable=False)
    registry_id = Column(String, nullable=True) # ID of the registry credential to use (optional mainly for future use)
    image_repo = Column(String, nullable=True) # e.g. registry.example.com/student-project
    tag_strategy = Column(String, default="short_sha", nullable=False) # short_sha, branch_latest, etc.
    auto_build = Column(Boolean, default=True, nullable=False)
    auto_deploy = Column(Boolean, default=True, nullable=False)
    deploy_key_public = Column(Text, nullable=True)
    deploy_key_private = Column(Text, nullable=True)
    deploy_key_fingerprint = Column(String, nullable=True)
    deploy_key_created_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    student = relationship("Student", backref="build_config")
