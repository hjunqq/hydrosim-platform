# Portal Deployment Controller RBAC Configuration

本文档提供了实现“门户部署控制器”所需的完整 Kubernetes RBAC 配置 YAML。

## 场景假设

*   **FastAPI 所在位置**: Namespace `platform`
*   **学生项目目标位置**: Namespace `students-gd` (及 `students-cd`)
*   **ServiceAccount 名称**: `portal-controller-sa`

## 1. ServiceAccount YAML

此资源定义在 `platform` 命名空间中，供 FastAPI Pod 使用。

```yaml
# 1_service_account.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: portal-controller-sa
  namespace: platform
  labels:
    app: hydrosim-portal
    component: deployment-controller
```

## 2. Role YAML (students-gd)

此资源定义在目标命名空间 `students-gd` 中。它精确限制了在该命名空间内可执行的操作。注意：即使拥有此 Role，FastAPI 也无法删除 Deployment，只能 patch/update（根据您的“不允许删除 namespace”要求推断，通常部署更新需要 patch/update，如果确需 create 权限已包含；若需禁止 delete deployment 可从 verbs 去除，下方配置包含基本的 CRUD 但未包含 namespace 级别的删除）。

*修正：根据需求“不允许删除 namespace”，Role 本身是 Namespaced 资源，无法授权删除 Namespace (这是一项 Cluster 级别的操作)，所以天然安全。下方配置按需授予了对 Workload 的权限。*

```yaml
# 2_role_students_gd.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: student-project-manager
  namespace: students-gd
rules:
  # Deployments: 允许增改查，不允许(或按需允许)删除
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["create", "get", "list", "update", "patch"]
  
  # Services: 允许创建和查看
  - apiGroups: [""]
    resources: ["services"]
    verbs: ["create", "get", "list"] # 通常 Update 用于修改 Service 属性，建议加上 patch/update
  
  # Ingresses: 允许创建和查看
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["create", "get", "list"] # 同样建议加上 patch/update 以支持更新路由
```

## 3. RoleBinding YAML

此资源将 `platform` 命名空间中的 ServiceAccount 绑定到 `students-gd` 命名空间中的 Role。这是跨命名空间授权的关键。

```yaml
# 3_role_binding_students_gd.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: bind-portal-sa-to-students
  namespace: students-gd
subjects:
  - kind: ServiceAccount
    name: portal-controller-sa
    namespace: platform # 关键：指定 SA 所在的源命名空间
roleRef:
  kind: Role
  name: student-project-manager # 引用同命名空间下的 Role
  apiGroup: rbac.authorization.k8s.io
```

## 4. 如何复用 (students-cd)

对于 `students-cd` 课程设计命名空间，您**不需要**修改 ServiceAccount。只需在 `students-cd` 中重复创建 Role 和 RoleBinding 即可。

**步骤：**

1.  **创建 Namespace**:
    ```bash
    kubectl create namespace students-cd
    ```

2.  **应用 Role**:
    修改 `2_role_students_gd.yaml` 中的 `namespace: students-gd` 为 `namespace: students-cd`，然后 apply。
    *(内容完全一致，只是作用域变了)*

3.  **应用 RoleBinding**:
    修改 `3_role_binding_students_gd.yaml` 中的 `namespace: students-gd` 为 `namespace: students-cd`，然后 apply。
    *(Subjects 中的 namespace 必须保持为 `platform`，因为 SA 还在那里)*

通过这种方式，同一个 `platform/portal-controller-sa` 就拥有了同时操作两个目标命名空间的权限，但互不干扰，且无法触碰集群其他部分。
