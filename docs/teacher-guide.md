# 教师使用手册 (Teacher Guide)

欢迎使用智慧水利毕业设计部署平台。本手册将指导您完成从学生管理到应用部署的全流程操作。

## 1. 快速入门

### 环境准备
确保您已登录教师管理门户（默认为 `http://localhost:8080` 或您的部署地址）。

### 核心流程
1.  **创建项目**: 录入学生信息和 Git 仓库地址。
2.  **代码开发**: 学生将代码推送到 Git 仓库，触发 CI/CD 构建镜像。
3.  **应用部署**: 在平台上一键部署应用到 Kubernetes 集群，或由学生仓库自动触发部署。
4.  **状态监控**: 实时查看应用运行状态和访问域名。

---

## 2. 学生项目管理

### 批量导入学生
如果您有大量学生名单，可以使用脚本或 CSV 导入功能（需管理员操作后台脚本）：
```bash
# 示例：使用后端脚本批量导入
./scripts/student/batch-create.sh students.csv
```
_注：Web 界面的批量导入功能正在开发中。_

### 手动创建学生
1.  进入 **"学生项目列表"** 页面。
2.  点击右上角 **"+ 新建项目"**。
3.  填写以下信息：
    *   **学号**: 学生的唯一标识 (如 `s2025001`)。
    *   **姓名**: 学生姓名。
    *   **项目类型**:
        *   `毕业设计 (gd)`: 资源配额较高，部署在 `students-gd` 命名空间。
        *   `课程设计 (cd)`: 资源配额较低，部署在 `students-cd` 命名空间。
    *   **Git 仓库地址**: 学生的代码仓库 URL (用于关联 CI/CD)。

---

## 3. 应用部署 (Deployment)

当学生完成代码开发并构建好 Docker 镜像后，您可以协助或允许其部署应用。

### 部署步骤
1.  在 **"学生项目列表"** 中找到对应学生。
2.  点击 **"立即部署"** (或 "重新部署")。
3.  **填写部署配置**:
    *   **Docker 镜像 (Image)**: 输入学生构建好的镜像地址。
        *   *格式示例*: `registry.example.com/project/s2025001:v1`
        *   *注意*: 请勿使用默认的测试镜像，需确保镜像已推送至仓库且集群可拉取。
    *   **项目类型**: 系统自动锁定，无需修改。
4.  点击 **"开始部署"**。

### 部署后验证
系统会自动在后台执行以下操作：
1.  **创建 Namespace**: 确保对应的 `students-gd` 或 `students-cd` 命名空间存在。
2.  **应用资源**: 创建 Kubernetes Deployment 和 Service。
3.  **配置路由 (Ingress)**: 自动生成访问域名 (如 `stu-s2025001.gd.hydrosim.cn`)。

### 学生仓库自动部署（推荐）
当学生仓库完成镜像构建并推送到 Registry 后，可自动调用门户部署接口触发部署。

**流程概览**
1. 学生 push 代码 → CI 构建镜像并推送
2. CI 调用门户部署接口
3. 门户创建/更新 Deployment、Service、Ingress

**接口示例**
```bash
curl -X POST "https://portal.example.com/api/v1/deploy/s2025001" \
  -H "Content-Type: application/json" \
  -H "X-Deploy-Token: <YOUR_TOKEN>" \
  -d '{"image":"registry.example.com/gd/s2025001:abcd1234","project_type":"gd"}'
```

**Token 校验（防止误触发）**
- 后端支持 `DEPLOY_TRIGGER_TOKEN` 环境变量。
- 当该变量存在时，所有未登录的部署请求必须携带 `X-Deploy-Token`，否则会被拒绝。

自动部署的完整示例流程请参考：`docs/technical_design/student_auto_deploy.md`

---

## 4. 系统结构与数据持久化

