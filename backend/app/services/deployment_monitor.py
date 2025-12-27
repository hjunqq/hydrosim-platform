from kubernetes import client, config
from kubernetes.client.rest import ApiException
import logging
from typing import Dict, Optional

logger = logging.getLogger("deployment-monitor")

# 复用之前的配置，建议集中管理
NAMESPACE_MAP = {
    "gd": "students-gd",
    "cd": "students-cd"
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
            return {
                "status": "running", 
                "detail": "All replicas ready", 
                "ready_replicas": f"{ready_replicas}/{replicas}"
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
