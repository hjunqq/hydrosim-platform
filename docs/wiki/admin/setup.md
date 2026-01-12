# 初始化与全局设置（管理员）

## 1. 登录与基础信息

1. 访问门户：`http://portal.hydrosim.cn`
2. 使用管理员账号登录。
3. 进入 **系统设置**。

> 示例截图：`../assets/admin-settings.png`

## 2. 域名与命名规则

建议配置：
- 学生域名前缀：`stu-`
- 学生域名后缀：`gd.hydrosim.cn`

域名示例：
```
stu-20260101.gd.hydrosim.cn
```

## 3. 构建命名空间

在系统设置中填写：
```
gitea-runner
```

用于 Kaniko 构建任务调度。

## 4. 默认 Registry 与镜像模板

1. 在 **Registry 管理** 新增私有仓库。
2. 在 **系统设置** 选择默认 Registry。
3. 设置默认镜像模板：
```
{{registry}}/student/{{student_code}}
```

## 5. Gitea Deploy Key 自动写入

后端 `.env` 配置：
```
GITEA_BASE_URL=https://gitea.hydrosim.cn
GITEA_TOKEN=<TOKEN>
```

Token 需具备 Deploy Key 写入权限。
