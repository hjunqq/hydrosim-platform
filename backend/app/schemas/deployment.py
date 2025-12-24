from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.deployment import DeploymentStatus


class DeploymentBase(BaseModel):
    image_tag: str


class DeploymentCreate(DeploymentBase):
    student_id: int


class DeploymentUpdate(BaseModel):
    image_tag: Optional[str] = None
    status: Optional[DeploymentStatus] = None
    message: Optional[str] = None
    last_deploy_time: Optional[datetime] = None


class Deployment(DeploymentBase):
    id: int
    student_id: int
    status: DeploymentStatus
    last_deploy_time: Optional[datetime]
    created_at: datetime
    message: Optional[str]

    class Config:
        from_attributes = True
