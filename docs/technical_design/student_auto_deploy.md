# 学生仓库自动部署（镜像推送后触发）

本方案通过 **学生仓库 CI** 完成镜像构建与推送，并在成功后调用门户部署接口触发自动部署。

## 1. 前置条件

- 学生镜像可推送到你的 Registry
- 门户后端可被 CI 网络访问（例如 `https://portal.xxx.cn`）
- 门户已存在学生项目记录（student_code 与项目类型 gd/cd）

## 2. 门户部署接口

```
POST /api/v1/deploy/{student_code}
Content-Type: application/json

{
  "image": "registry.example.com/gd/s2025001:abcd1234",
  "project_type": "gd"
}
```

示例：
```bash
curl -X POST "https://portal.example.com/api/v1/deploy/s2025001" \
  -H "Content-Type: application/json" \
  -H "X-Deploy-Token: <YOUR_TOKEN>" \
  -d '{"image":"registry.example.com/gd/s2025001:abcd1234","project_type":"gd"}'
```

## 3. Gitea Actions 示例

> 将以下文件放到学生仓库的 `.gitea/workflows/auto-deploy.yaml`。

```yaml
name: Build & Auto Deploy

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    env:
      REGISTRY: ${{ secrets.REGISTRY }}
      IMAGE_NAME: ${{ secrets.REGISTRY }}/gd/s2025001
      IMAGE_TAG: ${{ github.sha }}
      PORTAL_URL: ${{ secrets.PORTAL_URL }}
    steps:
      - uses: actions/checkout@v3

      - name: Login to registry
        run: echo "${{ secrets.REGISTRY_PASSWORD }}" | docker login "$REGISTRY" -u "${{ secrets.REGISTRY_USERNAME }}" --password-stdin

      - name: Build & push
        run: |
          docker build -t "$IMAGE_NAME:$IMAGE_TAG" .
          docker push "$IMAGE_NAME:$IMAGE_TAG"

      - name: Trigger portal deploy
        run: |
          curl -X POST "$PORTAL_URL/api/v1/deploy/s2025001" \
            -H "Content-Type: application/json" \
            -H "X-Deploy-Token: ${{ secrets.DEPLOY_TRIGGER_TOKEN }}" \
            -d "{\"image\":\"$IMAGE_NAME:$IMAGE_TAG\",\"project_type\":\"gd\"}"
```

可直接使用模板文件：`docs/templates/student_auto_deploy_gitea.yaml`

### 需要配置的 Secrets

- `REGISTRY`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`
- `PORTAL_URL`（例如 `https://portal.example.com`）
- `DEPLOY_TRIGGER_TOKEN`（与门户后端 `DEPLOY_TRIGGER_TOKEN` 保持一致）

> 门户已支持 `DEPLOY_TRIGGER_TOKEN` 校验，CI 需通过 `X-Deploy-Token` 传入。
