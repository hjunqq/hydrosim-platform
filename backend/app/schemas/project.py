from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.student import ProjectType
from app.models.deployment import DeploymentStatus

class ProjectOut(BaseModel):
    id: int
    student_code: str
    name: str
    project_type: ProjectType
    git_repo_url: Optional[str]
    domain: Optional[str]
    created_at: datetime
    
    # Latest Deployment Info
    latest_deploy_status: Optional[DeploymentStatus] = None
    latest_deploy_time: Optional[datetime] = None
    latest_deploy_message: Optional[str] = None

    class Config:
        orm_mode = True
