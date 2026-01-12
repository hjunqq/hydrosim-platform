# Registry 管理（管理员）

## 1. 新增 Registry

路径：**管理后台 -> Registry**

填写：
- 名称：`Hydrosim Registry`
- URL：`registry.hydrosim.cn`
- 账号/密码：如需鉴权

> 示例截图：`../assets/admin-registry.png`

## 2. 设置默认 Registry

在 **系统设置** 中选择默认 Registry，确保新项目可自动写入镜像仓库。

## 3. 默认镜像模板建议

推荐模板：
```
{{registry}}/student/{{student_code}}
```

构建成功后镜像示例：
```
registry.hydrosim.cn/student/20260101:manual-516efd
```
