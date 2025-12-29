# k3s 部署与管理流程（Step by Step）

本文档记录在 k3s 平台部署 Hydrosim 平台的完整流程，避免示例丢失。

前提
- 已安装 k3s，kubectl 已指向目标集群
- Ingress Controller 已安装（k3s 默认 Traefik）
- 有可用镜像仓库（或内网 registry），并能被 k3s 拉取
- DNS 已配置（建议 *.gd.hydrosim.cn、*.cd.hydrosim.cn 指向 Ingress）
- MinIO / Gitea 已由你搭建完成

本方案说明
- 平台使用独立的 Postgres 实例（新建数据库，不与 Gitea 共用）
- 平台通过 Gitea API，不直接读写 Gitea 数据库
- 学生项目数据与平台分离，平台仅存元数据（teachers/students/deployments）

Step 1: 创建命名空间
```
kubectl create namespace hydrosim
kubectl create namespace students-gd
kubectl create namespace students-cd
```

Step 2: 配置 RBAC（让后端能管理学生部署）
- 参考 `docs/technical_design/rbac_configuration.md`
- 仓库已提供模板：`deploy/base/rbac.yaml`，默认后端命名空间为 `hydrosim`
- RBAC 已包含 students-gd / students-cd 的 Role 与 RoleBinding

示例执行方式：
```
kubectl apply -f deploy/base/students-namespaces.yaml
kubectl apply -f deploy/base/rbac.yaml
```

Step 3: 部署独立 Postgres 实例（平台专用）
仓库已提供基础清单：`deploy/infra/postgres.yaml`
```
kubectl apply -f deploy/infra/postgres.yaml
```
如果你已有其他 Postgres 实例，请跳过此步，并在 Step 4 中填你的连接信息。

Step 4: 配置后端连接到 Postgres/MinIO/Gitea
你需要修改以下文件（只改值）：
- `deploy/backend/secret.yaml`
  - `DATABASE_URL` 指向平台独立 Postgres
  - `JWT_SECRET_KEY` 自己设
  - `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` 使用你的 MinIO 凭据
  - `GITEA_TOKEN` 使用你的 Gitea token
- `deploy/backend/configmap.yaml`
  - `GITEA_URL` 指向你的 Gitea 地址
  - `MINIO_ENDPOINT` 指向你的 MinIO 地址

推荐的 `DATABASE_URL`：
```
postgresql://hydrosim_portal:change-me@portal-postgres:5432/hydrosim_portal
```

Step 5: 构建并推送镜像（不使用 docker-compose）
```
export REGISTRY=registry.yourdomain.com

nerdctl build -t $REGISTRY/hydrosim-portal-backend:1.0 ./backend
nerdctl build -t $REGISTRY/hydrosim-portal-frontend:1.0 ./frontend

nerdctl push $REGISTRY/hydrosim-portal-backend:1.0
nerdctl push $REGISTRY/hydrosim-portal-frontend:1.0
```

Step 6: 准备并应用 k8s 清单（后端/前端/Ingress）
说明：仓库内已提供清单，但需要你替换镜像地址与密钥。

后端 Deployment 要点：
- `serviceAccountName` 指向 Step 2 创建的 ServiceAccount
- 环境变量至少包含：`DATABASE_URL`、`JWT_SECRET_KEY`、`K8S_IN_CLUSTER=true`
 - 需更新 `deploy/backend/deployment.yaml` 的 `image` 为你的镜像
 - 需更新 `deploy/frontend/deployment.yaml` 的 `image` 为你的镜像
 - 需根据实际密码修改 `deploy/backend/secret.yaml` 与 `deploy/infra/postgres.yaml`

应用清单：
```
kubectl apply -f deploy/backend/
kubectl apply -f deploy/frontend/
kubectl apply -f deploy/ingress/
```

Step 7: 初始化数据库与创建默认教师
```
kubectl -n hydrosim exec deploy/portal-backend -- alembic upgrade head
kubectl -n hydrosim exec deploy/portal-backend -- python seed_teacher.py
# 默认账号：teacher / teacher123
```

Step 8: 在平台创建学生项目
- 登录前端：`http://<your-domain>`
- 进入“学生项目列表” → “+ 新建项目”
- 填学号、姓名、项目类型

Step 9: 触发部署
推荐走 API（学生列表页接口不一致时）：
```
# 登录获取 token
curl -s -X POST http://<your-domain>/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"teacher\",\"password\":\"teacher123\"}"

# 触发部署
curl -X POST http://<your-domain>/api/v1/deploy/s2025_001 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"image\":\"registry.hydrosim.cn/gd/s2025_001:v1\",\"project_type\":\"gd\"}"
```

Step 10: 查看部署是否成功
```
# API 状态查询
curl -H "Authorization: Bearer TOKEN" \
  "http://<your-domain>/api/v1/deploy/s2025_001?project_type=gd"

# 集群视角
kubectl -n students-gd get deploy,svc,ingress
```

Step 11: 平台启动/停止/管理
平台启动/停止：
```
kubectl -n hydrosim scale deploy/portal-backend --replicas=1
kubectl -n hydrosim scale deploy/portal-frontend --replicas=1
kubectl -n hydrosim scale deploy/portal-backend --replicas=0
kubectl -n hydrosim scale deploy/portal-frontend --replicas=0
```

学生项目启动/停止：
```
kubectl -n students-gd scale deployment student-s2025_001 --replicas=1
kubectl -n students-gd scale deployment student-s2025_001 --replicas=0
```

重新部署（更新镜像）：再次调用 `/api/v1/deploy/{student_code}`

删除学生项目资源：
```
kubectl -n students-gd delete deploy student-s2025_001
kubectl -n students-gd delete svc student-s2025_001
kubectl -n students-gd delete ingress student-s2025_001
```
