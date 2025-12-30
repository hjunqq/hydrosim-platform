# k3s 部署与管理流程（Step by Step）

本文档记录在 k3s 平台部署 Hydrosim 管理平台的完整流程，可作为学生部署项目的参考模板。

前提
- 已安装 k3s，kubectl 已指向目标集群
- Ingress Controller 已安装（k3s 默认 Traefik）
- 有可用镜像仓库（或内网 registry），并能被 k3s 拉取
- DNS 已配置（例如 portal.hydrosim.cn 指向集群入口）
- MinIO / Gitea 已由你搭建完成

本方案说明
- 平台使用独立的 Postgres 实例（新建数据库，不与 Gitea 共用）
- 平台通过 Gitea API，不直接读写 Gitea 数据库
- 学生项目数据与平台分离，平台仅存元数据（teachers/students/deployments）

Step 1: 创建命名空间与 RBAC
```
kubectl apply -f deploy/base/
```

Step 2: 部署平台专用 Postgres
如果你已自建 Postgres，可跳过此步并在 Step 3 中填你的连接信息。
```
kubectl apply -f deploy/infra/postgres.yaml
```

Step 3: 配置后端连接信息
修改以下文件（只改值）：
- `deploy/backend/secret.yaml`
  - `DATABASE_URL` 指向平台独立 Postgres
  - `JWT_SECRET_KEY` 自己设
  - `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` 使用你的 MinIO 凭据
  - `GITEA_TOKEN` 使用你的 Gitea token
- `deploy/backend/configmap.yaml`
  - `GITEA_URL` 指向你的 Gitea 地址
  - `MINIO_ENDPOINT` 指向你的 MinIO 地址

示例（独立 Postgres）：
```
postgresql://hydrosim_portal:<password>@portal-postgres:5432/hydrosim_portal
```

Step 4: 构建并推送镜像（Windows PowerShell 示例）
```
$env:REGISTRY="registry.hydrosim.cn"

docker build -t "$env:REGISTRY/hydrosim-portal-backend:1.0.0" .\backend
docker build -t "$env:REGISTRY/hydrosim-portal-frontend:1.0.0" .\frontend

docker push "$env:REGISTRY/hydrosim-portal-backend:1.0.0"
docker push "$env:REGISTRY/hydrosim-portal-frontend:1.0.0"
```

Step 5: 更新部署清单的镜像地址
修改：
- `deploy/backend/deployment.yaml` 的 `image`
- `deploy/frontend/deployment.yaml` 的 `image`

Step 6: 部署后端 / 前端 / Ingress
```
kubectl apply -f deploy/backend/
kubectl apply -f deploy/frontend/
kubectl apply -f deploy/ingress/
```

Step 7: 配置 HTTPS（TLS）
若你已有证书文件：
```
kubectl -n hydrosim create secret tls portal-tls \
  --cert=fullchain.pem \
  --key=privkey.pem
kubectl apply -f deploy/ingress/portal-ingress.yaml
```

Step 8: 初始化数据库与创建默认教师
```
kubectl -n hydrosim exec deploy/portal-backend -- alembic upgrade head
kubectl -n hydrosim exec deploy/portal-backend -- python seed_teacher.py
# 默认账号：teacher / teacher123
```

Step 9: 验证平台
```
kubectl -n hydrosim get pods
curl -I https://portal.hydrosim.cn/api/v1/health
```

Step 10: 学生项目部署流程（平台内）
1) 登录 `https://portal.hydrosim.cn`
2) 学生项目列表 → 新建学生项目
3) 进入学生详情 → “部署新版本”
4) 输入学生镜像地址，例如：`registry.hydrosim.cn/gd/s2025_001:v1`

Step 11: 学生项目部署验证
```
kubectl -n students-gd get deploy,svc,ingress
curl -H "Authorization: Bearer TOKEN" \
  "https://portal.hydrosim.cn/api/v1/deploy/s2025_001?project_type=gd"
```

Step 12: 平台与学生项目启停
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

重新部署（更新镜像）：再次调用 `/api/v1/deploy/{student_code}`。

删除学生项目资源：
```
kubectl -n students-gd delete deploy student-s2025_001
kubectl -n students-gd delete svc student-s2025_001
kubectl -n students-gd delete ingress student-s2025_001
```
