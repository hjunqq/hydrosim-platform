"""Deployment CRUD endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app import models, schemas
from app.api import deps
from app.api.auth_deps import get_current_user
from app.models.user import UserRole

router = APIRouter()


def _role_value(user: object) -> str:
    return getattr(getattr(user, "role", None), "value", getattr(user, "role", ""))


@router.get("/", response_model=List[schemas.Deployment])
def list_deployments(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    student_id: Optional[int] = None,
    current_user: models.Teacher = Depends(get_current_user),
):
    role = _role_value(current_user)
    query = db.query(models.Deployment).order_by(desc(models.Deployment.created_at))

    if role == UserRole.student.value:
        query = query.filter(models.Deployment.student_id == current_user.id)
    elif role == UserRole.teacher.value:
        query = (
            query.join(models.Student)
            .filter(models.Student.teacher_id == current_user.id)
        )

    if student_id is not None:
        if role == UserRole.student.value and student_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this student's deployments")
        query = query.filter(models.Deployment.student_id == student_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{deployment_id}/", response_model=schemas.Deployment)
def get_deployment(
    deployment_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    deployment = db.query(models.Deployment).filter(models.Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    role = _role_value(current_user)
    if role == UserRole.student.value and deployment.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this deployment")
    if role == UserRole.teacher.value:
        student = db.query(models.Student).filter(models.Student.id == deployment.student_id).first()
        if student and student.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this deployment")
    return deployment


@router.post("/", response_model=schemas.Deployment, status_code=status.HTTP_201_CREATED)
def create_deployment(
    *,
    db: Session = Depends(deps.get_db),
    deployment_in: schemas.DeploymentCreate,
    current_user: models.Teacher = Depends(get_current_user),
):
    role = _role_value(current_user)
    if role == UserRole.student.value:
        raise HTTPException(status_code=403, detail="Not authorized to create deployments")
    student = db.query(models.Student).filter(models.Student.id == deployment_in.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if role == UserRole.teacher.value and student.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to create this deployment")

    deployment = models.Deployment(
        student_id=deployment_in.student_id,
        image_tag=deployment_in.image_tag,
        status=models.DeploymentStatus.pending,
        message="Queued for deployment",
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)
    return deployment


@router.patch("/{deployment_id}/", response_model=schemas.Deployment)
def update_deployment(
    *,
    db: Session = Depends(deps.get_db),
    deployment_id: int,
    deployment_in: schemas.DeploymentUpdate,
    current_user: models.Teacher = Depends(get_current_user),
):
    deployment = db.query(models.Deployment).filter(models.Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    role = _role_value(current_user)
    if role == UserRole.student.value:
        raise HTTPException(status_code=403, detail="Not authorized to update deployments")
    if role == UserRole.teacher.value:
        student = db.query(models.Student).filter(models.Student.id == deployment.student_id).first()
        if student and student.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this deployment")

    update_data = deployment_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(deployment, field, value)

    db.commit()
    db.refresh(deployment)
    return deployment


@router.delete("/{deployment_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_deployment(
    deployment_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    deployment = db.query(models.Deployment).filter(models.Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    role = _role_value(current_user)
    if role == UserRole.student.value:
        raise HTTPException(status_code=403, detail="Not authorized to delete deployments")
    if role == UserRole.teacher.value:
        student = db.query(models.Student).filter(models.Student.id == deployment.student_id).first()
        if student and student.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this deployment")

    db.delete(deployment)
    db.commit()
