from datetime import datetime

from fastapi import APIRouter, HTTPException, BackgroundTasks, Body, Depends, Header
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
from app.core.security import verify_token
from app.models.deployment import DeploymentStatus
from app.services.system_settings import get_or_create_settings, get_student_domain_parts

# ================= Configuration =================
# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("deploy-controller")

# 命名空间映射配置
NAMESPACE_MAP = {
    "gd": "students-gd",
    "cd": "students-cd"
}

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

    class Config:
        schema_extra = {
            "example": {
                "image": "registry.hydrosim.cn/gd/s2025_001:abc123",
                "project_type": "gd"
            }
        }

class DeployResponse(BaseModel):
    status: str
    message: str
    url: Optional[str] = None

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
    部署控制器核心接口：
    1. 根据 project_type 确定 namespace
    2. 检查 Deployment 是否存在
    3. 不存在 -> Create (Deploy + Svc + Ingress)
    4. 存在 -> Patch (Image Update)
    """
    
    # 1. 参数校验与 Namespace 映射
    if req.project_type not in NAMESPACE_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid project_type. Must be one of {list(NAMESPACE_MAP.keys())}")
    
    namespace = NAMESPACE_MAP[req.project_type]
    deployment_name = f"student-{student_code}" # 资源命名规范
    student = (
        db.query(models.Student)
        .filter(models.Student.student_code == student_code)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if getattr(student.project_type, "value", student.project_type) != req.project_type:
        raise HTTPException(status_code=400, detail="Project type mismatch")
    if actor is not None:
        _assert_student_access(actor, student)

    settings = get_or_create_settings(db)
    host_prefix, domain_suffix, full_domain = get_student_domain_parts(
        settings, student_code, req.project_type
    )
    deployment_record = models.Deployment(
        student_id=student.id,
        image_tag=req.image,
        status=DeploymentStatus.deploying,
        message="Deployment requested",
        last_deploy_time=datetime.utcnow(),
    )
    db.add(deployment_record)
    db.commit()
    db.refresh(deployment_record)

    logger.info(f"Starting deployment for {student_code} in {namespace}, image={req.image}")

    try:
        # 2. 检查 Deployment 是否存在
        exists = False
        try:
            apps_v1.read_namespaced_deployment(name=deployment_name, namespace=namespace)
            exists = True
        except ApiException as e:
            if e.status != 404:
                raise e # 抛出其他异常 (如 403 Forbidden)
        
        # 3. 分支逻辑
        if exists:
            # === Scenario A: Update ===
            patch_body = {
                "spec": {
                    "template": {
                        "spec": {
                            "containers": [
                                {
                                    "name": "app",
                                    "image": req.image
                                }
                            ]
                        }
                    }
                }
            }
            apps_v1.patch_namespaced_deployment(
                name=deployment_name,
                namespace=namespace,
                body=patch_body
            )
            result_status = "updated"
            logger.info(f"Patched deployment {deployment_name}")
            
        else:
            # === Scenario B: Create New ===
            from app.core.k8s_resources import generate_resources
            
            # 使用统一的资源生成器
            resources = generate_resources(
                student_code=student_code,
                image=req.image,
                namespace=namespace,
                domain_suffix=domain_suffix,
                host_prefix=host_prefix
            )
            
            # B1. Create Deployment
            apps_v1.create_namespaced_deployment(
                namespace=namespace, 
                body=resources["deployment"]
            )
            logger.info(f"Created deployment {deployment_name}")

            # B2. Create Service
            # 忽略 Service 已存在错误 (幂等性)
            try:
                core_v1.create_namespaced_service(
                    namespace=namespace, 
                    body=resources["service"]
                )
            except ApiException as e:
                if e.status != 409: raise e

            # B3. Create Ingress
            try:
                networking_v1.create_namespaced_ingress(
                    namespace=namespace, 
                    body=resources["ingress"]
                )
            except ApiException as e:
                if e.status != 409: raise e

            result_status = "created"

        deployment_record.status = DeploymentStatus.running
        deployment_record.message = f"Project {deployment_name} successfully {result_status}"
        deployment_record.last_deploy_time = datetime.utcnow()

        if student.domain != full_domain:
            student.domain = full_domain

        db.commit()
        return {
            "status": result_status,
            "message": f"Project {deployment_name} successfully {result_status}",
            "url": f"http://{full_domain}"
        }

    except ApiException as e:
        logger.error(f"K8s API failed: {e}")
        logger.error(f"Exc Body: {e.body}")
        # 详细错误处理：权限、配额等
        deployment_record.status = DeploymentStatus.failed
        deployment_record.message = f"Kubernetes Operation Failed: {e.reason}"
        deployment_record.last_deploy_time = datetime.utcnow()
        db.commit()
        if e.status == 403:
             raise HTTPException(status_code=500, detail="Deployment Controller RBAC permission denied.")
        raise HTTPException(status_code=500, detail=f"Kubernetes Operation Failed: {e.reason}, Body: {e.body}")
    except Exception as e:
        deployment_record.status = DeploymentStatus.failed
        deployment_record.message = str(e)
        deployment_record.last_deploy_time = datetime.utcnow()
        db.commit()
        logger.exception("Unexpected error")
        raise HTTPException(status_code=500, detail=str(e))

from app.services.deployment_monitor import get_deployment_status

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
    deployment_name = f"student-{student_code}"
    
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
