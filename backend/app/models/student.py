from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, func, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class ProjectType(str, Enum):
    gd = "gd"
    cd = "cd"

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    project_type = Column(SAEnum(ProjectType, name="project_type_enum"), nullable=False)
    git_repo_url = Column(String, nullable=True)
    domain = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    deployments = relationship(
        "Deployment",
        back_populates="student",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
