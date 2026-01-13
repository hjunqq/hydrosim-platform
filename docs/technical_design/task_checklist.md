# HydroSim 门户网站待办任务清单

> **创建日期**: 2026-01-13  
> **同步文档**: [实施路线图](./implementation_roadmap.md)  
> **使用说明**: 开发时在对应任务前标记 `[/]` 表示进行中，`[x]` 表示完成

---

## 🔴 Phase 1: 紧急修复与核心体验优化

### 1.1 路由与权限修复

- [ ] **TASK-101**: 修复学生路由 `/projects/me/status`
  - 文件: `frontend/src/App.tsx`
  - 预估: 0.5h
  - 验收: 学生登录后能正确导航到项目状态页

- [ ] **TASK-102**: 创建 `RoleGuard` 路由守卫组件
  - 文件: `frontend/src/components/RoleGuard.tsx` (新建)
  - 预估: 1h
  - 验收: 未授权访问返回 Dashboard

- [ ] **TASK-103**: 集成 RoleGuard 到敏感路由
  - 文件: `frontend/src/App.tsx`
  - 依赖: TASK-102
  - 预估: 0.5h
  - 验收: 教师无法访问 `/admin/*`

---

### 1.2 DataGrid 操作列优化

- [ ] **TASK-201**: 创建 `ActionDropdown` 组件
  - 文件: `frontend/src/components/ActionDropdown.tsx` (新建)
  - 预估: 2h
  - 组件:
    ```typescript
    interface ActionDropdownProps {
      items: ActionItem[];
      onItemClick: (id: string) => void;
      primaryAction?: ActionItem;
    }
    ```

- [ ] **TASK-202**: 重构 `StudentsPage` 操作列
  - 文件: `frontend/src/pages/StudentsPage.tsx`
  - 依赖: TASK-201
  - 预估: 2h
  - 验收: 操作列宽度 ≤ 300px

- [ ] **TASK-203**: 重构 `AdminProjectsPage` 操作列
  - 文件: `frontend/src/pages/AdminProjectsPage.tsx`
  - 依赖: TASK-201
  - 预估: 1.5h
  - 验收: 与 StudentsPage 保持一致

---

### 1.3 加载状态优化

- [ ] **TASK-301**: 创建 `TableSkeleton` 骨架屏组件
  - 文件: `frontend/src/components/TableSkeleton.tsx` (新建)
  - 预估: 1h

- [ ] **TASK-302**: 添加骨架屏样式到 `app.css`
  - 文件: `frontend/src/styles/app.css`
  - 预估: 0.5h

- [ ] **TASK-303**: 集成骨架屏到 `StudentsPage`
  - 文件: `frontend/src/pages/StudentsPage.tsx`
  - 依赖: TASK-301, TASK-302
  - 预估: 0.5h

- [ ] **TASK-304**: 集成骨架屏到 `AdminProjectsPage`
  - 文件: `frontend/src/pages/AdminProjectsPage.tsx`
  - 依赖: TASK-301, TASK-302
  - 预估: 0.5h

- [ ] **TASK-305**: 集成骨架屏到 `DeploymentsPage`
  - 文件: `frontend/src/pages/DeploymentsPage.tsx`
  - 依赖: TASK-301, TASK-302
  - 预估: 0.5h

---

### 1.4 后端错误处理统一

- [ ] **TASK-401**: 创建统一异常处理模块
  - 文件: `backend/app/core/exceptions.py` (新建)
  - 预估: 1.5h
  - 包含: `AppException`, `NotFoundError`, `PermissionDeniedError`, `ValidationError`

- [ ] **TASK-402**: 注册全局异常处理器
  - 文件: `backend/app/main.py`
  - 依赖: TASK-401
  - 预估: 0.5h

- [ ] **TASK-403**: 重构 `students.py` 使用新异常
  - 文件: `backend/app/api/v1/endpoints/students.py`
  - 依赖: TASK-401
  - 预估: 1h

- [ ] **TASK-404**: 重构 `projects.py` 使用新异常
  - 文件: `backend/app/api/v1/endpoints/projects.py`
  - 依赖: TASK-401
  - 预估: 1h

