"""Student management endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.models import ProjectType
from app.api import deps
from app.api.auth_deps import get_current_user

router = APIRouter()


@router.get("/", response_model=List[schemas.Student])
def list_students(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    project_type: Optional[str] = None,
    current_user: models.Teacher = Depends(get_current_user),
):
    query = db.query(models.Student)
    if project_type:
        try:
            project_enum = ProjectType(project_type)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid project_type") from exc
        query = query.filter(models.Student.project_type == project_enum)
    return query.offset(skip).limit(limit).all()


@router.get("/{student_id}", response_model=schemas.Student)
def get_student(
    student_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.post("/", response_model=schemas.Student, status_code=status.HTTP_201_CREATED)
def create_student(
    *,
    db: Session = Depends(deps.get_db),
    student_in: schemas.StudentCreate,
    current_user: models.Teacher = Depends(get_current_user),
):
    existing = (
        db.query(models.Student)
        .filter(models.Student.student_code == student_in.student_code)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Student code already exists")

    # 自动生成域名
    if not student_in.domain:
        # project_type is Enum, access value or use directly if string based
        suffix = "gd" if student_in.project_type == ProjectType.gd else "cd"
        student_in.domain = f"{student_in.student_code}.{suffix}.hydrosim.cn"

    student = models.Student(**student_in.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.put("/{student_id}", response_model=schemas.Student)
def update_student(
    *,
    db: Session = Depends(deps.get_db),
    student_id: int,
    student_in: schemas.StudentUpdate,
    current_user: models.Teacher = Depends(get_current_user),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    update_data = student_in.model_dump(exclude_unset=True)
    if "student_code" in update_data and update_data["student_code"] != student.student_code:
        existing = (
            db.query(models.Student)
            .filter(models.Student.student_code == update_data["student_code"])
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Student code already exists")

    for field, value in update_data.items():
        setattr(student, field, value)

    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    student_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    db.delete(student)
    db.commit()
