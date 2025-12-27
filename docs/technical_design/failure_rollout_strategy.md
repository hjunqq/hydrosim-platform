# 最小可行失败与回滚策略 (Minimum Viable Failure & Rollback)

本方案旨在不引入 Argo Rollouts 等复杂组件的前提下，利用 Kubernetes 原生特性，确保学生项目在部署失败时不会影响现有服务，并支持快速回滚。

## 场景分析

### 1. 镜像拉取失败 (ImagePullBackOff)
*   **现象**: 新 Pod 状态一直为 `Pending` 或 `Waiting (ImagePullBackOff)`。
*   **原生防御**: 依靠 Deployment 的 `RollingUpdate` 策略 + `maxUnavailable=0`。
*   **结果**: 旧 Pod 保持 Running，新 Pod 卡住。服务未中断。

### 2. Pod 启动失败 (CrashLoopBackOff / Config Error)
*   **现象**: 新 Pod 启动后立即退出，或不断重启。
*   **原生防御**: 依靠 `Readiness Probe` (就绪探针)。
*   **结果**: 新 Pod 永远无法达到 `Ready` 状态。K8s 不会将 Service 流量切换到新 Pod。旧 Pod 保持服务。

### 3. 新版本部署异常 (Buggy Code but Starts)
*   **现象**: Pod 启动且端口正常，但业务逻辑有 Bug。
*   **防御**: 这属于应用层问题，需要人工发现。
*   **补救**: 教师/管理员点击“回滚”按钮。

---

## 策略实现方案

### 1. 核心防御：强化 Deployment 配置

在 `StudentProjectBuilder` 中，必须强制注入以下配置：

#### A. 零停机滚动更新策略
确保在新版本完全就绪前，不杀死旧版本。对于单副本应用：

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 允许创建一个新 Pod (Total = 2)
      maxUnavailable: 0  # 严禁删除旧 Pod，直到新 Pod Ready
```

#### B. 严格的就绪探针 (Readiness Probe)
只有通过探针，Kubernetes 才会认为新版本“成功”，并开始 Terminate 旧版本。

```yaml
readinessProbe:
  tcpSocket:
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3 # 连续失败3次则认为未就绪
```

### 2. 主动回滚：Python API 实现

当发生异常（如卡在部署中）或业务代码 Bug 时，提供一键回滚。

**原理**: 利用 Kubernetes Deployment 的 `Undo` 机制 (Rollout Undo)。

**代码实现逻辑**:
Kubernetes Python Client 没有直接的 `rollout undo` 命令封装，需要通过 Patch Deployment 的 `revision` 或使用 `deployment_controller` 的 rollback 接口（但在 Python 客户端中通常通过 `patch_namespaced_deployment` 将 PodTemplate revert 到之前的状态，或者利用 `apps_v1.patch_namespaced_deployment` 修改 image tag 能够达到类似效果，但真正的 `kubectl rollout undo` 是回退 `deployment.kubernetes.io/revision`）。

**工程化简化方案**:
由于我们是简单的 CI/CD 控制器，最可靠的回滚方式是 **“重新部署上一个成功的镜像版本”**。
平台数据库记录了该项目的历史部署版本 (Deploy History)。回滚 = 使用 Version N-1 的 Image 再次触发 API 发布的 Update 操作。

**方案对比**:
*   *K8s Native Undo*: API 复杂，难以精准控制回滚到哪个 hash。
*   *App Logic Redploy*: 简单，明确。教师点击历史记录中的“V1 (Good)” -> 点击“Redeploy”。

### 3. (可选) 自动监测与超时中止

防止 Deployment 无限期处于 "Progressing" 状态。

*   **配置**: `spec.progressDeadlineSeconds: 600` (10分钟)
*   **逻辑**: 后台 Monitor 检测到 Deployment Condition `Progressing` 为 `False` (超时) -> 自动标记为 Failed -> (可选) 自动触发回滚。

---

## 结论

1.  **Prevent (防御)**: 修改 `k8s_resources.py`，**必须**添加 `maxUnavailable=0` 和 `executionProbe`。这是最重要的屏障。
2.  **Fix (修复)**: 不做复杂的 Kubectl Rollout Undo 魔法。前端展示“部署历史”，回滚 = 重新部署旧镜像。
