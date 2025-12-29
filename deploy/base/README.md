# 基础资源配置

包含命名空间、RBAC 等基础 Kubernetes 资源配置。

## 文件说明

- `namespace.yaml`: 平台命名空间定义
- `students-namespaces.yaml`: 学生项目命名空间定义
- `rbac.yaml`: 部署控制器 RBAC 权限配置

## 部署

```bash
kubectl apply -f namespace.yaml
kubectl apply -f students-namespaces.yaml
kubectl apply -f rbac.yaml
```
