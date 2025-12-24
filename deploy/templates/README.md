# 学生项目部署模板

包含不同类型学生项目的 Kubernetes 部署模板。

## 模板类型

- `vue-app/`: Vue 前端项目模板
- `python-app/`: Python 后端项目模板
- `java-app/`: Java Spring Boot 项目模板

## 使用方法

1. 复制对应类型的模板文件
2. 替换变量（如学号、项目名等）
3. 应用到 k8s 集群

## 变量说明

- `{{STUDENT_ID}}`: 学号
- `{{PROJECT_NAME}}`: 项目名称
- `{{IMAGE}}`: 镜像地址
- `{{PORT}}`: 服务端口
