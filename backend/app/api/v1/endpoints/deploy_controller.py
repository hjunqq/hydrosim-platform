from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from typing import Optional
from kubernetes import client, config
from kubernetes.client.rest import ApiException
import logging
from sqlalchemy.orm import Session

from app import models
from app.api import deps
from app.core.config import settings
from app.core.naming import student_resource_name
from app.core.security import verify_token
from app.services.deploy_service import deploy_student_resources, NAMESPACE_MAP
from app.services.deployment_monitor import get_deployment_status
from app.services.build_orchestrator import build_orchestrator
from app.models.build import Build, BuildStatus
from app.models.build_config import BuildConfig

# ================= Configuration =================
# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("deploy-controller")

# 命名空间映射配置
# ================= K8s Client Init =================
# 注意：在生产环境中，这段代码应放在 core/k8s_client.py 中，并作为依赖注入
import os
try:
    config.load_incluster_config()
    logger.info("Loaded in-cluster config")
except config.ConfigException:
    try:
        # 优先寻找项目目录下的配置：backend/.kube/config
        # 当前文件: backend/app/api/v1/endpoints/deploy_controller.py
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(current_dir, "../../../.."))
        local_config_path = os.path.join(project_root, ".kube", "config")
        
        if os.path.exists(local_config_path):
            config.load_kube_config(config_file=local_config_path)
            logger.info(f"Loaded project local kubeconfig: {local_config_path}")
        else:
            config.load_kube_config()
            logger.warning("Loaded system default kubeconfig")
            
    except Exception as e:
        logger.error(f"Failed to load k8s config: {e}")

# 初始化 API 客户端
apps_v1 = client.AppsV1Api()
core_v1 = client.CoreV1Api()
networking_v1 = client.NetworkingV1Api()

# ================= Models =================
class DeployRequest(BaseModel):
    image: str
    project_type: str # 'gd' or 'cd'
    build_id: Optional[int] = None

    class Config:
        json_schema_extra = {
            "example": {
                "image": "registry.hydrosim.cn/gd/s2025_001:abc123",
                "project_type": "gd",
                "build_id": 123
            }
        }

class DeployResponse(BaseModel):
    status: str
    message: str
    url: Optional[str] = None

class DeployBuildRequest(BaseModel):
    build_id: Optional[int] = None
    project_type: Optional[str] = None

class DeployBuildResponse(DeployResponse):
    build_id: Optional[int] = None
    image: Optional[str] = None

# ================= Router =================
router = APIRouter()
auth_scheme = HTTPBearer(auto_error=False)


def _get_role_value(user: object) -> str:
    return getattr(getattr(user, "role", None), "value", getattr(user, "role", ""))


def _assert_student_access(actor: object, student: models.Student) -> None:
    role = _get_role_value(actor)
    if role == "admin":
        return
    if role == "teacher":
        if student.teacher_id and student.teacher_id != getattr(actor, "id", None):
            raise HTTPException(status_code=403, detail="Not authorized for this student")
        return
    if role == "student":
        if getattr(actor, "student_code", None) != student.student_code:
            raise HTTPException(status_code=403, detail="Not authorized for this student")
        return
    raise HTTPException(status_code=403, detail="Insufficient permissions")


def get_deploy_actor(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(auth_scheme),
    deploy_token: Optional[str] = Header(None, alias="X-Deploy-Token"),
    db: Session = Depends(deps.get_db),
):
    if credentials:
        payload = verify_token(credentials.credentials)
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")

        user = (
            db.query(models.Teacher)
            .filter(models.Teacher.username == username)
            .first()
        )
        if not user:
            user = (
                db.query(models.Student)
                .filter(models.Student.student_code == username)
                .first()
            )
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Inactive user")
        return user

    if settings.DEPLOY_TRIGGER_TOKEN:
        if deploy_token != settings.DEPLOY_TRIGGER_TOKEN:
            raise HTTPException(status_code=403, detail="Invalid deploy trigger token")
        return None

    raise HTTPException(status_code=401, detail="Missing authentication credentials")

