# 系统概览（管理员）

本页概述平台结构与职责边界，便于管理员快速了解系统全貌。

## 1. 系统结构

- 门户前端/后端：HydroSim 管理门户与 API 服务。
- 数据库：门户数据库 + 学生项目数据库。
- K3s 集群：承载学生项目与数据库实例。
- 对象存储：MinIO 作为备份与归档存储。
- Ingress：对外暴露访问域名与入口。

> 可使用 `docs/portal-architecture.svg` 作为架构图。

## 2. 多租户隔离

- 命名空间：按项目类型隔离（`students-gd` / `students-cd`）。
- 资源限制：ResourceQuota + LimitRange 控制资源。
- 网络隔离：NetworkPolicy 默认拒绝跨命名空间访问。
- RBAC：门户服务账号具备学生命名空间内 CRUD 权限。

## 3. 核心术语

- BuildConfig：构建配置（仓库、分支、Dockerfile、镜像仓库）。
- Build：构建任务（Kaniko Job）。
- Deploy：部署记录（Deployment/Service/Ingress）。

## 4. 推荐阅读路径

- 初始化与全局设置
- Registry 管理
- TLS 证书配置
- 日常运维与故障排查
