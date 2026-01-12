# 仓库与 Dockerfile（学生）

## 1. 仓库规范

- 必须包含 `Dockerfile`
- 应用入口应读取 `PORT` 环境变量

## 2. Dockerfile 示例

```Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
ENV PORT=8080
EXPOSE 8080
CMD ["python", "app.py"]
```

## 3. 数据持久化

平台提供数据目录：
```
DATA_DIR=/data
DB_FILE=/data/app.db
```

请确保需要持久化的文件写入 `/data`。
