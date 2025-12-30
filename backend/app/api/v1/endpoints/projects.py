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
    current_user = Depends(get_current_user),
):
    """
    查询项目列表 (List all student projects with latest deployment status)
    """
    query = db.query(models.Student)
    
    # 权限控制: 如果是学生，只能查自己
    if getattr(current_user, 'role', '') == 'student':
        query = query.filter(models.Student.id == current_user.id)
    # 如果是教师，只能查自己名下的学生 (除非管理员)
    elif getattr(current_user, 'role', '') == 'teacher':
        query = query.filter(models.Student.teacher_id == current_user.id)
    
    # Filter by optional query param (if allowed by role)
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

@router.get("/me", response_model=ProjectOut)
def get_my_project(
    db: Session = Depends(deps.get_db),
    current_user = Depends(get_current_user)
):
    """学生获取自己的项目详情"""
    if getattr(current_user, 'role', '') != 'student':
        raise HTTPException(status_code=403, detail="Only students can access /me")
        
    student = db.query(models.Student).filter(models.Student.id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")
        
    # Get latest deployment
    latest_deploy = (
        db.query(models.Deployment)
        .filter(models.Deployment.student_id == student.id)
        .order_by(desc(models.Deployment.created_at))
        .first()
    )
    
    return ProjectOut(
        id=student.id,
        student_code=student.student_code,
        name=student.name,
        project_type=student.project_type,
        git_repo_url=student.git_repo_url,
        domain=student.domain,
        created_at=student.created_at,
        latest_deploy_status=latest_deploy.status if latest_deploy else None,
        latest_deploy_time=latest_deploy.created_at if latest_deploy else None,
        latest_deploy_message=latest_deploy.message if latest_deploy else None
    )


@router.get("/{project_id}")
def get_project(project_id: str):
    """获取项目详情"""
    # TODO: 实现项目详情查询
    return {"message": f"Get project {project_id} - to be implemented"}
