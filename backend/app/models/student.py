from enum import Enum
from sqlalchemy import Boolean, Column, Integer, String, DateTime, func, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class ProjectType(str, Enum):
    gd = "gd"
    cd = "cd"
    platform = "platform"

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True) # Initially nullable for migration
    project_type = Column(SAEnum(ProjectType, name="project_type_enum"), nullable=False)
    git_repo_url = Column(String, nullable=True)
    expected_image_name = Column(String, nullable=True) # New field
    domain = Column(String, nullable=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    role = Column(String, default="student", server_default="student", nullable=False)
    is_active = Column(Boolean(), default=True, server_default="true", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    deployments = relationship(
        "Deployment",
        back_populates="student",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
