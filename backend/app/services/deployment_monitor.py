from kubernetes import client, config
from kubernetes.client.rest import ApiException
import logging
from typing import Dict, Optional

logger = logging.getLogger("deployment-monitor")

# 复用之前的配置，建议集中管理
NAMESPACE_MAP = {
    "gd": "students-gd",
    "cd": "students-cd",
    "platform": "default"
}

import os
try:
    config.load_incluster_config()
except:
    try:
        # 优先寻找项目目录下的配置：backend/.kube/config
        # 当前文件: backend/app/services/deployment_monitor.py
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(current_dir, "../.."))
        local_config_path = os.path.join(project_root, ".kube", "config")
        
        if os.path.exists(local_config_path):
            config.load_kube_config(config_file=local_config_path)
            logger.info(f"Loaded project local kubeconfig: {local_config_path}")
        else:
            config.load_kube_config()
    except Exception as e:
         logger.error(f"Failed to load k8s config: {e}")

apps_v1 = client.AppsV1Api()
core_v1 = client.CoreV1Api()

def get_deployment_status(student_code: str, project_type: str) -> Dict[str, str]:
    """
    查询学生项目的部署状态
    
    返回字典结构:
    {
        "status": "not_deployed" | "deploying" | "running" | "error" | "stopped",
        "detail": "具体的 Pod 状态或错误信息",
        "ready_replicas": 1/1
    }
    """
    
    # 1. 确定 Namespace 和资源名称
    namespace = NAMESPACE_MAP.get(project_type)
    if not namespace:
        return {"status": "error", "detail": "Invalid project_type"}
        
    if project_type == 'platform':
        deployment_name = "hydrosim-portal"
    else:
        deployment_name = f"student-{student_code}"
    
    try:
        # 2. 获取 Deployment 状态
        deployment = apps_v1.read_namespaced_deployment(
            name=deployment_name, 
            namespace=namespace
        )
        
        # 检查副本数
        replicas = deployment.spec.replicas or 0
        ready_replicas = deployment.status.ready_replicas or 0
        unavailable_replicas = deployment.status.unavailable_replicas or 0
        
        # 简易判断：如果 Ready = Replicas > 0 -> Running
        if replicas > 0 and ready_replicas == replicas:
            # Extract images from Deployment spec
            images = []
            if deployment.spec.template.spec.containers:
                images = [c.image for c in deployment.spec.template.spec.containers]
            image_str = "\n".join(images)

            return {
                "status": "running", 
                "detail": "All replicas ready", 
                "ready_replicas": f"{ready_replicas}/{replicas}",
                "image": image_str
            }
            
        # 如果副本数为 0 -> Stopped
        if replicas == 0:
            return {
                "status": "stopped", 
                "detail": "Scaled to 0",
                "ready_replicas": "0/0"
            }

        # 3. 深入检查 Pod 状态 (当 Deployment 未由 Ready 时)
        # 获取关联 Pods
        label_selector = f"app={deployment_name}"
        pods = core_v1.list_namespaced_pod(
            namespace=namespace, 
            label_selector=label_selector
        )
        
        if not pods.items:
             return {
                "status": "deploying", 
                "detail": "Waiting for pods to be created...", 
                "ready_replicas": f"0/{replicas}"
            }

        # 分析第一个 Pod (假设只有 1 个副本)
        pod = pods.items[0]
        pod_phase = pod.status.phase # Pending, Running, Succeeded, Failed, Unknown
        
        # 3.1 检查容器状态 (是否有 CrashLoopBackOff 等)
        container_statuses = pod.status.container_statuses or []
        for cs in container_statuses:
            if cs.state.waiting:
                reason = cs.state.waiting.reason
                if reason in ["CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull"]:
                    return {
                        "status": "error", 
                        "detail": f"Pod Error: {reason} - {cs.state.waiting.message}",
                        "ready_replicas": f"{ready_replicas}/{replicas}"
                    }
                # 如果是 ContainerCreating，算作 deploying
            
            if cs.state.terminated and cs.state.terminated.exit_code != 0:
                 return {
                    "status": "error", 
                    "detail": f"Container Terminated with exit code {cs.state.terminated.exit_code}",
                    "ready_replicas": f"{ready_replicas}/{replicas}"
                }

        # 3.2 根据 Pod Phase 返回
        if pod_phase == "Pending":
             return {
                "status": "deploying", 
                "detail": "Pod is Pending (scheduling or pulling image)", 
                "ready_replicas": f"{ready_replicas}/{replicas}"
            }
            
        return {
            "status": "deploying", 
            "detail": f"Pod Phase: {pod_phase}, Waiting for readiness probe...", 
            "ready_replicas": f"{ready_replicas}/{replicas}"
        }

    except ApiException as e:
        if e.status == 404:
            return {"status": "not_deployed", "detail": "Resource not found", "ready_replicas": "0/0"}
        
        logger.error(f"K8s API Error: {e}")
        return {"status": "error", "detail": f"K8s API Error: {e.reason}", "ready_replicas": "?"}
    except Exception as e:
        logger.exception("Unexpected error checking status")
        return {"status": "error", "detail": str(e), "ready_replicas": "?"}

