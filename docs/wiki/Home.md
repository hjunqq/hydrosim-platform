# HydroSim 学生项目平台 - 系统说明

## 平台信息（当前部署）

- 门户地址：`http://portal.hydrosim.cn`（如与实际不一致，请统一替换本页与全站链接）
- Gitea 地址：`https://gitea.hydrosim.cn`
- Registry 地址：`registry.hydrosim.cn`
- 学生域名前缀：`stu-`
- 学生域名后缀：`gd.hydrosim.cn`
- 学生项目示例域名：`http://stu-20260101.gd.hydrosim.cn/`
- 示例仓库：`https://gitea.hydrosim.cn/students/20260101.git`
- 示例镜像：`registry.hydrosim.cn/student/20260101:manual-516efd`
- 主要命名空间：`students-gd`、`students-cd`
- 构建命名空间（建议）：`gitea-runner`
- TLS 证书：`*.gd.hydrosim.cn`（泛域名）

## 角色入口

- 管理员：全局设置、Registry、TLS、运维
  - [管理员手册入口](admin-guide.md)
- 教师：创建项目、构建、部署、排障
  - [教师手册入口](teacher-guide.md)
- 学生：代码规范、构建、访问
  - [学生手册入口](student-guide.md)

## 平台流程总览

1. 管理员完成系统设置、Registry 与 TLS 配置。
2. 教师创建学生项目，配置仓库与构建配置。
3. 生成 Deploy Key，确保私有仓库可拉取。
4. 触发构建，产出镜像并推送 Registry。
5. 选择“部署最新”或手动部署镜像，绑定学生域名。

## 需要补齐的素材

- 建议在 Wiki 中放入关键页面截图（见 [素材清单](assets/README.md)）。
- 建议补充系统架构图（可使用已有 `docs/portal-architecture.svg`）。
