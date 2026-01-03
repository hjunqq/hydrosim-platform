from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.build import BuildStatus

class BuildBase(BaseModel):
    student_id: int
    commit_sha: str
    branch: str
    image_tag: Optional[str] = None
    status: BuildStatus = BuildStatus.pending
    message: Optional[str] = None
    job_name: Optional[str] = None

class BuildCreate(BuildBase):
    pass

class BuildUpdate(BaseModel):
    status: Optional[BuildStatus] = None
    message: Optional[str] = None
    image_tag: Optional[str] = None
    log_object_key: Optional[str] = None
    job_name: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration: Optional[int] = None

class Build(BuildBase):
    id: int
    log_object_key: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
