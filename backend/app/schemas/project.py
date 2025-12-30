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
    git_repo_url: Optional[str] = None
    expected_image_name: Optional[str] = None
    domain: Optional[str] = None
    created_at: datetime
    
    # Latest Deployment Info
    latest_deploy_status: Optional[DeploymentStatus] = None
    latest_deploy_time: Optional[datetime] = None
    latest_deploy_message: Optional[str] = None
    running_image: Optional[str] = None # Added for real-time image info

    class Config:
        orm_mode = True
