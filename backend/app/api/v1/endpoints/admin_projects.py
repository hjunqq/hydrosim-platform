from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.api import deps, admin_deps
from app.api.auth_deps import get_current_user
from app.models.user import Teacher, UserRole
from app.models.student import Student
from app.models.deployment import Deployment
from app.schemas.project import ProjectOut
from app.schemas.student import Student as StudentSchema

router = APIRouter()

@router.get("/projects", response_model=List[ProjectOut])
def list_projects(
    db: Session = Depends(deps.get_db),
    current_user: Teacher = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None
):
    """
    List projects.
    - If Admin: List all projects (optionally filtered by search).
    - If Teacher: List only projects belonging to this teacher.
    """
    query = db.query(Student)

    # Filter based on role
    if current_user.role != UserRole.admin:
        query = query.filter(Student.teacher_id == current_user.id)

    # Search filter
    if search:
        query = query.filter(Student.name.ilike(f"%{search}%") | Student.student_code.ilike(f"%{search}%"))

    students = query.offset(skip).limit(limit).all()
    results = []
    
    
    # [NEW] Check for Platform status if Admin
    real_time_statuses = {}
    if current_user.role == UserRole.admin:
        try:
            # 1. Platform Status
            from app.services.deployment_monitor import get_deployment_status, get_all_deployment_statuses, get_status_by_selector
            from datetime import datetime
            
            if skip == 0:
                # Use Label Selector to find all portal components (web, api, etc)
                # Configured to scan 'hydrosim' namespace for ALL pods (empty selector)
                portal_status = get_status_by_selector("hydrosim", "")
                
                # If selector returns not_deployed and detail is "No resources", maybe try old method or just accept it? 
                # If the user has multiple deployments, they MUST label them 'app=hydrosim-portal'.
                
                # Custom Image Verification for Platform
                p_status = portal_status.get("status", "unknown")
                p_image_str = portal_status.get("image", "")
                p_detail = portal_status.get("detail", "")
                
                required_imgs = ["hydrosim-portal-backend", "hydrosim-portal-frontend"]
                missing_imgs = [img for img in required_imgs if img not in p_image_str]
                
                if missing_imgs and p_status != "not_deployed": # Only check if we found something
                     p_status = "error"
                     p_detail = f"Missing components: {', '.join(missing_imgs)}"

                portal_project = ProjectOut(
                    id=0, # Special ID
                    student_code="SYSTEM",
                    name="Hydrosim Portal",
                    project_type="platform",
                    git_repo_url="https://gitea.hydrosim.cn/SmartWater/hydrosim-platform.git",
                    domain="portal.hydrosim.cn",
                    created_at=datetime.utcnow(),
                    latest_deploy_status=p_status,
                    latest_deploy_time=datetime.utcnow(), 
                    latest_deploy_message=p_detail,
                    running_image=p_image_str or "registry.hydrosim.cn/common/portal:latest"
                )
                results.append(portal_project)
                
            # 2. Bulk fetch student statuses
            real_time_statuses = get_all_deployment_statuses()
            
        except Exception as e:
            # Log error but don't break the response
            print(f"Error checking platform status: {e}")
            pass
    
    for s in students:
        # Get latest deployment from DB for history/time
        latest_deploy = (
            db.query(Deployment)
            .filter(Deployment.student_id == s.id)
            .order_by(desc(Deployment.created_at))
            .first()
        )
        
        # Determine Status
        status = "not_deployed"
        message = ""
        image = "-"
        
        # Check Real-time first
        if s.student_code in real_time_statuses:
            k8s_info = real_time_statuses[s.student_code]
            status = k8s_info.get("status", "unknown")
            message = k8s_info.get("detail", "")
            image = k8s_info.get("image", "-")
        elif latest_deploy:
             # Fallback to DB if no pod found? 
             # If no pod found, it IS not_deployed or stopped. 
             # Showing "Success" from 3 months ago when Pod is gone is misleading.
             # So we stick to "not_deployed" if not in map, UNLESS recent failure in DB?
             # Let's say if DB has a record, we use its time, but status is based on K8s.
             pass
        
        project_data = ProjectOut(
            id=s.id,
            student_code=s.student_code,
            name=s.name,
            project_type=s.project_type,
            git_repo_url=s.git_repo_url,
            domain=s.domain,
            created_at=s.created_at,
            latest_deploy_status=status,
            latest_deploy_time=latest_deploy.created_at if latest_deploy else None,
            latest_deploy_message=message or (latest_deploy.message if latest_deploy else ""),
            running_image=image,
            expected_image_name=s.expected_image_name
        )

        # Expected Image Check
        if s.expected_image_name and status != "not_deployed" and status != "stopped":
             if s.expected_image_name not in image:
                  project_data.latest_deploy_status = "error"
                  project_data.latest_deploy_message = f"Missing expected image: {s.expected_image_name}"

        results.append(project_data)
        
    return results

