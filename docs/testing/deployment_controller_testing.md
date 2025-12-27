# 部署控制器测试指南

本文档介绍如何验证和测试“部署控制器”相关功能。测试分为三个层次：Python 单元测试（Mock）、本地集成测试（Dry Run）和 集群端到端测试。

## 1. 单元测试 (Mock 模式)

无需真实的 Kubernetes 集群，仅验证 Python 代码逻辑（如参数解析、Resource Builder 生成是否正确）。

### 测试脚本: `tests/test_deploy_logic.py`

创建一个测试脚本来验证 `StudentProjectBuilder` 是否生成的对象符合预期。

```python
import sys
import os
# 添加 backend 路径以便导入 app 模块
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.k8s_resources import StudentProjectBuilder
from kubernetes import client

def test_resource_generation():
    print(">>> 测试 Kubernetes 资源生成逻辑...")
    
    # 1. 模拟输入
    builder = StudentProjectBuilder(
        student_code="s2025_test",
        image="registry.internal/s2025_test:v1",
        namespace="students-gd",
        domain_suffix="test.hydrosim.cn"
    )

    # 2. 生成对象
    deploy = builder.build_deployment()
    svc = builder.build_service()
    ingress = builder.build_ingress()

    # 3. 断言验证
    # 验证命名规范
    assert deploy.metadata.name == "student-s2025_test"
    assert deploy.metadata.namespace == "students-gd"
    
    # 验证资源限制
    container = deploy.spec.template.spec.containers[0]
    assert container.resources.limits["cpu"] == "500m"
    assert container.resources.limits["memory"] == "512Mi"
    
    # 验证 Probes 是否注入
    assert container.readiness_probe is not None
    assert container.liveness_probe is not None
    
    # 验证 Ingress 域名
    expected_host = "s2025_test.test.hydrosim.cn"
    assert ingress.spec.rules[0].host == expected_host
    
    print("✅ 资源生成逻辑测试通过！")

if __name__ == "__main__":
    test_resource_generation()
```

运行命令:
```powershell
python tests/test_deploy_logic.py
```

## 2. 本地 API 接口测试 (Mock K8s Client)

验证 FastAPI 接口是否能正确接收请求并调用 Resource Builder，同时处理 K8s 异常。由于我们还没有 K8s 环境，我们需要 Mock `kubernetes.client`。

您可以编写一个临时脚本 `tests/manual_api_trigger.py`，使用 `unittest.mock` 模拟 K8s API 的响应。

## 3. 真实集群测试 (End-to-End)

如果您有可用的 K8s 集群（如 Docker Desktop K8s, Minikube 或 k3s），可以进行真实测试。

### 前置条件
1.  确保本地 `~/.kube/config` 有效，或者后端运行在 Pod 内。
2.  确保已创建目标 Namespace:
    ```bash
    kubectl create namespace students-gd
    kubectl create namespace students-cd
    ```
3.  确保 RBAC 权限已配置 (如果是 In-Cluster 运行)。如果您在本地运行 FastAPI (`uvicorn`)，它会使用您的个人 kubeconfig，通常拥有管理员权限，可以直接测试。

### 测试步骤

1.  **启动 FastAPI 后端**:
    ```powershell
    cd backend
    # 确保依赖已安装: pip install kubernetes
    uvicorn app.main:app --reload
    ```
    *(注：需确保 `app.main` 中已 include `deploy_controller.router`)*

2.  **发送触发请求**:
    使用 curl 或 Postman:

    ```bash
    curl -X POST "http://127.0.0.1:8000/api/v1/deploy/s2025_001" \
         -H "Content-Type: application/json" \
         -d '{
               "image": "nginx:alpine", 
               "project_type": "gd"
             }'
    ```
    *注：这里使用 `nginx:alpine` 作为测试镜像，因为它公开可拉取且轻量。*

3.  **验证结果** (在终端中):
    ```bash
    # 查看 Deployment
    kubectl get deployment -n students-gd
    
    # 查看 Pods (状态应为 Running)
    kubectl get pods -n students-gd
    
    # 查看 Ingress
    kubectl get ingress -n students-gd
    ```

4.  **验证回滚逻辑**:
    修改请求中的 image 为一个不存在的镜像 (例如 `nginx:invalid-tag`) 并再次发送请求。
    
    *预期结果*:
    *   API 返回 "updated"。
    *   `kubectl get pods -n students-gd` 显示新 Pod 为 `ImagePullBackOff`。
    *   旧 Pod 依然 `Running` (因为 `maxUnavailable=0`)。
    *   服务未中断。

## 4. 常用调试命令

如果测试失败，请使用以下命令排查：

*   **查看 API 日志**: 查看 FastAPI 控制台输出。
*   **查看 Pod 详情**: `kubectl describe pod <pod-name> -n students-gd` (查看为何 Pending 或 Crashing)。
*   **查看 Deployment 事件**: `kubectl describe deploy student-s2025_001 -n students-gd`.