### 4.1 系统结构概览
平台核心由以下部分组成：
1.  **门户前端/后端**：教师管理门户（Hydrosim Portal）。
2.  **数据库**：门户数据库 + 学生项目数据库。
3.  **K3s 集群**：部署学生项目与数据库的运行环境。
4.  **对象存储**：MinIO 作为备份与归档存储。
5.  **Ingress**：对外暴露访问域名。

### 4.2 多租户隔离模型
- **Namespace**：每个学生项目独立命名空间，例如 `student-<id>`。
- **资源限制**：通过 `ResourceQuota + LimitRange` 限制 CPU/内存/存储。
- **网络隔离**：`NetworkPolicy` 默认拒绝跨命名空间访问，仅允许同命名空间内互通。
- **RBAC**：门户服务账号拥有学生命名空间内的 CRUD 权限。

### 4.3 数据库持久化策略（默认 PostgreSQL）
- **门户数据库**：StatefulSet + PVC，默认容量 **500Mi**。
- **学生数据库**：每个学生项目单独一套 StatefulSet + PVC，默认容量 **500Mi**。
- **存储类**：`local-path-retain`（本地持久化，PVC 删除后数据保留）。
- **说明**：当前为单节点集群，节点宕机时服务不可用，但数据保留。

### 4.4 学生侧应用配置规范
学生应用只需选择数据库驱动并读取环境变量：
```env
DB_DRIVER=postgres
DB_HOST=postgres
DB_PORT=5432
DB_NAME=student_<id>
DB_USER=<username>
DB_PASS=<password>
```
- 应用端口统一从 `PORT` 环境变量读取。

### 4.5 备份策略（7/30）
- **每日备份**：保留 7 天。
- **每周备份**：保留 30 天。
- 备份目标：MinIO（集群内访问）。
- MinIO 环境变量配置：
```env
# MinIO 配置（集群内访问）
MINIO_ENDPOINT=minio.infra.svc.cluster.local:9000
MINIO_ACCESS_KEY=gNPmESQSdg6gILXcrsrO
MINIO_SECRET_KEY=fF1dqgHhTehAkDqDE1MRQLK2XbLQJCCLuGeyMi4v
MINIO_BUCKET=hydrosim-platform
MINIO_SECURE=false
```

### 4.6 运维与支持
- 门户内提示常见故障：`ImagePullBackOff` / `CrashLoopBackOff` / 数据库连接失败。
- 自动显示命名空间资源使用情况。
- 预留高级功能入口（后续）：一键备份 / 重建数据库 / 迁移数据。

---

## 5. 监控与运维

### 查看部署状态
在列表页，您可以直观地看到每个项目的状态：
*   🟢 **运行中 (Running)**: 应用正常运行，域名可访问。
*   🟡 **待部署 (Pending)**: 尚未创建部署。
*   🔴 **异常 (Failed)**: 部署失败或 Pod 无法启动 (如镜像拉取失败)。

### 集群资源视图 (高级)
点击左侧菜单的 **"部署记录"** (Cluster Resources)，您可以查看 Kubernetes 集群中所有实际运行的 Pod 和 Deployment。这不仅限于数据库中记录的项目，而是对集群状态的真实反映。

### CI/CD 流水线 (Workflows)
系统集成了 Gitea Actions。未来在学生详情页，您可以查看代码推送后触发的自动构建日志，帮助学生排查编译或构建错误。

---

## 6. 常见问题 (FAQ)

**Q: 部署显示 "ImagePullBackOff" 错误？**
A: 通常是因为镜像地址错误，或者集群没有权限拉取该私有仓库的镜像。请检查 Image 字段是否正确。

**Q: 域名无法访问 (404 Not Found)？**
A: 
1. 检查 Ingress Controller 是否正常工作。
2. 确保本地 hosts 或 DNS 已解析该域名到集群 Ingress IP。

**Q: 如何更新应用？**
A: 学生推送新代码并构建新镜像 tag 后，点击 "重新部署" 并填入新的 Image Tag 即可触发滚动更新。
