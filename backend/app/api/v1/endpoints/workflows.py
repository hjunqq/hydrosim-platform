"""
CI/CD workflow endpoints
"""
from typing import Optional
from fastapi import APIRouter

router = APIRouter()


from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Any
from app import models
from app.api import deps
from app.api.auth_deps import get_current_user
from app.services.gitea_service import gitea_service
from app.core.config import settings

router = APIRouter()

@router.get("/")
def list_workflows(
    student_id: int, 
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user)
):
    """
    List workflows for a specific student's repository.
    """
    if not settings.GITEA_URL:
        raise HTTPException(status_code=503, detail="Gitea integration not configured")

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not student.git_repo_url:
        raise HTTPException(status_code=400, detail="Student has no Git repository linked")

    # Assuming repo URL format: http://gitea.example.com/owner/repo.git
    # We need to extract owner and repo name
    try:
        # Simple parsing logic
        parts = student.git_repo_url.rstrip(".git").split("/")
        repo_name = parts[-1]
        owner = parts[-2]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Git repository URL format")

    # Fetch runs directly as "Workflows" (Deployment History view)
    runs = gitea_service.get_workflow_runs(owner, repo_name)
    return runs

@router.get("/{run_id}/")
def get_workflow_run(
    run_id: str,
    # TODO: Add logic to find owner/repo context if needed, or pass student_id query param
):
    """Get single workflow run details"""
    # Requires more context or a different API design if run_id is not globally unique or queryable directly
    return {"message": "Not implemented yet"}

