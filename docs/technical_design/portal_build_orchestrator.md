# Portal 构建编排重构方案（Kaniko）

本文档定义：将门户升级为“构建机 + 部署编排器”的完整方案，并列出逐步实施指令。  
确认无误后再进入实际改造与编码阶段。

---

## 目标
- 学生 push 代码后，门户自动触发构建
- 构建完成自动部署到 k3s
- 构建日志归档到 MinIO
- 不依赖学生仓库 CI（Actions），由门户统一调度
- 使用 Kaniko 在集群内构建镜像

## 新流程（目标态）
1) 学生 push 代码  
2) Gitea Webhook -> Portal（验签 & 识别学生）  
3) Portal 创建 Build 记录 + 创建 K8s Job（Kaniko）  
4) Job 拉取仓库（Deploy Key）并构建推送镜像  
5) Portal 归档日志 -> MinIO  
6) 构建成功自动触发部署  
7) 前端展示构建/部署状态与日志

---

## 数据模型（新增/调整）
### BuildConfig（新）
- student_id (FK)
- repo_url
- branch
- dockerfile_path
- context_path
- registry_id
- image_repo
- tag_strategy (建议: `short_sha` + 可选 `branch_latest`)
- auto_build (bool)
- auto_deploy (bool)
- created_at / updated_at

### Build（新）
- student_id (FK)
- commit_sha
- branch
- image_tag
- status (pending/running/success/failed)
- message
- log_object_key (MinIO 路径)
- started_at / finished_at / duration
- created_at

### Deployment（已有）
建议新增：
- build_id (FK) 关联构建结果

---

## 后端模块划分
### 1) Webhook 接口
`POST /api/v1/webhooks/gitea`
- 验签：`X-Gitea-Signature` 或自定义密钥
- 解析 repo -> student_id
- 生成 Build 记录
- 入队/创建构建 Job

### 2) Build Orchestrator（服务）
负责：
- 组装 K8s Job（Kaniko）
- 创建 Secret（registry、deploy key）
- 追踪 Job 状态
- 归档日志到 MinIO
- 构建成功后触发部署

### 3) Build API
`GET /api/v1/builds?student_id=...`
`POST /api/v1/builds/trigger`（手动触发）
`GET /api/v1/builds/{id}/logs`
`PUT /api/v1/build-configs/{student_id}`

---

## Kaniko Job 设计（核心）
### 构建步骤
1) initContainer 使用 Deploy Key 拉取仓库
2) kaniko executor 构建并推送镜像

### 关键 Secret
- `portal-git-credentials`：Deploy Key
- `kaniko-registry-auth`：Registry 账户

### Tag 策略（默认）
- `image_repo:<short_sha>`
- 可选：再推送 `image_repo:<branch>-latest`

---

## 前端重构要点
### 学生详情页新增
- 构建配置（repo/branch/dockerfile/context/image repo）
- 构建历史
- 构建日志查看（MinIO 下载/预览）

### 教师/管理员
- 构建队列
- 失败构建列表
- 构建统计（成功率/耗时）

---

## 安全与权限
- 每学生 Deploy Key（只读）
- Webhook 必须验签
- 构建/部署权限：teacher/admin 可全量；student 仅自身

---

## 实施步骤与指令（仅计划，不执行）
> 下面是实施顺序与每一步需要执行的命令或文件改动指令。

### Step 1: 数据库与模型
1) 新增模型：
   - `backend/app/models/build_config.py`
   - `backend/app/models/build.py`
2) 生成迁移：
```bash
alembic revision --autogenerate -m "add build config and build tables"
alembic upgrade head
```

### Step 2: 后端服务层
1) 新增构建服务：
   - `backend/app/services/build_orchestrator.py`
2) 新增 MinIO 日志归档工具：
   - `backend/app/services/build_logs.py`

### Step 3: Webhook + Build API
1) 新增 webhook 入口：
   - `backend/app/api/v1/endpoints/webhooks.py`
2) 新增 build 相关 endpoints：
   - `backend/app/api/v1/endpoints/builds.py`
   - `backend/app/api/v1/endpoints/build_configs.py`
3) 注册路由：
   - `backend/app/api/v1/api.py`

### Step 4: Kaniko Job 模板
1) 新增 Job 模板生成器：
   - `backend/app/core/k8s_build_job.py`
2) 参考配置：
   - `docs/templates/kaniko_build_job.yaml`（供调试用）

### Step 5: 前端页面改造
1) 学生详情页构建模块：
   - `frontend/src/pages/StudentDetailPage.tsx`
2) 新增构建历史组件：
   - `frontend/src/components/BuildHistory.tsx`
3) API 封装：
   - `frontend/src/api/builds.ts`
   - `frontend/src/api/buildConfigs.ts`

### Step 6: 系统设置扩展
1) 新增系统设置项：
   - `build_namespace`
   - `default_registry_id`
   - `default_image_repo_template`
2) 管理页面接入：
   - `frontend/src/pages/SystemSettingsPage.tsx`

### Step 7: 迁移与验证
1) 为现有学生填充默认 BuildConfig（脚本）  
2) 手动触发构建，验证 Job 成功  
3) 构建成功后自动部署  
4) 日志归档到 MinIO  

