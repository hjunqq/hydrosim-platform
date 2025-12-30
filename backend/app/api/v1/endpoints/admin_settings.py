from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps, admin_deps, auth_deps
from app.schemas.setting import SystemSettingRead, SystemSettingUpdate
from app.schemas.semester import SemesterRead, SemesterCreate, SemesterUpdate
from app import models

router = APIRouter()

# --- System Settings ---

@router.get("/settings", response_model=SystemSettingRead)
def get_system_settings(
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin)
):
    """获取系统全局设置"""
    settings = db.query(models.SystemSetting).first()
    if not settings:
        # Initial default if none exist
        settings = models.SystemSetting()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/settings", response_model=SystemSettingRead)
def update_system_settings(
    setting_in: SystemSettingUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin)
):
    """更新系统全局设置"""
    settings = db.query(models.SystemSetting).first()
    if not settings:
        settings = models.SystemSetting()
    
    update_data = setting_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)
    
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings

# --- Semesters ---

@router.get("/semesters", response_model=List[SemesterRead])
def list_semesters(
    db: Session = Depends(deps.get_db),
    current_user = Depends(auth_deps.get_current_user)
):
    return db.query(models.Semester).all()

@router.post("/semesters", response_model=SemesterRead)
def create_semester(
    semester_in: SemesterCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin)
):
    semester = models.Semester(**semester_in.dict())
    db.add(semester)
    db.commit()
    db.refresh(semester)
    return semester

@router.put("/semesters/{semester_id}", response_model=SemesterRead)
def update_semester(
    semester_id: int,
    semester_in: SemesterUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin)
):
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    update_data = semester_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(semester, field, value)
    
    db.add(semester)
    db.commit()
    db.refresh(semester)
    return semester

@router.delete("/semesters/{semester_id}", response_model=bool)
def delete_semester(
    semester_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(admin_deps.get_current_admin)
):
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    db.delete(semester)
    db.commit()
    return True
