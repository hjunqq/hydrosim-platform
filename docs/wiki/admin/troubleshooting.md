# 故障排查（管理员）

## 1. 构建提示 “Image repository is not configured”

原因：BuildConfig 未指定 `image_repo`，且系统默认 Registry 未配置。

处理：
1. 在系统设置选择默认 Registry。
2. 在构建配置填写镜像仓库地址。

## 2. 部署成功但访问显示 “no available server”

原因：Ingress 未指向可用 Service 或 Pod 未就绪。

处理：
- 检查 Deployment/Service/Ingress 状态。
- 查看 Pod 日志与就绪探针。

## 3. Deploy Key 自动写入失败

原因：Gitea Token 权限不足或无法访问 Gitea。

处理：
- 检查 `GITEA_BASE_URL` 与 `GITEA_TOKEN`。
- 需要时手动添加 Deploy Key 公钥。

## 4. TLS 显示默认证书

原因：TLS Secret 未匹配。

处理：
- 确认 `STUDENT_TLS_SECRET_NAME`。
- Secret 位于对应命名空间。