---

## 验证清单
- Webhook 正确触发 build
- Build 记录落库且状态正确
- Kaniko Job 完整运行
- 镜像推送成功
- Deploy 自动执行
- 构建日志可查看

---

## 注意事项
- 需确保 Portal 具备创建 Job/Secret 的 RBAC 权限
- Deploy Key 只读权限
- 失败日志应保留以便排查

---

## 实施进度（当前完成情况）
> 截止本次同步，已完成与仍待完成的事项如下。

### 变更记录（按提交）
- 无 git 提交记录（当前为工作区变更状态，未创建 commit）

### 已完成
- 后端：新增 Build / BuildConfig 模型与迁移（`2026_01_02_1040-0eddd469af3a_add_build_config_and_build_tables.py`）
- 后端：新增 Build / BuildConfig API（`/api/v1/builds`、`/api/v1/build-configs`）
- 后端：新增构建编排器与 Kaniko Job 生成逻辑（`build_orchestrator.py`、`k8s_build_job.py`）
- 后端：新增构建日志服务（`build_logs.py`），支持 MinIO
- 后端：MinIO 访问策略修复，支持 `MINIO_PUBLIC_ENDPOINT`
- 后端：Build API 序列化错误已修复（`/builds` 500 已消除）
- 前端：Build 配置弹窗与 API 已接入
- 前端：修复 Vite 构建失败（`builds.ts` / `buildConfigs.ts` 导入错误）
- 后端 API 读请求已全量验证通过（`backend/verify_all_apis.py`）

### 已完成内容（文件级清单）
#### 后端
- 模型与迁移
  - `backend/app/models/build.py`
  - `backend/app/models/build_config.py`
  - `backend/alembic/versions/2026_01_02_1040-0eddd469af3a_add_build_config_and_build_tables.py`
  - `backend/alembic/versions/2026_01_02_1805-7f6a3f2b9c1d_add_deploy_keys_and_build_job_name.py`
- Build API
  - `backend/app/api/v1/endpoints/builds.py`
  - `backend/app/api/v1/endpoints/build_configs.py`
  - `backend/app/api/v1/endpoints/webhooks.py`
  - `backend/app/api/v1/endpoints/deploy_controller.py`
- 构建编排
  - `backend/app/services/build_orchestrator.py`
  - `backend/app/core/k8s_build_job.py`
  - `backend/app/services/deploy_service.py`
  - `backend/app/services/deploy_keys.py`
- 日志归档
  - `backend/app/services/build_logs.py`
  - `backend/app/core/config.py`
- 环境与测试
  - `backend/.env`
  - `backend/.env.example`
  - `backend/verify_all_apis.py`

#### 前端
- Build 配置与 Deploy Key
  - `frontend/src/components/BuildConfigModal.tsx`
  - `frontend/src/api/buildConfigs.ts`
- Build 历史与日志
  - `frontend/src/components/BuildHistory.tsx`
  - `frontend/src/api/builds.ts`
- Deploy API
  - `frontend/src/api/deployments.ts`

### 测试结果（当前）
> 已在本机通过读接口验证脚本；写入类测试未执行。

- 脚本：`backend/verify_all_apis.py`
- 运行方式：
```bash
backend/.venv/Scripts/python.exe backend/verify_all_apis.py
```
- 结果摘要（读接口）：全通过  
  - 关键接口：`/health`、`/auth/login/`、`/students/`、`/admin/projects/`、`/deploy/resources/list`、`/builds/`、`/build-configs/{id}`
- 写入类测试（可选）：`POST /api/v1/build-configs/{id}/deploy-key`（`ALLOW_WRITE_TESTS=true`）

### 验收清单（给其他 AI 的交付标准）
> 按以下标准逐项通过即可视为阶段验收完成。

1) **后端基础可用**
   - 运行 `backend/verify_all_apis.py`，所有读接口为 `OK`
2) **Build API 正常返回**
   - `GET /api/v1/builds/` 返回 200 且可序列化
   - `GET /api/v1/build-configs/{student_id}` 返回 200
3) **前端可启动**
   - `npm run dev` 后访问 `http://localhost:8080` 正常进入登录页
4) **构建配置界面可打开**
   - 学生/管理员详情页打开 Build 配置弹窗，无报错
5) **后端配置一致**
   - 本地运行时 `MINIO_PUBLIC_ENDPOINT` 可解析
   - `K8S_CONFIG_PATH` 指向本地可用 kubeconfig

### 待完成
- 运行迁移并确认 deploy_key/job_name 字段落库
- k3s 环境全链路回归（Webhook -> Build -> Deploy -> 日志）

### 待完成验收清单（按功能点）
1) **迁移落库**
   - 执行 `alembic upgrade head`
   - `build_configs`/`builds` 新字段可查询
2) **生产配置就绪**
   - Gitea Webhook Secret 已配置
   - Deploy Key 已绑定到学生仓库（只读）
   - Registry/MinIO 在集群内可访问
3) **全链路回归**
   - push -> webhook -> build -> image -> deploy -> logs 全流程闭环
   - 回归完成后无高优先级错误日志
