from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class BuildConfigBase(BaseModel):
    student_id: int
    repo_url: Optional[str] = None
    branch: Optional[str] = None
    dockerfile_path: Optional[str] = None
    context_path: Optional[str] = None
    registry_id: Optional[str] = None
    image_repo: Optional[str] = None
    tag_strategy: Optional[str] = None
    auto_build: Optional[bool] = None
    auto_deploy: Optional[bool] = None
    deploy_key_public: Optional[str] = None
    deploy_key_fingerprint: Optional[str] = None
    deploy_key_created_at: Optional[datetime] = None


class BuildConfig(BuildConfigBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
