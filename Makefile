.PHONY: help dev build deploy clean test

help:
	@echo "========================================="
	@echo "智慧水利毕业设计部署平台 - Makefile"
	@echo "========================================="
	@echo "make dev              - 启动本地开发环境"
	@echo "make dev-frontend     - 仅启动前端开发服务器"
	@echo "make dev-backend      - 仅启动后端开发服务器"
	@echo "make build            - 构建前后端镜像"
	@echo "make deploy-local     - 部署到本地 k3s"
	@echo "make deploy-portal    - 部署管理门户到 k3s"
	@echo "make init-cluster     - 初始化 k3s 集群"
	@echo "make create-students  - 批量创建学生资源"
	@echo "make clean            - 清理开发环境"
	@echo "make test             - 运行测试"
	@echo "make logs             - 查看服务日志"

# 本地开发环境
dev:
	docker-compose up -d

dev-frontend:
	cd frontend && pnpm install && pnpm dev

dev-backend:
	cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# 构建镜像
build:
	docker-compose build

build-frontend:
	docker build -t hydrosim-portal-frontend:latest ./frontend

build-backend:
	docker build -t hydrosim-portal-backend:latest ./backend

# 部署相关
deploy-local: build
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

deploy-portal:
	kubectl apply -f deploy/base/
	kubectl apply -f deploy/backend/
	kubectl apply -f deploy/frontend/
	kubectl apply -f deploy/ingress/

init-cluster:
	bash ./scripts/init/init-cluster.sh

create-students:
	python ./scripts/student/batch-create.py ./scripts/student/students.csv

# 清理
clean:
	docker-compose down -v
	rm -rf frontend/dist backend/__pycache__

clean-k8s:
	kubectl delete -f deploy/ --recursive

# 测试
test:
	cd backend && pytest
	cd frontend && pnpm test

# 日志
logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f portal-backend

logs-frontend:
	docker-compose logs -f portal-frontend

# 数据库
db-init:
	bash ./scripts/init/init-database.sh

db-migrate:
	cd backend && alembic upgrade head

db-backup:
	bash ./scripts/backup/backup-db.sh

# 健康检查
health:
	bash ./scripts/utils/check-health.sh
