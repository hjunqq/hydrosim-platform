"""
Deployment trigger endpoints
"""
import os
import subprocess
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jinja2 import Environment, FileSystemLoader

from app import models, schemas
from app.api import deps
from app.api.auth_deps import get_current_user
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Setup Jinja2
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "templates")
env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))


class DeployRequest(BaseModel):
    image_tag: str = "nginx:alpine"  # Default for testing


@router.post("/{student_id}")
def trigger_deploy(
    student_id: int,
    payload: DeployRequest,
    db: Session = Depends(deps.get_db),
    current_user: models.Teacher = Depends(get_current_user),
):
    """
    Trigger deployment for a student.
    1. Query student
    2. Render K8s YAML
    3. Apply via kubectl
    4. Record in DB
    """
    # 1. Query Student
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 2. Prepare Context
    namespace = f"students-{student.project_type.value}"  # students-gd or students-cd
    app_name = student.student_code.lower().replace("_", "-")
    
    # Render Template
    try:
        template = env.get_template("k8s/student_app.yaml.j2")
        rendered_yaml = template.render(
            app_name=app_name,
            namespace=namespace,
            student_code=student.student_code,
            image_tag=payload.image_tag,
            domain=student.domain
        )
    except Exception as e:
        logger.error(f"Template render failed: {e}")
        raise HTTPException(status_code=500, detail=f"Template error: {e}")

    # 3. Apply via kubectl
    try:
        # Ensure namespace exists (optional, but good practice)
        subprocess.run(
            ["kubectl", "create", "namespace", namespace],
            check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )

        # Apply YAML
        process = subprocess.run(
            ["kubectl", "apply", "-f", "-"],
            input=rendered_yaml.encode('utf-8'),
            capture_output=True,
            check=True
        )
        logger.info(f"Kubectl output: {process.stdout.decode()}")
        
        deploy_status = models.DeploymentStatus.running
        message = "Deployment submitted successfully"
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Kubectl failed: {e.stderr.decode()}")
        deploy_status = models.DeploymentStatus.failed
        message = f"Kubectl error: {e.stderr.decode()}"
    except FileNotFoundError:
        logger.error("Kubectl not found")
        deploy_status = models.DeploymentStatus.failed
        message = "kubectl command not found on server"

    # 4. Update deployments table
    deployment = models.Deployment(
        student_id=student.id,
        image_tag=payload.image_tag,
        status=deploy_status,
        message=message
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)

    if deploy_status == models.DeploymentStatus.failed:
        raise HTTPException(status_code=500, detail=message)

    return {"status": "success", "deployment_id": deployment.id, "domain": student.domain}
