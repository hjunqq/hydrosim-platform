"""Deployment CRUD endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.api import deps
from app.api.auth_deps import get_current_user

router = APIRouter()


@router.get("/", response_model=List[schemas.Deployment])
def list_deployments(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    student_id: Optional[int] = None,
    current_user: models.Teacher = Depends(get_current_user),
):
    query = db.query(models.Deployment)
    if student_id is not None:
        query = query.filter(models.Deployment.student_id == student_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{deployment_id}", response_model=schemas.Deployment)
def get_deployment(
    deployment_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    deployment = db.query(models.Deployment).filter(models.Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment


@router.post("/", response_model=schemas.Deployment, status_code=status.HTTP_201_CREATED)
def create_deployment(
    *,
    db: Session = Depends(deps.get_db),
    deployment_in: schemas.DeploymentCreate,
    current_user: models.Teacher = Depends(get_current_user),
):
    student = db.query(models.Student).filter(models.Student.id == deployment_in.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

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


@router.patch("/{deployment_id}", response_model=schemas.Deployment)
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

    update_data = deployment_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(deployment, field, value)

    db.commit()
    db.refresh(deployment)
    return deployment


@router.delete("/{deployment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deployment(
    deployment_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    deployment = db.query(models.Deployment).filter(models.Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    db.delete(deployment)
    db.commit()
