"""Batch operations for student accounts."""
import csv
import io
from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app import models, schemas
from app.api import deps
from app.api.auth_deps import get_current_user
from app.core.security import get_password_hash
from app.models.user import UserRole
from app.models import ProjectType
from app.services.system_settings import get_or_create_settings, get_student_domain_parts

router = APIRouter()
DEFAULT_STUDENT_PASSWORD = "student123"


def _role_value(user: object) -> str:
    return getattr(getattr(user, "role", None), "value", getattr(user, "role", ""))


class ImportError(BaseModel):
    row: int
    student_code: str | None = None
    field: str | None = None
    error: str


class ImportResult(BaseModel):
    total: int
    success: int
    failed: int
    created_students: List[dict]
    errors: List[ImportError]


@router.post("/students/import/", response_model=ImportResult)
async def import_students(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    """批量导入学生（仅管理员可操作）"""
    role = _role_value(current_user)
    if role != UserRole.admin.value:
        raise HTTPException(status_code=403, detail="Only admin can import students")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    try:
        text = content.decode('utf-8-sig')  # Handle BOM
    except UnicodeDecodeError:
        text = content.decode('gbk')  # Fallback for Chinese Windows
    
    reader = csv.DictReader(io.StringIO(text))
    
    result = ImportResult(total=0, success=0, failed=0, created_students=[], errors=[])
    settings = get_or_create_settings(db)
    
    for row_num, row in enumerate(reader, start=2):  # Start from 2 (header is row 1)
        result.total += 1
        student_code = row.get('student_code', '').strip()
        name = row.get('name', '').strip()
        project_type = row.get('project_type', 'gd').strip()
        git_repo_url = row.get('git_repo_url', '').strip() or None
        expected_image_name = row.get('expected_image_name', '').strip() or None
        
        # Validation
        if not student_code:
            result.errors.append(ImportError(row=row_num, error="student_code is required"))
            result.failed += 1
            continue
        
        if not name:
            result.errors.append(ImportError(row=row_num, student_code=student_code, error="name is required"))
            result.failed += 1
            continue
        
        if project_type not in ['gd', 'cd']:
            result.errors.append(ImportError(
                row=row_num, 
                student_code=student_code, 
                field="project_type",
                error=f"Invalid project_type: {project_type}. Must be 'gd' or 'cd'"
            ))
            result.failed += 1
            continue
        
        # Check duplicate
        existing = db.query(models.Student).filter(
            models.Student.student_code == student_code
        ).first()
        if existing:
            result.errors.append(ImportError(
                row=row_num,
                student_code=student_code,
                error="Student code already exists"
            ))
            result.failed += 1
            continue
        
        # Create student
        try:
            _, _, domain = get_student_domain_parts(settings, student_code, project_type)
            student = models.Student(
                student_code=student_code,
                name=name,
                project_type=ProjectType(project_type),
                git_repo_url=git_repo_url,
                expected_image_name=expected_image_name,
                domain=domain,
                password_hash=get_password_hash(DEFAULT_STUDENT_PASSWORD),
                role="student",
                is_active=True,
            )
            db.add(student)
            db.flush()  # Get ID without committing
            
            result.created_students.append({
                "id": student.id,
                "student_code": student_code,
                "name": name
            })
            result.success += 1
        except Exception as e:
            result.errors.append(ImportError(
                row=row_num,
                student_code=student_code,
                error=str(e)
            ))
            result.failed += 1
    
    db.commit()
    return result


@router.get("/students/export/")
def export_students(
    format: str = "csv",
    project_type: str | None = None,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    """导出学生列表（仅管理员可操作）"""
    role = _role_value(current_user)
    if role != UserRole.admin.value:
        raise HTTPException(status_code=403, detail="Only admin can export students")
    
    query = db.query(models.Student)
    if project_type:
        try:
            pt = ProjectType(project_type)
            query = query.filter(models.Student.project_type == pt)
        except ValueError:
            pass
    
    students = query.all()
    
    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'student_code', 'name', 'project_type', 'git_repo_url', 
        'expected_image_name', 'domain', 'is_active', 'created_at'
    ])
    
    # Data rows
    for s in students:
        writer.writerow([
            s.student_code,
            s.name,
            s.project_type.value if s.project_type else '',
            s.git_repo_url or '',
            s.expected_image_name or '',
            s.domain or '',
            'active' if s.is_active else 'disabled',
            s.created_at.isoformat() if s.created_at else ''
        ])
    
    output.seek(0)
    filename = f"students_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/students/template/")
def download_import_template(
    current_user: models.Teacher = Depends(get_current_user),
):
    """下载导入模板"""
    role = _role_value(current_user)
    if role != UserRole.admin.value:
        raise HTTPException(status_code=403, detail="Only admin can download template")
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header with comments
    writer.writerow(['student_code', 'name', 'project_type', 'git_repo_url', 'expected_image_name'])
    # Example row
    writer.writerow(['202500001', '张三', 'gd', 'https://git.example.com/student/repo.git', ''])
    writer.writerow(['202500002', '李四', 'cd', '', ''])
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=student_import_template.csv"}
    )
