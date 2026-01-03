from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api import deps, auth_deps
from app.models.user import Teacher
from app.models.student import Student
from app.models.build import Build, BuildStatus
from app.schemas.build import Build as BuildSchema
from app.services.build_orchestrator import build_orchestrator
from app.services.build_logs import build_log_service

router = APIRouter()

@router.get("/", response_model=List[BuildSchema])
def read_builds(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    student_id: Optional[int] = None,
    current_user: Any = Depends(auth_deps.get_current_user),
):
    """
    Retrieve builds.
    """
    query = db.query(Build)
    
    # Access Control
    if hasattr(current_user, "role") and current_user.role == "student":
        student_id = current_user.id # Force student to see only their own
        query = query.filter(Build.student_id == student_id)
    elif student_id:
        query = query.filter(Build.student_id == student_id)
        
    builds = query.order_by(Build.created_at.desc()).offset(skip).limit(limit).all()
    for build in builds:
        if build.status in {BuildStatus.pending, BuildStatus.running}:
            build_orchestrator.sync_build_status(db, build)
    return builds

@router.post("/trigger", response_model=BuildSchema)
def trigger_build(
    student_id: int, # If admin triggering for student
    branch: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(auth_deps.get_current_user),
):
    """
    Manually trigger a build.
    """
    # Permission check
    if hasattr(current_user, "role") and current_user.role == "student":
        if current_user.id != student_id:
             raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        build = build_orchestrator.trigger_build(
            db=db, 
            student_id=student_id, 
            branch=branch
        )
        return build
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{build_id}/logs")
def get_build_logs(
    build_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(auth_deps.get_current_user),
):
    build = db.query(Build).filter(Build.id == build_id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
        
    # Permission check
    if hasattr(current_user, "role") and current_user.role == "student":
        if build.student_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
            
    build_orchestrator.sync_build_status(db, build)

    if not build.log_object_key:
        return {"content": "No logs available yet or check K8s console."}

    content = build_log_service.get_log(build.log_object_key)
    if content is None:
        url = build_log_service.get_presigned_url(build.log_object_key)
        return {"content": "Failed to retrieve logs.", "url": url}

    return {"content": content, "url": build_log_service.get_presigned_url(build.log_object_key)}
