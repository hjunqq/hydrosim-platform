"""Student management endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.models import ProjectType
from app.api import deps
from app.api.auth_deps import get_current_user
from app.core.security import get_password_hash
from app.models.user import UserRole
from app.services.system_settings import get_or_create_settings, get_student_domain_parts

router = APIRouter()
DEFAULT_STUDENT_PASSWORD = "student123"


def _role_value(user: object) -> str:
    return getattr(getattr(user, "role", None), "value", getattr(user, "role", ""))


@router.get("/", response_model=List[schemas.Student])
def list_students(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    project_type: Optional[str] = None,
    current_user: models.Teacher = Depends(get_current_user),
):
    role = _role_value(current_user)
    if role == UserRole.student.value:
        raise HTTPException(status_code=403, detail="Not authorized to list students")
    query = db.query(models.Student)
    
    # Permission control: students only see themselves, teachers see their own students
    if getattr(current_user, 'role', '') == 'student':
        # current_user might be a Student model which has student_code as username match
        query = query.filter(models.Student.id == current_user.id)
    elif getattr(current_user, 'role', '') == 'teacher':
        query = query.filter(models.Student.teacher_id == current_user.id)
    # admins see all
    
    if project_type:
        try:
            project_enum = ProjectType(project_type)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid project_type") from exc
        query = query.filter(models.Student.project_type == project_enum)

    if role == UserRole.teacher.value:
        query = query.filter(models.Student.teacher_id == current_user.id)

    students_orm = query.offset(skip).limit(limit).all()
    settings = get_or_create_settings(db)
    
    # Enrich with Real-time K8s Status
    from app.services.deployment_monitor import get_all_deployment_statuses
    real_time_statuses = get_all_deployment_statuses()
    
    result = []
    for s in students_orm:
        # Convert to Pydantic model
        s_dto = schemas.Student.from_orm(s)

        if not s_dto.domain:
            _, _, domain = get_student_domain_parts(settings, s.student_code, s.project_type)
            s_dto.domain = domain
        
        # Check status
        if s.student_code in real_time_statuses:
            k8s_info = real_time_statuses[s.student_code]
            s_dto.latest_deploy_status = k8s_info.get("status", "not_deployed")
            s_dto.latest_deploy_message = k8s_info.get("detail", "")
            s_dto.running_image = k8s_info.get("image", "-")
            
            # Check Expected Image
            if s.expected_image_name and s_dto.latest_deploy_status not in ["not_deployed", "stopped"]:
                 if s.expected_image_name not in s_dto.running_image:
                      s_dto.latest_deploy_status = "error"
                      s_dto.latest_deploy_message = f"Missing expected image: {s.expected_image_name}"
        else:
            s_dto.latest_deploy_status = "not_deployed"
            
        result.append(s_dto)
        
    return result


@router.get("/{student_id}/", response_model=schemas.Student)
def get_student(
    student_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    role = _role_value(current_user)
    if role == UserRole.teacher.value and student.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this student")
    if role == UserRole.student.value and current_user.id != student.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this student")

    if not student.domain:
        settings = get_or_create_settings(db)
        _, _, domain = get_student_domain_parts(settings, student.student_code, student.project_type)
        student.domain = domain
    return student


@router.post("/", response_model=schemas.Student, status_code=status.HTTP_201_CREATED)
def create_student(
    *,
    db: Session = Depends(deps.get_db),
    student_in: schemas.StudentCreate,
    current_user: models.Teacher = Depends(get_current_user),
):
    role = _role_value(current_user)
    if role == UserRole.student.value:
        raise HTTPException(status_code=403, detail="Not authorized to create students")
    existing = (
        db.query(models.Student)
        .filter(models.Student.student_code == student_in.student_code)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Student code already exists")

    # 自动生成域名
    if not student_in.domain:
        settings = get_or_create_settings(db)
        _, _, domain = get_student_domain_parts(settings, student_in.student_code, student_in.project_type)
        student_in.domain = domain

    if role == UserRole.teacher.value:
        student_in.teacher_id = current_user.id

    student = models.Student(
        **student_in.model_dump(),
        password_hash=get_password_hash(DEFAULT_STUDENT_PASSWORD),
        role="student",
        is_active=True,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.put("/{student_id}/", response_model=schemas.Student)
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

    role = _role_value(current_user)
    if role == UserRole.student.value:
        raise HTTPException(status_code=403, detail="Not authorized to update students")
    if role == UserRole.teacher.value and student.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this student")

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

    if "domain" not in update_data:
        settings = get_or_create_settings(db)
        new_code = update_data.get("student_code", student.student_code)
        new_type = update_data.get("project_type", student.project_type)
        _, _, domain = get_student_domain_parts(settings, new_code, new_type)
        student.domain = domain

    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    student_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    role = _role_value(current_user)
    if role == UserRole.student.value:
        raise HTTPException(status_code=403, detail="Not authorized to delete students")
    if role == UserRole.teacher.value and student.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this student")

    db.delete(student)
    db.commit()
