# 常见问题（教师）

**Q: 构建提示 Image repository is not configured？**

A: 在系统设置中设置默认 Registry 与模板，或在构建配置中填写 image_repo。

**Q: 部署完成但访问显示 no available server？**

A: 通常是容器未启动或端口不正确，请确认应用监听端口与 `PORT` 设置一致。
