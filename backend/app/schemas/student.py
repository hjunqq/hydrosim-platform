from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.student import ProjectType


class StudentBase(BaseModel):
    student_code: str
    name: str
    project_type: ProjectType
    git_repo_url: Optional[str] = None
    domain: Optional[str] = None


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    student_code: Optional[str] = None
    name: Optional[str] = None
    project_type: Optional[ProjectType] = None
    git_repo_url: Optional[str] = None
    domain: Optional[str] = None


class Student(StudentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