---

## 🟡 Phase 2: 功能完善与后端增强

### 2.1 密码重置功能

- [ ] **TASK-501**: 创建 `PasswordResetToken` 模型
  - 文件: `backend/app/models/password_reset.py` (新建)
  - 预估: 1h

- [ ] **TASK-502**: 创建邮件发送服务
  - 文件: `backend/app/services/email_service.py` (新建)
  - 预估: 2h
  - 配置: SMTP 环境变量

- [ ] **TASK-503**: 实现密码重置 API
  - 文件: `backend/app/api/v1/endpoints/auth.py`
  - 依赖: TASK-501, TASK-502
  - 预估: 2h
  - 接口:
    - `POST /api/v1/auth/forgot-password/`
    - `POST /api/v1/auth/reset-password/`

- [ ] **TASK-504**: 数据库迁移
  - 命令: `alembic revision --autogenerate -m "add password_reset_tokens"`
  - 依赖: TASK-501
  - 预估: 0.5h

- [ ] **TASK-505**: 创建忘记密码页面
  - 文件: `frontend/src/pages/ForgotPasswordPage.tsx` (新建)
  - 预估: 2h

- [ ] **TASK-506**: 创建重置密码页面
  - 文件: `frontend/src/pages/ResetPasswordPage.tsx` (新建)
  - 预估: 2h

- [ ] **TASK-507**: 添加密码重置路由
  - 文件: `frontend/src/App.tsx`
  - 依赖: TASK-505, TASK-506
  - 预估: 0.5h

---

### 2.2 批量学生导入

- [ ] **TASK-601**: 实现批量导入 API
  - 文件: `backend/app/api/v1/endpoints/students.py`
  - 预估: 3h
  - 接口: `POST /api/v1/students/batch/`

- [ ] **TASK-602**: 创建 CSV 模板文件
  - 文件: `backend/templates/student_import_template.csv`
  - 预估: 0.5h

- [ ] **TASK-603**: 创建批量导入弹窗组件
  - 文件: `frontend/src/components/BatchImportModal.tsx` (新建)
  - 预估: 3h

- [ ] **TASK-604**: 集成批量导入到 StudentsPage
  - 文件: `frontend/src/pages/StudentsPage.tsx`
  - 依赖: TASK-603
  - 预估: 1h

---

### 2.3 数据导出功能

- [ ] **TASK-701**: 实现学生列表导出 API
  - 文件: `backend/app/api/v1/endpoints/students.py`
  - 预估: 1.5h
  - 接口: `GET /api/v1/students/export/`

- [ ] **TASK-702**: 安装 exceljs 和 file-saver
  - 命令: `pnpm add exceljs file-saver @types/file-saver`
  - 预估: 0.5h

- [ ] **TASK-703**: 添加 DataGrid Export 功能
  - 文件: `frontend/src/pages/StudentsPage.tsx`
  - 依赖: TASK-702
  - 预估: 1.5h

---

### 2.4 操作审计日志

- [ ] **TASK-801**: 创建审计日志模型
  - 文件: `backend/app/models/audit_log.py` (新建)
  - 预估: 1h

- [ ] **TASK-802**: 创建审计日志服务
  - 文件: `backend/app/services/audit_service.py` (新建)
  - 预估: 2h

- [ ] **TASK-803**: 数据库迁移
  - 命令: `alembic revision --autogenerate -m "add audit_logs"`
  - 依赖: TASK-801
  - 预估: 0.5h

- [ ] **TASK-804**: 集成审计日志到关键操作
  - 文件: 多个端点文件
  - 依赖: TASK-802
  - 预估: 2h
  - 操作: 创建学生、删除学生、部署、构建

- [ ] **TASK-805**: 创建审计日志查看 API
  - 文件: `backend/app/api/v1/endpoints/audit.py` (新建)
  - 预估: 1.5h

---

### 2.5 MonitoringPage 增强

- [ ] **TASK-901**: 添加 Pod 状态分布图
  - 文件: `frontend/src/pages/MonitoringPage.tsx`
  - 预估: 2h