@router.post("/{student_code}/", response_model=DeployResponse, status_code=202)
def trigger_deploy(
    student_code: str,
    req: DeployRequest,
    actor: Optional[object] = Depends(get_deploy_actor),
    db: Session = Depends(deps.get_db),
):
    """
    ??????????
    1. ?? project_type ?? namespace
    2. ?? Deployment ????
    3. ??? -> Create (Deploy + Svc + Ingress)
    4. ?? -> Patch (Image Update)
    """

    student = (
        db.query(models.Student)
        .filter(models.Student.student_code == student_code)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if actor is not None:
        _assert_student_access(actor, student)

    try:
        result = deploy_student_resources(
            db=db,
            student=student,
            image=req.image,
            project_type=req.project_type,
            build_id=req.build_id,
            apps_v1=apps_v1,
            core_v1=core_v1,
            networking_v1=networking_v1,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ApiException as e:
        logger.error(f"K8s API failed: {e}")
        logger.error(f"Exc Body: {e.body}")
        if e.status == 403:
            raise HTTPException(status_code=500, detail="Deployment Controller RBAC permission denied.")
        raise HTTPException(status_code=500, detail=f"Kubernetes Operation Failed: {e.reason}, Body: {e.body}")
    except Exception as e:
        logger.exception("Unexpected error")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{student_code}/build/", response_model=DeployBuildResponse, status_code=202)
def deploy_from_build(
    student_code: str,
    req: DeployBuildRequest,
    actor: Optional[object] = Depends(get_deploy_actor),
    db: Session = Depends(deps.get_db),
):
    student = (
        db.query(models.Student)
        .filter(models.Student.student_code == student_code)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if actor is not None:
        _assert_student_access(actor, student)

    project_type = req.project_type or getattr(student.project_type, "value", student.project_type)
    if project_type not in NAMESPACE_MAP:
        raise HTTPException(status_code=400, detail="Invalid project_type")

    build_query = db.query(Build).filter(Build.student_id == student.id)
    build = None
    if req.build_id:
        build = build_query.filter(Build.id == req.build_id).first()
        if not build:
            raise HTTPException(status_code=404, detail="Build not found")
    else:
        latest = build_query.order_by(Build.created_at.desc()).first()
        if latest and latest.status in {BuildStatus.pending, BuildStatus.running}:
            build_orchestrator.sync_build_status(db, latest)
            db.refresh(latest)
        if latest and latest.status == BuildStatus.success:
            build = latest
        else:
            build = (
                build_query.filter(Build.status == BuildStatus.success)
                .order_by(Build.created_at.desc())
                .first()
            )

    if not build:
        raise HTTPException(status_code=404, detail="No successful build found")

    if build.status in {BuildStatus.pending, BuildStatus.running}:
        build_orchestrator.sync_build_status(db, build)
        db.refresh(build)

    if build.status != BuildStatus.success:
        raise HTTPException(
            status_code=409,
            detail=f"Build is not ready (status={build.status})",
        )

    build_config = (
        db.query(BuildConfig)
        .filter(BuildConfig.student_id == student.id)
        .first()
    )

    try:
        image = build_orchestrator.resolve_image_for_build(
            db=db,
            build=build,
            build_config=build_config,
            student=student,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        result = deploy_student_resources(
            db=db,
            student=student,
            image=image,
            project_type=project_type,
            build_id=build.id,
            apps_v1=apps_v1,
            core_v1=core_v1,
            networking_v1=networking_v1,
        )
        return DeployBuildResponse(
            status=result["status"],
            message=result["message"],
            url=result.get("url"),
            build_id=build.id,
            image=image,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ApiException as e:
        logger.error(f"K8s API failed: {e}")
        logger.error(f"Exc Body: {e.body}")
        if e.status == 403:
            raise HTTPException(status_code=500, detail="Deployment Controller RBAC permission denied.")
        raise HTTPException(status_code=500, detail=f"Kubernetes Operation Failed: {e.reason}, Body: {e.body}")
    except Exception as e:
        logger.exception("Unexpected error")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{student_code}/")
def delete_deployment(
    student_code: str, 
    project_type: str,
    actor: Optional[object] = Depends(get_deploy_actor),
    db: Session = Depends(deps.get_db),
    # In a real app, inject user and check permissions here
    # current_user: models.Teacher = Depends(get_current_user)
):
    """
    Delete student deployment resources (Deployment, Service, Ingress).
    """
    if project_type not in NAMESPACE_MAP:
        raise HTTPException(status_code=400, detail="Invalid project_type")

    if actor is None:
        raise HTTPException(status_code=403, detail="Deploy token cannot delete resources")
    role = _get_role_value(actor)
    if role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete deployments")

    student = (
        db.query(models.Student)
        .filter(models.Student.student_code == student_code)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    _assert_student_access(actor, student)
        
    namespace = NAMESPACE_MAP[project_type]
    deployment_name = student_resource_name(student_code)
    
    deleted_resources = []
    errors = []

    # 1. Delete Ingress
    try:
        networking_v1.delete_namespaced_ingress(name=deployment_name, namespace=namespace)
        deleted_resources.append("Ingress")
    except ApiException as e:
        if e.status != 404: errors.append(f"Ingress: {e.reason}")

    # 2. Delete Service
    try:
        core_v1.delete_namespaced_service(name=deployment_name, namespace=namespace)
        deleted_resources.append("Service")
    except ApiException as e:
        if e.status != 404: errors.append(f"Service: {e.reason}")

    # 3. Delete Deployment
    try:
        apps_v1.delete_namespaced_deployment(name=deployment_name, namespace=namespace)
        deleted_resources.append("Deployment")
    except ApiException as e:
        if e.status != 404: errors.append(f"Deployment: {e.reason}")

    if not deleted_resources and not errors:
        return {"status": "not_found", "message": "No resources found to delete"}

    return {
        "status": "success",
        "deleted": deleted_resources,
        "errors": errors,
        "message": f"Deleted: {', '.join(deleted_resources)}"
    }

@router.get("/{student_code}")
def query_deploy_status(
    student_code: str,
    project_type: str,
    actor: Optional[object] = Depends(get_deploy_actor),
    db: Session = Depends(deps.get_db),
):
    """
    Get realtime deployment status.
    Requires project_type query param (gd/cd) to locate the namespace.
    """
    if actor is not None:
        student = (
            db.query(models.Student)
            .filter(models.Student.student_code == student_code)
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        _assert_student_access(actor, student)

    result = get_deployment_status(student_code, project_type)
    if result["status"] == "error" and result.get("detail") == "Invalid project_type":
         raise HTTPException(status_code=400, detail="Invalid project_type")
    return result

@router.get("/resources/list")
def list_cluster_resources(
    actor: Optional[object] = Depends(get_deploy_actor),
    db: Session = Depends(deps.get_db),
):
    """
    List all student deployments explicitly found in K8s clusters.
    Scans 'students-gd' and 'students-cd' namespaces.
    """
    if actor is None:
        raise HTTPException(status_code=403, detail="Deploy token cannot access cluster resources")
    role = _get_role_value(actor)
    if role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Not authorized to view cluster resources")

    allowed_codes = None
    if role == "teacher":
        rows = (
            db.query(models.Student.student_code)
            .filter(models.Student.teacher_id == actor.id)
            .all()
        )
        allowed_codes = {row[0] for row in rows}

    results = []
    
    for ns_type, ns_name in NAMESPACE_MAP.items():
        try:
            deps = apps_v1.list_namespaced_deployment(namespace=ns_name)
            for d in deps.items:
                # Parse metadata
                name = d.metadata.name # e.g. student-s2025_001
                labels = d.metadata.labels or {}
                code = labels.get("student")
                if not code:
                    code = name.replace("student-", "") if name.startswith("student-") else name
                
                # Basic Status
                ready = d.status.ready_replicas or 0
                total = d.spec.replicas or 0
                
                # Image
                image = "unknown"
                if d.spec.template.spec.containers:
                    image = d.spec.template.spec.containers[0].image
                
                if allowed_codes is not None and code not in allowed_codes:
                    continue

                results.append({
                    "student_code": code,
                    "project_type": ns_type,
                    "namespace": ns_name,
                    "deployment_name": name,
                    "image": image,
                    "replicas": f"{ready}/{total}",
                    "status": "Running" if ready == total and total > 0 else "Unhealthy",
                    "created_at": d.metadata.creation_timestamp
                })
        except Exception as e:
            logger.error(f"Failed to list resources in {ns_name}: {e}")
            
    return results
