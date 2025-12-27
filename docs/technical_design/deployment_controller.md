# Deployment Controller (FastAPI + K8s) 技术方案

本文档详细描述如同在 Kubernetes (k3s) 集群内部署和运行 FastAPI 门户后端，并将其作为“Deployment Controller”来管理学生项目的技术实现方案。

## 1. FastAPI 在 Kubernetes 集群中的运行方式

为了使 FastAPI 能够管理集群资源，后端服务本身将作为 Pod 运行在集群的管理命名空间（例如 `hydrosim-system`）中。

*   **运行模式**: In-Cluster
*   **通信方式**: 使用官方 Python 客户端 (`kubernetes` 库)，通过 Pod 内部挂载的 ServiceAccount Token 直接与 Kubernetes API Server 通信。
*   **配置加载**: 代码中自动检测运行环境：
    ```python
    from kubernetes import config, client
    
    try:
        config.load_incluster_config() # 在 Pod 内部时使用
    except config.ConfigException:
        config.load_kube_config()      # 在本地开发时使用 (需通过 VPN 或 kubeconfig 连接)
    ```

## 2. ServiceAccount + RBAC 权限控制总体思路

我们遵循“最小权限原则”，后端服务不应拥有集群管理员权限 (ClusterAdmin)，而仅拥有管理学生项目所需的特定权限。

### 架构设计
1.  **管理命名空间 (`hydrosim-system`)**: 部署 FastAPI 后端、PostgreSQL 等平台组件。
2.  **学生工作负载命名空间 (`hydrosim-students`)**: 所有学生部署的项目都将集中在此命名空间，或为每个项目/班级创建独立的命名空间。**建议方案：单一专用命名空间 `hydrosim-students` 以简化管理**，利用 Resource Names (e.g., `student-<id>`) 进行隔离。

### RBAC 配置清单
*   **ServiceAccount**: `portal-backend-sa` (创建在 `hydrosim-system`)
*   **Role (定位于 `hydrosim-students` 命名空间)**: `student-project-manager`
    *   *Rules*:
        *   `apiGroups`: `["apps"]`, `resources`: `["deployments"]`, `verbs`: `["get", "list", "create", "update", "patch", "delete"]`
        *   `apiGroups`: `[""]`, `resources`: `["services", "pods", "pods/log"]`, `verbs`: `["get", "list", "create", "update", "delete"]`
        *   `apiGroups`: `["networking.k8s.io"]`, `resources`: `["ingresses"]`, `verbs`: `["get", "list", "create", "update", "delete"]`
*   **RoleBinding**: 将 `portal-backend-sa` 绑定到 `student-project-manager` Role。

**注意**: 此配置确保 FastAPI **只能** 操作 `hydrosim-students` 命名空间内的资源，无法影响系统组件或其他敏感区域。

## 3. 门户后端允许执行的操作清单

FastAPI 后端将封装复杂的 K8s API 调用，仅暴露高层业务逻辑。

### Deployment 操作
*   **Create**:
    *   强制注入 Resource Limits (CPU: 0.5, Mem: 512Mi)。
    *   强制设置 `replicas: 1` (学生项目通常无需扩容)。
    *   注入统一的环境变量 (e.g., `DB_HOST`, `REDIS_HOST`)。
    *   使用学生构建的 Docker Image。
*   **Update**:
    *   更新 Image Tag (重新部署)。
    *   更新环境变量。
    *   **Restart**: 执行 `kubectl rollout restart` 等效操作 (修改 Annotation)。
*   **Delete**: 清理资源。

### Service 操作
*   **Create/Update**: 创建 ClusterIP Service，映射容器端口 (如 8000) 到 Service 端口 (80)。

### Ingress 操作
*   **Create/Update**: 配置基于域名的路由规则。
    *   规则: `student-<project_id>.project.hydrosim.edu` -> `Service: student-<project_id>`。
    *   自动配置 TLS (如果集成 Cert-Manager)。

## 4. 教师点击“部署”时的完整流程

当教师在 Web 门户点击某学生项目的“部署”按钮时，系统内部流程如下：

1.  **HTTP Request**: 前端发送 `POST /api/projects/{id}/deploy` 请求，携带认证 Token。
2.  **Auth & Validation**:
    *   FastAPI 验证教师权限。
    *   查询数据库获取项目元数据 (Image 地址, 环境变量, 学生 ID)。
    *   检查该学生项目是否已有限额/运行中实例。
3.  **Resource Rendering (内存中)**:
    *   后端使用 Pydantic 模型或 Jinja2 模板生成 K8s 资源对象 (Deployment, Service, Ingress)。
    *   *关键点*: 在此步骤强制应用所有安全约束 (资源限制、命名规范)，**不接受**前端传入的任何原始 YAML。
4.  **K8s API Call**:
    *   **Check**: 查询 `hydrosim-students` 命名空间下是否存在名为 `prj-{id}` 的 Deployment。
    *   **Apply**:
        *   如果不存在 -> 调用 `create_namespaced_deployment(...)`。
        *   如果存在 -> 调用 `patch_namespaced_deployment(...)` 更新镜像版本。
    *   **Networking**: 同步检查并创建/更新 Service 和 Ingress。
5.  **State Sync**:
    *   将数据库中项目状态更新为 `DEPLOYING`。
    *   (可选) 启动后台任务轮询 Pod 状态，直到 `Running`，然后更新数据库为 `RUNNING`。
6.  **Response**: 返回 202 Accepted，通知前端部署已触发。

## 5. 为什么这种方式比直接 Kubectl 更安全？

| 维度 | 直接分发 Kubectl / Kubeconfig | FastAPI 部署控制器模式 (当前方案) |
| :--- | :--- | :--- |
| **凭证管理** | 需向每个用户分发证书，难以撤销，存在泄露风险。 | **无凭证分发**。仅后端 Pod 拥有 ServiceAccount，由 K8s 自动轮转管理。 |
| **权限粒度** | K8s RBAC 很难精确限制到“只能修改 Image 字段”或“必须加内存限制”。用户可能拥有过大的 Namespace 编辑权。 | **逻辑级限制**。FastAPI 代码决定了用户能做什么。用户甚至不知道 K8s 的存在，只能操作“部署”按钮。 |
| **资源隔离** | 学生/教师可能误操作删除他人资源，或占用过多计算资源。 | 后端强制执行配额、命名规范和隔离策略。 |
| **访问入口** | 需要暴露 K8s API Server 到公网或受信任网络，攻击面大。 | K8s API Server 仅对集群内(或 VPN 内)开放。外界仅能访问 FastAPI 的 HTTP 接口。 |
| **审计** | 仅能依赖 K8s Audit Logs，难以关联到具体业务操作。 | FastAPI 可记录业务级日志 (e.g., "Teacher A deployed Student B's project")。 |

---
**总结**: 此方案将 Kubernetes 视为底层的“无服务器”运行时，FastAPI 作为唯一的控制平面网关，在保证灵活性的同时，最大程度地屏蔽了底层复杂性和安全风险。