@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Teacher = Depends(get_current_user),
):
    # 1. Handle System Project (ID=0)
    if project_id == 0:
        if current_user.role != UserRole.admin:
             raise HTTPException(status_code=403, detail="Not authorized to view system project")
             
        # Platform Status Check (Refactored from list_projects)
        from app.services.deployment_monitor import get_status_by_selector
        from datetime import datetime
        
        try:
            portal_status = get_status_by_selector("hydrosim", "")
            p_status = portal_status.get("status", "unknown")
            p_image_str = portal_status.get("image", "")
            p_detail = portal_status.get("detail", "")
            
            required_imgs = ["hydrosim-portal-backend", "hydrosim-portal-frontend"]
            missing_imgs = [img for img in required_imgs if img not in p_image_str]
            
            if missing_imgs and p_status != "not_deployed":
                 p_status = "error"
                 p_detail = f"Missing components: {', '.join(missing_imgs)}"
            
            return ProjectOut(
                id=0,
                student_code="SYSTEM",
                name="Hydrosim Portal",
                project_type="platform",
                git_repo_url="https://gitea.hydrosim.cn/SmartWater/hydrosim-platform.git",
                domain="portal.hydrosim.cn",
                created_at=datetime.utcnow(),
                latest_deploy_status=p_status,
                latest_deploy_time=datetime.utcnow(),
                latest_deploy_message=p_detail,
                running_image=p_image_str or "registry.hydrosim.cn/common/portal:latest"
            )
        except Exception as e:
            # Fallback
            return ProjectOut(
                id=0,
                student_code="SYSTEM",
                name="Hydrosim Portal",
                project_type="platform",
                git_repo_url="",
                created_at=datetime.utcnow(),
                latest_deploy_status="error",
                latest_deploy_message=str(e)
            )

    # 2. Handle Student Project
    student = db.query(Student).filter(Student.id == project_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Project not found")

    # Access control
    if current_user.role != UserRole.admin and student.teacher_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized to view this project")

    # 3. Get Deployment Status
    from app.services.deployment_monitor import get_all_deployment_statuses
    from app.models.deployment import Deployment
    
    # Get latest DB record
    latest_deploy = (
        db.query(Deployment)
        .filter(Deployment.student_id == student.id)
        .order_by(desc(Deployment.created_at))
        .first()
    )

    # Get real-time status
    # Note: get_all_deployment_statuses scans ALL namespaces. 
    # For a single project, we could optimize but checking all is fine for now.
    real_time_statuses = get_all_deployment_statuses()
    
    status = "not_deployed"
    message = ""
    image = "-"

    if student.student_code in real_time_statuses:
        k8s_info = real_time_statuses[student.student_code]
        status = k8s_info.get("status", "unknown")
        message = k8s_info.get("detail", "")
        image = k8s_info.get("image", "-")
    elif latest_deploy:
        pass # Use defaults
        
    project_data = ProjectOut(
        id=student.id,
        student_code=student.student_code,
        name=student.name,
        project_type=student.project_type,
        git_repo_url=student.git_repo_url,
        domain=student.domain,
        created_at=student.created_at,
        latest_deploy_status=status,
        latest_deploy_time=latest_deploy.created_at if latest_deploy else None,
        latest_deploy_message=message or (latest_deploy.message if latest_deploy else ""),
        running_image=image,
        expected_image_name=student.expected_image_name
    )
    
    # Expected Image Check
    if student.expected_image_name and status != "not_deployed" and status != "stopped":
         if student.expected_image_name not in image:
              project_data.latest_deploy_status = "error"
              project_data.latest_deploy_message = f"Missing expected image: {student.expected_image_name}"

    return project_data

from pydantic import BaseModel
class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    git_repo_url: Optional[str] = None
    expected_image_name: Optional[str] = None
    description: Optional[str] = None

@router.put("/projects/{project_id}", response_model=StudentSchema)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: Session = Depends(deps.get_db),
    current_user: Teacher = Depends(get_current_user),
):
    project = db.query(Student).filter(Student.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user.role != UserRole.admin and project.teacher_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized to update this project")

    if project_in.name:
        project.name = project_in.name
    if project_in.git_repo_url:
        project.git_repo_url = project_in.git_repo_url
    if project_in.expected_image_name is not None:
         project.expected_image_name = project_in.expected_image_name
    # description field might need to be added to Student model if not present, 
    # but based on prompt "fix my project", git_repo is key.
    
    db.commit()
    db.refresh(project)
    return project
