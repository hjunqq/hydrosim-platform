"""
Deployment trigger endpoints (DEPRECATED)
Use /api/v1/deploy/{student_code} (deploy_controller) instead.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models
from app.api import deps
from app.api.auth_deps import get_current_user

# Redirect to the new controller logic if possible, or just fail with instruction
from app.api.v1.endpoints.deploy_controller import trigger_deploy as new_trigger_deploy
from app.api.v1.endpoints.deploy_controller import DeployRequest as NewDeployRequest

router = APIRouter()

@router.post("/{student_id}")
def trigger_deploy(
    student_id: int,
    # Accept arbitrary body to avoid validation error, or matching schema
    payload: dict, 
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    """
    [DEPRECATED] 
    Please switch to POST /api/v1/deploy/{student_code}
    """
    # Try to find student to get code
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Forward to new controller logic if payload matches, otherwise error
    if "image_tag" in payload:
         # Adapter logic
         req = NewDeployRequest(image=payload["image_tag"], project_type=student.project_type)
         return new_trigger_deploy(student.student_code, req)
         
    raise HTTPException(
        status_code=400, 
        detail="This endpoint is deprecated. Use POST /api/v1/deploy/{student_code} with {'image': '...', 'project_type': '...'}"
    )