- [ ] **TASK-902**: 添加部署成功率图表
  - 文件: `frontend/src/pages/MonitoringPage.tsx`
  - 预估: 1.5h

- [ ] **TASK-903**: 添加资源消耗 Top 10
  - 文件: `frontend/src/pages/MonitoringPage.tsx`
  - 预估: 2h

- [ ] **TASK-904**: 添加异常事件时间线
  - 文件: `frontend/src/pages/MonitoringPage.tsx`
  - 预估: 2h

---

## 🟢 Phase 3: 用户体验提升与高级特性

### 3.1 WebSocket 实时日志

- [ ] **TASK-1001**: 创建 WebSocket 端点
  - 文件: `backend/app/api/v1/endpoints/ws.py` (新建)
  - 预估: 3h

- [ ] **TASK-1002**: 注册 WebSocket 路由
  - 文件: `backend/app/main.py`
  - 依赖: TASK-1001
  - 预估: 0.5h

- [ ] **TASK-1003**: 创建日志查看器组件
  - 文件: `frontend/src/components/LogViewer.tsx` (新建)
  - 预估: 3h

- [ ] **TASK-1004**: 集成到 BuildStatusModal
  - 文件: `frontend/src/components/BuildStatusModal.tsx`
  - 依赖: TASK-1003
  - 预估: 1.5h

---

### 3.2 暗色模式

- [ ] **TASK-1101**: 定义暗色主题变量
  - 文件: `frontend/src/styles/app.css`
  - 预估: 2h

- [ ] **TASK-1102**: 创建主题上下文
  - 文件: `frontend/src/contexts/ThemeContext.tsx` (新建)
  - 预估: 1.5h

- [ ] **TASK-1103**: 添加主题切换按钮
  - 文件: `frontend/src/layouts/MainLayout.tsx`
  - 依赖: TASK-1102
  - 预估: 1h

- [ ] **TASK-1104**: 适配 DevExtreme 暗色主题
  - 文件: `frontend/src/main.tsx`
  - 预估: 1h

---

### 3.3 React Query 数据层优化

- [ ] **TASK-1201**: 安装 @tanstack/react-query
  - 命令: `pnpm add @tanstack/react-query @tanstack/react-query-devtools`
  - 预估: 0.5h

- [ ] **TASK-1202**: 配置 QueryClient
  - 文件: `frontend/src/main.tsx`
  - 依赖: TASK-1201
  - 预估: 0.5h

- [ ] **TASK-1203**: 创建学生数据 Hooks
  - 文件: `frontend/src/hooks/useStudents.ts` (新建)
  - 预估: 2h

- [ ] **TASK-1204**: 迁移 StudentsPage 使用 React Query
  - 文件: `frontend/src/pages/StudentsPage.tsx`
  - 依赖: TASK-1203
  - 预估: 2h

- [ ] **TASK-1205**: 迁移其他页面
  - 文件: 多个页面文件
  - 依赖: TASK-1204
  - 预估: 4h

---

### 3.4 移动端响应式适配

- [ ] **TASK-1301**: 添加移动端媒体查询
  - 文件: `frontend/src/styles/app.css`
  - 预估: 3h

- [ ] **TASK-1302**: 实现侧边栏移动端抽屉
  - 文件: `frontend/src/layouts/MainLayout.tsx`
  - 预估: 2h

- [ ] **TASK-1303**: DataGrid 移动端列隐藏配置
  - 文件: 多个页面文件
  - 预估: 2h

---

## 📊 工时统计

| 阶段 | 任务数 | 预估工时 |
|------|:------:|:--------:|
| Phase 1 | 15 | ~14h |
| Phase 2 | 20 | ~30h |
| Phase 3 | 16 | ~28h |
| **总计** | **51** | **~72h** |

---

## 📝 备注

1. 任务依赖关系已在各任务中标注
2. 预估工时仅供参考，实际可能有偏差
3. 优先完成 Phase 1 任务再进入 Phase 2
4. 每个阶段完成后进行集成测试

---

*最后更新: 2026-01-13*
