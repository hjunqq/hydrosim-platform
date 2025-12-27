# 项目结构说明

## 📂 目录结构

```
hydrosim-platform/
├── frontend/                      # 前端 - React 教师管理门户
│   ├── src/
│   │   ├── api/                   # API 调用封装
│   │   │   ├── request.ts         # Axios 封装
│   │   │   └── auth.ts            # 认证 API
│   │   ├── components/            # 通用组件
│   │   ├── pages/                 # 页面视图 (React Pages)
│   │   │   ├── LoginPage.tsx      # 登录页
│   │   │   ├── DashboardPage.tsx  # 仪表盘
│   │   │   └── StudentsPage.tsx   # 学生管理
│   │   ├── layouts/               # 布局组件
│   │   │   └── MainLayout.tsx
│   │   ├── router.tsx             # 路由配置
│   │   ├── store/                 # Zustand 状态管理
│   │   ├── types/                 # TypeScript 类型
│   │   ├── App.tsx                # 根组件
│   │   └── main.tsx               # 入口文件
│   ├── public/                    # 静态资源
│   ├── index.html                 # HTML 入口
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/                       # 后端 - FastAPI 管理服务
│   ├── app/
│   │   ├── api/                   # API 路由层
│   │   │   └── v1/
│   │   │       ├── endpoints/     # 接口端点
│   │   │       │   ├── auth.py    # 认证接口
│   │   │       │   ├── projects.py    # 项目管理
│   │   │       │   ├── students.py    # 学生管理
│   │   │       │   ├── deployments.py # 部署管理
│   │   │       │   └── workflows.py   # CI/CD 工作流
│   │   │       └── api.py         # 路由聚合
│   │   ├── core/                  # 核心配置
│   │   │   ├── config.py          # 配置管理
│   │   │   └── security.py        # JWT 认证
│   │   ├── models/                # 数据库模型
│   │   ├── schemas/               # Pydantic 模型
│   │   ├── services/              # 业务逻辑层
│   │   ├── db/                    # 数据库配置
│   │   └── main.py                # FastAPI 应用入口
│   ├── alembic/                   # 数据库迁移
│   │   └── versions/
│   ├── tests/                     # 测试用例
│   ├── .env.example               # 环境变量示例
│   ├── alembic.ini                # Alembic 配置
│   ├── Dockerfile                 # 后端镜像构建
│   ├── requirements.txt           # Python 依赖
│   └── pyproject.toml             # Python 项目配置
│
├── deploy/                        # Kubernetes 部署配置
│   ├── base/                      # 基础资源
│   │   ├── namespace.yaml         # 命名空间
│   │   └── rbac.yaml              # RBAC 权限（待实现）
│   ├── backend/                   # 后端部署配置
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── frontend/                  # 前端部署配置
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── ingress/                   # Ingress 配置
│   │   ├── traefik-config.yaml
│   │   └── ingress-rules.yaml
│   ├── infra/                     # 基础设施
│   │   ├── postgresql.yaml
│   │   ├── minio.yaml
│   │   └── gitea.yaml
│   └── templates/                 # 学生项目模板
│       ├── vue-app/               # Vue 项目模板
│       ├── python-app/            # Python 项目模板
│       └── java-app/              # Java 项目模板
│
├── scripts/                       # 自动化脚本
│   ├── init/                      # 初始化脚本
│   │   ├── init-cluster.sh        # 集群初始化
│   │   ├── init-database.sh       # 数据库初始化
│   │   └── init-infra.sh          # 基础设施初始化
│   ├── student/                   # 学生资源管理
│   │   ├── batch-create.sh        # 批量创建
│   │   ├── students.csv.example   # 学生名单模板
│   │   └── delete-student.sh      # 删除学生资源
│   ├── deploy/                    # 部署脚本
│   │   ├── deploy-portal.sh       # 部署管理门户
│   │   └── rollback.sh            # 回滚脚本
│   ├── backup/                    # 备份恢复
│   │   ├── backup-db.sh
│   │   └── restore-db.sh
│   └── utils/                     # 工具脚本
│       ├── check-health.sh        # 健康检查
│       └── clean-resources.sh     # 清理资源
│
├── docs/                          # 文档
│   ├── architecture.md            # 架构设计
│   ├── setup-guide.md             # 部署指南
│   ├── api-reference.md           # API 文档
│   ├── teacher-guide.md           # 教师使用手册
│   └── troubleshooting.md         # 故障排查
│
├── .gitea/                        # Gitea CI/CD 配置
│   └── workflows/
│       ├── frontend.yaml          # 前端构建部署
│       ├── backend.yaml           # 后端构建部署
│       └── templates/             # 学生项目工作流模板
│
├── db/                            # 数据库
│   ├── migrations/                # SQL 迁移脚本
│   └── seeds/                     # 初始数据
│
├── tools/                         # 开发工具
│   ├── dev-setup.sh               # 本地环境搭建
│   └── port-forward.sh            # K8s 端口转发
│
├── .gitignore                     # Git 忽略配置
├── docker-compose.yml             # 本地开发环境
├── Makefile                       # 命令封装
└── README.md                      # 项目说明
```

## 🚀 快速开始

### 本地开发

```bash
# 启动所有服务（Docker Compose）
make dev

# 仅启动前端
make dev-frontend

# 仅启动后端
make dev-backend
```

### 部署到 k3s

```bash
# 初始化集群
make init-cluster

# 部署管理门户
make deploy-portal

# 批量创建学生项目
make create-students
```

## 📝 开发说明

### 前端开发

```bash
cd frontend
pnpm install
pnpm dev
```

访问 http://localhost:8080

### 后端开发

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

访问 http://localhost:8000/docs （API 文档）

## 🔧 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Element Plus + Pinia
- **后端**: FastAPI + SQLAlchemy + PostgreSQL
- **容器**: Docker + Kubernetes (k3s)
- **CI/CD**: Gitea Actions
- **存储**: MinIO
- **反向代理**: Traefik / Nginx

## 📖 相关文档

- [架构设计](docs/architecture.md)
- [部署指南](docs/setup-guide.md)
- [API 参考](docs/api-reference.md)
- [教师使用手册](docs/teacher-guide.md)
