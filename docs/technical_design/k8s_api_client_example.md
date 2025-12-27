# FastAPI Kubernetes API Access Guide

本文档说明如何在 FastAPI 中使用官方 Python 客户端，通过 In-Cluster 配置安全访问 Kubernetes API。

## 1. Python 依赖

在 `requirements.txt` 或 `pyproject.toml` 中添加：

```text
kubernetes>=28.1.0
```

*注意：版本号建议与集群版本大致匹配，但 K8s API 通常向后兼容。*

## 2. 初始化 Kubernetes Client

推荐创建一个单独的依赖或单例模块 `backend/app/core/k8s_client.py` 来管理连接。

```python
# backend/app/core/k8s_client.py
import logging
from kubernetes import config, client
from kubernetes.config.config_exception import ConfigException

logger = logging.getLogger(__name__)

def get_k8s_apps_api() -> client.AppsV1Api:
    """
    获取 AppsV1Api 实例 (用于管理 Deployments)
    自动处理 In-Cluster 和 Local 配置切换
    """
    try:
        # 优先尝试加载集群内配置 (In-Cluster Config)
        # 这会自动读取 /var/run/secrets/kubernetes.io/serviceaccount 下的 token 和 ca.crt
        config.load_incluster_config()
        logger.info("Loaded in-cluster Kubernetes configuration.")
    except ConfigException:
        # 如果失败 (例如在本地开发)，回退到 kubeconfig
        try:
            config.load_kube_config()
            logger.warning("Loaded local kubeconfig. THIS SHOULD NOT HAPPEN IN PRODUCTION.")
        except Exception as e:
            logger.error(f"Failed to load Kubernetes config: {e}")
            raise

    return client.AppsV1Api()

def get_k8s_core_api() -> client.CoreV1Api:
    """
    获取 CoreV1Api 实例 (用于管理 Services, Pods)
    """
    # 配置加载逻辑同上 (kubernetes 库是全局单例配置，load 一次即可，但安全起见可重复调用)
    try:
        config.load_incluster_config()
    except ConfigException:
        config.load_kube_config()
        
    return client.CoreV1Api()
```

## 3. 最小示例：读取 Namespace 下的 Deployment 列表

这是一个可以在 FastAPI 路由中直接调用的示例。

```python
# backend/app/routers/debug_k8s.py
from fastapi import APIRouter, HTTPException, Depends
from kubernetes import client
from kubernetes.client.rest import ApiException
from app.core.k8s_client import get_k8s_apps_api

router = APIRouter()

@router.get("/deployments/{namespace}")
def list_deployments(namespace: str, k8s_apps: client.AppsV1Api = Depends(get_k8s_apps_api)):
    """
    列出指定命名空间下的所有 Deployment 名称
    """
    try:
        # 调用 Kubernetes API
        # list_namespaced_deployment 文档: https://github.com/kubernetes-client/python/blob/master/kubernetes/docs/AppsV1Api.md#list_namespaced_deployment
        response = k8s_apps.list_namespaced_deployment(namespace=namespace)
        
        deployment_names = [dep.metadata.name for dep in response.items]
        
        return {
            "namespace": namespace,
            "count": len(deployment_names),
            "deployments": deployment_names
        }
        
    except ApiException as e:
        # 捕获 K8s API 异常 (如 403 Forbidden, 404 Not Found)
        if e.status == 403:
             raise HTTPException(status_code=403, detail="Permission denied: SA cannot list deployments in this namespace.")
        raise HTTPException(status_code=e.status, detail=f"Kubernetes API Error: {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## 关键点说明

*   **`config.load_incluster_config()`**: 这是核心。它告诉 SDK 去查找 Pod 内部特定路径的文件：
    *   Token: `/var/run/secrets/kubernetes.io/serviceaccount/token`
    *   CA Cert: `/var/run/secrets/kubernetes.io/serviceaccount/ca.crt`
    *   Namespace: `/var/run/secrets/kubernetes.io/serviceaccount/namespace`
*   **依赖注入**: 在 FastAPI 中使用 `Depends` 注入 API 客户端是一个好习惯，便于测试 mocking。
*   **异常处理**: 必须捕获 `ApiException`，因为权限不足（RBAC 限制）或资源不存在是常见情况。
