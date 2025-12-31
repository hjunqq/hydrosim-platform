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

Step 0: 推送代码到 Gitea（如已托管可跳过）
1) 在 Gitea 上创建一个新仓库（例如 `hydrosim-platform`）。
2) 本地添加远程地址并推送：
```
git remote add origin http://<gitea-host>/<owner>/hydrosim-platform.git
git add -A
git commit -m "init portal"
git push -u origin main
```

Step 0.1: 配置 Gitea Actions 自动部署（推荐）
目标：代码 push 后自动构建镜像，并直接部署到 k3s。

**准备 CI 专用 kubeconfig（一次性）**
```bash
# 创建 CI ServiceAccount
kubectl -n hydrosim create serviceaccount ci-deployer
kubectl -n hydrosim create rolebinding ci-deployer-edit --clusterrole=edit  --serviceaccount=hydrosim:ci-deployer

# 获取集群地址与 CA
SERVER=$(kubectl config view --raw -o jsonpath='{.clusters[0].cluster.server}')
CA_DATA=$(kubectl config view --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')

# 生成 token (K8s 1.24+)
TOKEN=$(kubectl -n hydrosim create token ci-deployer)

# 生成 kubeconfig
cat > /tmp/ci-kubeconfig <<EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: ${CA_DATA}
    server: ${SERVER}
  name: k3s
users:
- name: ci-deployer
  user:
    token: ${TOKEN}
contexts:
- context:
    cluster: k3s
    user: ci-deployer
    namespace: hydrosim
  name: ci-deployer@k3s
current-context: ci-deployer@k3s
EOF

# 注意：k3s 默认 server 可能是 https://127.0.0.1:6443
# CI 机器无法访问时，请替换为集群可达地址，或在工作流里设置 KUBE_SERVER

# 转成 base64 (用于 Gitea Secret)
base64 -w0 /tmp/ci-kubeconfig
```

Windows PowerShell（已生成 kubeconfig 文件时）：
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("ci-kubeconfig"))
```

**在 Gitea 仓库配置 Secrets**
- `REGISTRY`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`
- `KUBECONFIG_DATA`（上一步 base64 输出）
- `KUBE_SERVER`（可选，覆盖 kubeconfig 里的 server）
- `KUBE_INSECURE`（可选，设为 `true` 可跳过 k3s 自签证书校验）
- `DATABASE_URL`, `JWT_SECRET_KEY`
- `GITEA_URL`, `GITEA_TOKEN`（如无需可留空）
- `GITEA_USERNAME`（可选，手动 checkout 需要时使用）
- `GITEA_REPOSITORY`（可选，格式：`owner/repo`）
- `GITEA_CA_CERT`（可选，自签证书 PEM）
- `GIT_SSL_NO_VERIFY`（可选，设为 `true` 可临时跳过 Git SSL 校验）
- `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`（如无需可留空）
- `DEPLOY_TRIGGER_TOKEN`（用于学生仓库自动部署）
- `RUN_DB_MIGRATION`（可选，设为 `true`）
- `APPLY_POSTGRES`（可选，设为 `false` 可跳过内置 Postgres 部署）

**启用工作流**
已内置工作流：`.gitea/workflows/portal-deploy.yaml`  
触发条件：`main` 分支 push 或手动触发。

Step 1: 创建命名空间与 RBAC
```
kubectl apply -f deploy/base/
```

Step 2: 部署平台专用 Postgres（可选）
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
  - `DEPLOY_TRIGGER_TOKEN` 用于学生仓库自动部署的回调校验
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
# 管理员账号：admin / admin123
```

Step 9: 验证平台
```
kubectl -n hydrosim get pods
curl -I https://portal.hydrosim.cn/api/v1/health
```

Step 9.1: 系统设置推荐值（首次部署后）
进入“系统设置”并确认学生域名配置：
- 学生域名前缀：`stu-`
- 学生域名后缀：`hydrosim.cn`
最终域名格式示例：`stu-s2025001.gd.hydrosim.cn`

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

Step 13: 学生仓库自动部署（推荐）
参考：`docs/technical_design/student_auto_deploy.md`

删除学生项目资源：
```
kubectl -n students-gd delete deploy student-s2025_001
kubectl -n students-gd delete svc student-s2025_001
kubectl -n students-gd delete ingress student-s2025_001
```