def get_all_deployment_statuses(student_namespaces: list = None) -> Dict[str, Dict]:
    """
    Fetch ALL student deployments in one go (per namespace) to optimize Admin Projects list.
    Returns: { "student_code": { "status": ..., "image": ..., "detail": ... }, ... }
    """
    if not student_namespaces:
        student_namespaces = ["students-gd", "students-cd"]
    
    result_map = {}
    
    for ns in student_namespaces:
        try:
            # 1. List all Pods in namespace
            # We assume label 'app=student-{code}' or similar.
            # Actually, the convention in get_deployment_status is 'app=student-{code}'.
            
            pods = core_v1.list_namespaced_pod(namespace=ns)
            for pod in pods.items:
                app_label = pod.metadata.labels.get("app") # e.g. student-u2023001
                if not app_label or not app_label.startswith("student-"):
                    continue
                
                student_code = app_label.replace("student-", "")
                
                # Determine status logic (simplified version of single-fetch)
                status = "unknown"
                detail = ""
                image = "unknown"
                
                # Get Image (Support multiple)
                images = []
                if pod.spec.containers:
                    images = [c.image for c in pod.spec.containers]
                image = "\n".join(images) if images else "unknown"
                
                phase = pod.status.phase
                
                # Check specifics
                if phase == "Running":
                     # Check readiness
                     if pod.status.container_statuses and all(cs.ready for cs in pod.status.container_statuses):
                         status = "running"
                     else:
                         status = "deploying" # Running but not ready
                elif phase == "Pending":
                    status = "deploying"
                    if pod.status.container_statuses:
                        for cs in pod.status.container_statuses:
                            if cs.state.waiting and cs.state.waiting.reason in ["CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull"]:
                                status = "error"
                                detail = cs.state.waiting.reason
                elif phase in ["Failed", "Unknown"]:
                    status = "error"
                elif phase == "Succeeded":
                    status = "stopped"
                
                # Priority: If we already have an entry, pick the "best" one? 
                # (e.g. if one pod is Terminating and one is Running, pick Running)
                # For simplicity, just overwrite or pick first likely valid.
                
                result_map[student_code] = {
                    "status": status,
                    "detail": detail or phase,
                    "image": image,
                    "namespace": ns
                }
                
        except Exception as e:
            logger.error(f"Error listing pods in {ns}: {e}")
            
    return result_map

def get_status_by_selector(namespace: str, label_selector: str) -> Dict[str, str]:
    """
    通过 Label Selector 获取一组 Pods 的聚合状态
    适用于微服务架构的项目（如 Hydrosim Portal）
    """
    try:
        # List Pods (Not Deployments, to catch all running containers)
        # If label_selector is empty, it lists all in namespace
        pods = core_v1.list_namespaced_pod(
            namespace=namespace,
            label_selector=label_selector
        )
        
        if not pods.items:
             return {"status": "not_deployed", "detail": "No resources found", "ready_replicas": "0/0", "image": "-"}

        aggregated_status = "not_deployed"
        details = []
        all_images = []
        
        running_count = 0
        error_count = 0
        deploying_count = 0
        
        for pod in pods.items:
            # Images
            if pod.spec.containers:
                for c in pod.spec.containers:
                    all_images.append(c.image)
            
            phase = pod.status.phase
            
            if phase == "Running":
                 if pod.status.container_statuses and all(cs.ready for cs in pod.status.container_statuses):
                     running_count += 1
                     aggregated_status = "running" # At least one is running
                 else:
                     deploying_count += 1
                     details.append(f"{pod.metadata.name}: deploying")
            elif phase == "Pending":
                deploying_count += 1
                details.append(f"{pod.metadata.name}: pending")
                # Check for errors in pending
                if pod.status.container_statuses:
                    for cs in pod.status.container_statuses:
                        if cs.state.waiting and cs.state.waiting.reason in ["CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull"]:
                            error_count += 1
                            details.append(f"{pod.metadata.name}: {cs.state.waiting.reason}")
            elif phase in ["Failed", "Unknown"]:
                error_count += 1
                details.append(f"{pod.metadata.name}: {phase}")
        
        # Priority aggregation
        if error_count > 0:
            aggregated_status = "error"
        elif deploying_count > 0 and aggregated_status != "running":
            aggregated_status = "deploying"
        elif running_count > 0:
             aggregated_status = "running" # Even if some are deploying, we report running mostly. 
             # Or should checking "All Ready"?
             # For Portal, if Backend ready but Frontend not, likely partial.
             if deploying_count > 0:
                 details.append("Partial availability")
        
        detail_str = ", ".join(details) if details else "All services ready"
        image_str = "\n".join(list(set(all_images))) # Dedup images
        
        return {
            "status": aggregated_status,
            "detail": detail_str,
            "ready_replicas": f"{running_count}/{len(pods.items)}",
            "image": image_str
        }

    except Exception as e:
        logger.error(f"Error checking selector {label_selector}: {e}")
        return {"status": "error", "detail": str(e), "ready_replicas": "?", "image": "?"}
