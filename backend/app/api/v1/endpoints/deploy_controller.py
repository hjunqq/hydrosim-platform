from fastapi import APIRouter, HTTPException, BackgroundTasks, Body
from pydantic import BaseModel
from typing import Optional
from kubernetes import client, config
from kubernetes.client.rest import ApiException
import logging

# ================= Configuration =================
# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("deploy-controller")

# 命名空间映射配置
NAMESPACE_MAP = {
    "gd": "students-gd",
    "cd": "students-cd"
}

# 基础域名配置
BASE_DOMAIN = "hydrosim.cn"

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

@router.post("/{student_code}", response_model=DeployResponse, status_code=202)
def trigger_deploy(student_code: str, req: DeployRequest):
    print(f"DEBUG: Handler reached! code={student_code}, body={req}")
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
    host = f"{student_code}.{req.project_type}.{BASE_DOMAIN}"
    
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
                domain_suffix=f"{req.project_type}.{BASE_DOMAIN}"
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

        return {
            "status": result_status,
            "message": f"Project {deployment_name} successfully {result_status}",
            "url": f"http://{host}"
        }

    except ApiException as e:
        logger.error(f"K8s API failed: {e}")
        logger.error(f"Exc Body: {e.body}")
        # 详细错误处理：权限、配额等
        if e.status == 403:
             raise HTTPException(status_code=500, detail="Deployment Controller RBAC permission denied.")
        raise HTTPException(status_code=500, detail=f"Kubernetes Operation Failed: {e.reason}, Body: {e.body}")
    except Exception as e:
        logger.exception("Unexpected error")
        raise HTTPException(status_code=500, detail=str(e))

from app.services.deployment_monitor import get_deployment_status

@router.delete("/{student_code}")
def delete_deployment(
    student_code: str, 
    project_type: str,
    # In a real app, inject user and check permissions here
    # current_user: models.Teacher = Depends(get_current_user)
):
    """
    Delete student deployment resources (Deployment, Service, Ingress).
    """
    if project_type not in NAMESPACE_MAP:
        raise HTTPException(status_code=400, detail="Invalid project_type")
        
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
def query_deploy_status(student_code: str, project_type: str):
    """
    Get realtime deployment status.
    Requires project_type query param (gd/cd) to locate the namespace.
    """
    result = get_deployment_status(student_code, project_type)
    if result["status"] == "error" and result.get("detail") == "Invalid project_type":
         raise HTTPException(status_code=400, detail="Invalid project_type")
    return result

@router.get("/resources/list")
def list_cluster_resources():
    """
    List all student deployments explicitly found in K8s clusters.
    Scans 'students-gd' and 'students-cd' namespaces.
    """
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
