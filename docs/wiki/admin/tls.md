# TLS/证书配置（管理员）

## 1. 证书原则

- 学生域名为泛域名：`*.gd.hydrosim.cn`
- 推荐使用 cert-manager 自动签发

## 2. 手动配置方式

```
kubectl -n students-gd create secret tls student-wildcard-tls   --cert=fullchain.pem   --key=privkey.pem

kubectl -n students-cd create secret tls student-wildcard-tls   --cert=fullchain.pem   --key=privkey.pem
```

并在后端 `.env` 设置：
```
STUDENT_TLS_SECRET_NAME=student-wildcard-tls
```

## 3. 常见问题

- 若浏览器显示 `TRAEFIK DEFAULT CERT`，通常是 Secret 未匹配或未同步。
- 确认 Secret 位于 `students-gd` / `students-cd`。
