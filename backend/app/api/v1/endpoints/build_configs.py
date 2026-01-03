from typing import Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.api import deps, auth_deps
from app.models.build_config import BuildConfig
from pydantic import BaseModel
from app.schemas.build_config import BuildConfig as BuildConfigSchema
from app.services.deploy_keys import generate_deploy_key_pair

router = APIRouter()

def _get_role_value(user: Any) -> str:
    return getattr(getattr(user, "role", None), "value", getattr(user, "role", ""))

class BuildConfigUpdate(BaseModel):
    repo_url: Optional[str] = None
    branch: Optional[str] = None
    dockerfile_path: Optional[str] = None
    context_path: Optional[str] = None
    image_repo: Optional[str] = None
    tag_strategy: Optional[str] = None
    auto_build: Optional[bool] = None
    auto_deploy: Optional[bool] = None


class DeployKeyRequest(BaseModel):
    force: bool = False

@router.get("/me", response_model=Optional[BuildConfigSchema])
def read_my_build_config(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(auth_deps.get_current_user),
):
    if _get_role_value(current_user) != "student":
        raise HTTPException(status_code=403, detail="Not a student")
        
    config = db.query(BuildConfig).filter(BuildConfig.student_id == current_user.id).first()
    return config

@router.get("/{student_id}", response_model=Optional[BuildConfigSchema])
def read_build_config(
    student_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(auth_deps.get_current_user),
):
    # Admin only or self
    if _get_role_value(current_user) == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    config = db.query(BuildConfig).filter(BuildConfig.student_id == student_id).first()
    return config

@router.put("/{student_id}", response_model=BuildConfigSchema)
def update_build_config(
    student_id: int,
    config_in: BuildConfigUpdate,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(auth_deps.get_current_user),
):
    if _get_role_value(current_user) == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    config = db.query(BuildConfig).filter(BuildConfig.student_id == student_id).first()
    if not config:
        config = BuildConfig(student_id=student_id)
        db.add(config)
        
    if config_in.repo_url is not None: config.repo_url = config_in.repo_url
    if config_in.branch is not None: config.branch = config_in.branch
    if config_in.dockerfile_path is not None: config.dockerfile_path = config_in.dockerfile_path
    if config_in.context_path is not None: config.context_path = config_in.context_path
    if config_in.image_repo is not None: config.image_repo = config_in.image_repo
    if config_in.tag_strategy is not None: config.tag_strategy = config_in.tag_strategy
    if config_in.auto_build is not None: config.auto_build = config_in.auto_build
    if config_in.auto_deploy is not None: config.auto_deploy = config_in.auto_deploy

    db.commit()
    db.refresh(config)
    return config


@router.post("/{student_id}/deploy-key", response_model=BuildConfigSchema)
def generate_deploy_key(
    student_id: int,
    payload: DeployKeyRequest = Body(default=DeployKeyRequest()),
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(auth_deps.get_current_user),
):
    role = _get_role_value(current_user)
    if role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if role == "student" and payload.force:
        raise HTTPException(status_code=403, detail="Only admins or teachers can rotate deploy keys")

    config = db.query(BuildConfig).filter(BuildConfig.student_id == student_id).first()
    if not config:
        config = BuildConfig(student_id=student_id)
        db.add(config)

    if config.deploy_key_public and not payload.force:
        db.commit()
        db.refresh(config)
        return config

    key_pair = generate_deploy_key_pair()
    config.deploy_key_public = key_pair.public_key
    config.deploy_key_private = key_pair.private_key
    config.deploy_key_fingerprint = key_pair.fingerprint
    config.deploy_key_created_at = datetime.utcnow()

    db.commit()
    db.refresh(config)
    return config
