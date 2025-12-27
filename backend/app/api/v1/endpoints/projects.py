"""
Project management endpoints
"""
from typing import List, Optional
from fastapi import APIRouter

router = APIRouter()


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app import models, schemas
from app.api import deps
from app.api.auth_deps import get_current_user
from app.schemas.project import ProjectOut

router = APIRouter()


@router.get("/", response_model=List[ProjectOut])
def list_projects(
    student_id: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    """
    查询项目列表 (List all student projects with latest deployment status)
    """
    query = db.query(models.Student)
    
    # Filter (if needed)
    if student_id:
        query = query.filter(models.Student.student_code == student_id)
        
    students = query.all()
    results = []
    
    for s in students:
        # Get latest deployment
        latest_deploy = (
            db.query(models.Deployment)
            .filter(models.Deployment.student_id == s.id)
            .order_by(desc(models.Deployment.created_at))
            .first()
        )
        
        project_data = ProjectOut(
            id=s.id,
            student_code=s.student_code,
            name=s.name,
            project_type=s.project_type,
            git_repo_url=s.git_repo_url,
            domain=s.domain,
            created_at=s.created_at,
            latest_deploy_status=latest_deploy.status if latest_deploy else None,
            latest_deploy_time=latest_deploy.created_at if latest_deploy else None,
            latest_deploy_message=latest_deploy.message if latest_deploy else None
        )
        results.append(project_data)
        
    return results


@router.get("/{project_id}")
def get_project(project_id: str):
    """获取项目详情"""
    # TODO: 实现项目详情查询
    return {"message": f"Get project {project_id} - to be implemented"}
