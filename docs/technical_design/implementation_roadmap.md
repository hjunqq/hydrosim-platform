# HydroSim 门户网站实施路线图

> **版本**: 1.0  
> **创建日期**: 2026-01-13  
> **负责人**: 项目组  
> **参考文档**:
> - [教师门户设计方案](./teacher_portal_design.md)
> - [管理员功能原型](./admin_portal_spec.md)
> - [系统设置与用户信息页面](./portal_settings_user_pages.md)
> - [构建编排器设计](./portal_build_orchestrator.md)

---

## 📋 实施阶段总览

| 阶段 | 时间 | 核心目标 | 优先级 |
|------|------|----------|:------:|
| Phase 1 | 1-2 周 | 紧急修复与核心体验优化 | 🔴 高 |
| Phase 2 | 2-4 周 | 功能完善与后端增强 | 🟡 中 |
| Phase 3 | 1 个月+ | 用户体验提升与高级特性 | 🟢 低 |

---

## 🔴 Phase 1: 紧急修复与核心体验优化 (1-2 周)

### 1.1 路由与权限修复

#### 任务 1.1.1: 修复学生路由缺失

**问题描述**: 学生登录后导航到 `/projects/me/status`，但该路由未在 `App.tsx` 中定义。

**修改文件**:
- `frontend/src/App.tsx`

**实施步骤**:
```typescript
// 在 AppRoutes 中添加学生专属路由
<Route path="/projects/me/status" element={<ProjectStatusPage isStudentView={true} />} />
```

**验收标准**:
- [ ] 学生登录后能正确导航到项目状态页
- [ ] 页面显示该学生的项目信息
- [ ] 非学生角色访问该路由显示 403

---

#### 任务 1.1.2: 完善前端路由守卫

**问题描述**: 当前路由守卫仅检查 `isAuthenticated`，缺少角色权限检查。

**修改文件**:
- `frontend/src/App.tsx`
- 新建 `frontend/src/components/RoleGuard.tsx`

**实施步骤**:
```typescript
// RoleGuard.tsx
interface RoleGuardProps {
  allowedRoles: ('admin' | 'teacher' | 'student')[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user } = useAuth();
  if (!user?.role || !allowedRoles.includes(user.role as any)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

// 使用示例
<Route path="/admin/projects" element={
  <RoleGuard allowedRoles={['admin']}>
    <AdminProjectsPage />
  </RoleGuard>
} />
```

**验收标准**:
- [ ] 教师无法访问 `/admin/projects`
- [ ] 学生无法访问 `/students`
- [ ] 未授权访问时跳转到 Dashboard

---

### 1.2 DataGrid 操作列优化

#### 任务 1.2.1: 重构 StudentsPage 操作按钮

**问题描述**: 操作列包含 7 个按钮，宽度 600px，过于拥挤。

**修改文件**:
- `frontend/src/pages/StudentsPage.tsx`
- `frontend/src/styles/app.css`

**设计方案**:
```
┌──────────────────────────────────────────────────┐
│ 操作                                              │
├──────────────────────────────────────────────────┤
│ [监控] [部署 ▼]  [配置 ▼]  [删除]                  │
│         └─ 立即部署                               │
│         └─ 部署最新构建     └─ 构建配置            │
│                             └─ 构建记录            │
│                             └─ 触发构建            │
└──────────────────────────────────────────────────┘
```

**实施步骤**:
1. 创建 `ActionDropdown` 组件封装下拉菜单
2. 将 7 个按钮合并为 4 个（监控、部署、配置、删除）
3. 二级操作放入下拉菜单

```typescript
// ActionDropdown 组件示例
import { DropDownButton } from 'devextreme-react/drop-down-button';

const deployActions = [
  { id: 'deploy', text: '立即部署', icon: 'upload' },
  { id: 'deployLatest', text: '部署最新构建', icon: 'arrowup' }
];

<DropDownButton
  text="部署"
  icon="upload"
  items={deployActions}
  onItemClick={handleDeployAction}
  splitButton={true}
/>
```

**验收标准**:
- [ ] 操作列宽度减少到 300px 以内
- [ ] 所有操作功能正常
- [ ] 下拉菜单交互流畅

---

#### 任务 1.2.2: 同步优化 AdminProjectsPage

**修改文件**:
- `frontend/src/pages/AdminProjectsPage.tsx`

**实施步骤**:
与 1.2.1 相同的设计模式，保持两个页面一致性。

---

### 1.3 加载状态优化

#### 任务 1.3.1: 添加 DataGrid 骨架屏

**修改文件**:
- `frontend/src/components/TableSkeleton.tsx` (新建)
- `frontend/src/pages/StudentsPage.tsx`
- `frontend/src/pages/AdminProjectsPage.tsx`
- `frontend/src/pages/DeploymentsPage.tsx`

**实施步骤**:
```typescript
// TableSkeleton.tsx
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="skeleton-table">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeleton-row">
        <div className="skeleton-cell" style={{ width: '15%' }} />
        <div className="skeleton-cell" style={{ width: '20%' }} />
        <div className="skeleton-cell" style={{ width: '40%' }} />
        <div className="skeleton-cell" style={{ width: '25%' }} />
      </div>
    ))}
  </div>
);
```

```css
/* app.css */
.skeleton-table { padding: 16px; }
.skeleton-row { display: flex; gap: 16px; margin-bottom: 12px; }
.skeleton-cell {
  height: 20px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}
@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**验收标准**:
- [ ] 数据加载时显示骨架屏
- [ ] 骨架屏与表格列宽一致
- [ ] 加载完成后平滑过渡

---

### 1.4 后端错误处理统一

#### 任务 1.4.1: 创建统一错误响应模式

**修改文件**:
- `backend/app/core/exceptions.py` (新建)
- `backend/app/main.py`

**实施步骤**:
```python
# exceptions.py
from fastapi import HTTPException
from pydantic import BaseModel
from typing import Optional

class ErrorResponse(BaseModel):
    code: str
    message: str
    detail: Optional[str] = None

class AppException(HTTPException):
    def __init__(self, code: str, message: str, status_code: int = 400, detail: str = None):
        self.code = code
        super().__init__(status_code=status_code, detail={
            "code": code,
            "message": message,
            "detail": detail
        })

# 预定义错误
class NotFoundError(AppException):
    def __init__(self, resource: str, id: any):
        super().__init__(
            code="NOT_FOUND",
            message=f"{resource} not found",
            status_code=404,
            detail=f"Resource {resource} with id {id} does not exist"
        )

class PermissionDeniedError(AppException):
    def __init__(self, action: str):
        super().__init__(
            code="PERMISSION_DENIED",
            message=f"Not authorized to {action}",
            status_code=403
        )
```

```python
# main.py 添加全局异常处理
from fastapi.responses import JSONResponse

@app.exception_handler(AppException)
async def app_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail
    )
```

**验收标准**:
- [ ] 所有 API 错误返回统一格式
- [ ] 前端能正确解析错误信息
- [ ] 错误日志包含完整堆栈

---

## 🟡 Phase 2: 功能完善与后端增强 (2-4 周)

### 2.1 密码重置功能

#### 任务 2.1.1: 后端密码重置 API

**修改文件**:
- `backend/app/api/v1/endpoints/auth.py`
- `backend/app/services/email_service.py` (新建)
- `backend/app/models/password_reset.py` (新建)

**API 设计**:
```
POST /api/v1/auth/forgot-password/
  Body: { "email": "user@example.com" }
  Response: { "message": "Reset link sent" }

POST /api/v1/auth/reset-password/
  Body: { "token": "...", "new_password": "..." }
  Response: { "message": "Password updated" }
```

**实施步骤**:
1. 创建 `PasswordResetToken` 模型（token, user_id, expires_at）
2. 集成邮件发送服务（SMTP 配置）
3. 创建密码重置接口
4. 前端添加忘记密码页面

---

#### 任务 2.1.2: 前端忘记密码页面

**修改文件**:
- `frontend/src/pages/ForgotPasswordPage.tsx` (新建)
- `frontend/src/pages/ResetPasswordPage.tsx` (新建)
- `frontend/src/App.tsx`
- `frontend/src/api/auth.ts`

---

### 2.2 批量学生导入

#### 任务 2.2.1: 后端批量导入 API

**修改文件**:
- `backend/app/api/v1/endpoints/students.py`
- `backend/app/schemas/student.py`

**API 设计**:
```
POST /api/v1/students/batch/
  Content-Type: multipart/form-data
  Body: { "file": <CSV File>, "create_config": true, "trigger_build": false }
  Response: {
    "total": 50,
    "success": 48,
    "failed": 2,
    "errors": [
      { "row": 3, "student_code": "s001", "error": "Duplicate student code" }
    ]
  }
```

---

#### 任务 2.2.2: 前端批量导入界面

**修改文件**:
- `frontend/src/components/BatchImportModal.tsx` (新建)
- `frontend/src/pages/StudentsPage.tsx`

**界面设计**:
```
┌─────────────────────────────────────────────────┐
│ 批量导入学生                                 [×] │
├─────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐   │
│ │  📁 拖拽 CSV 文件到此处                    │   │
│ │     或点击选择文件                         │   │
│ │     [下载模板]                             │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│ [✓] 自动创建构建配置                            │
│ [✓] 自动生成 Deploy Key                         │
│ [ ] 导入后触发构建                              │
│                                                 │
│                        [取消]  [开始导入]       │
└─────────────────────────────────────────────────┘
```

---

### 2.3 数据导出功能

#### 任务 2.3.1: 后端导出 API

**修改文件**:
- `backend/app/api/v1/endpoints/students.py`

**API 设计**:
```
GET /api/v1/students/export/?format=csv
  Response: CSV file download
```

---

#### 任务 2.3.2: 前端 DataGrid 导出集成

**修改文件**:
- `frontend/src/pages/StudentsPage.tsx`
- `frontend/src/pages/AdminProjectsPage.tsx`

**实施步骤**:
```typescript
import { Export } from 'devextreme-react/data-grid';
import { exportDataGrid } from 'devextreme/excel_exporter';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';

<DataGrid onExporting={handleExport}>
  <Export enabled={true} allowExportSelectedData={true} />
</DataGrid>
```

---

### 2.4 操作审计日志

#### 任务 2.4.1: 审计日志模型与服务

**修改文件**:
- `backend/app/models/audit_log.py` (新建)
- `backend/app/services/audit_service.py` (新建)
- `backend/app/api/v1/endpoints/audit.py` (新建)

**模型设计**:
```python
class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True)
    action = Column(String)  # CREATE, UPDATE, DELETE, DEPLOY, BUILD
    resource_type = Column(String)  # student, project, deployment
    resource_id = Column(Integer)
    user_id = Column(Integer, ForeignKey("teachers.id"))
    details = Column(JSON)
    ip_address = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

### 2.5 MonitoringPage 增强

#### 任务 2.5.1: 添加更多监控指标

**修改文件**:
- `frontend/src/pages/MonitoringPage.tsx`
- `frontend/src/api/monitoring.ts`
- `backend/app/services/monitoring_service.py`

**新增指标**:
- Pod 状态分布图（运行/等待/失败）
- 最近 24 小时部署成功率
- 资源使用 Top 10 项目
- 异常事件时间线

---

## 🟢 Phase 3: 用户体验提升与高级特性 (1 个月+)

### 3.1 WebSocket 实时日志

#### 任务 3.1.1: 后端 WebSocket 服务

**修改文件**:
- `backend/app/api/v1/endpoints/ws.py` (新建)
- `backend/app/main.py`

**实施步骤**:
```python
from fastapi import WebSocket

@router.websocket("/ws/builds/{build_id}/logs")
async def build_logs_ws(websocket: WebSocket, build_id: int):
    await websocket.accept()
    # Stream Kubernetes job logs in real-time
    async for log_line in stream_build_logs(build_id):
        await websocket.send_text(log_line)
```

---

#### 任务 3.1.2: 前端日志查看器

**修改文件**:
- `frontend/src/components/LogViewer.tsx` (新建)
- `frontend/src/components/BuildStatusModal.tsx`

---

### 3.2 暗色模式

#### 任务 3.2.1: CSS 变量暗色主题

**修改文件**:
- `frontend/src/styles/app.css`
- `frontend/src/contexts/ThemeContext.tsx` (新建)

**实施步骤**:
```css
/* 暗色主题变量 */
[data-theme="dark"] {
  --primary-6: #40C4D4;
  --text-1: #E8EAED;
  --text-2: #BDC1C6;
  --bg-white: #1E1E1E;
  --fill-1: #292929;
  --border-color: #3C4043;
}
```

---

### 3.3 React Query 数据层优化

#### 任务 3.3.1: 引入 @tanstack/react-query

**修改文件**:
- `frontend/package.json`
- `frontend/src/main.tsx`
- `frontend/src/hooks/useStudents.ts` (新建)
- 所有页面逐步迁移

**实施步骤**:
```typescript
// hooks/useStudents.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useStudents(filters?: StudentFilters) {
  return useQuery({
    queryKey: ['students', filters],
    queryFn: () => studentsApi.list(filters),
    staleTime: 30_000,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: studentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    }
  });
}
```

---

### 3.4 移动端响应式适配

#### 任务 3.4.1: 页面响应式布局

**修改文件**:
- `frontend/src/styles/app.css`
- `frontend/src/layouts/MainLayout.tsx`

**断点设计**:
```css
/* 移动端 */
@media (max-width: 768px) {
  .sidebar { display: none; }
  .sidebar.mobile-open { display: flex; position: fixed; z-index: 100; }
  .content-scroll { padding: 16px; }
  .modern-card { border-radius: 8px; }
}

/* 平板 */
@media (min-width: 769px) and (max-width: 1024px) {
  .sidebar { width: 200px; }
}
```

---

## 📁 文件变更清单

### 新增文件

| 文件路径 | 阶段 | 描述 |
|----------|:----:|------|
| `frontend/src/components/RoleGuard.tsx` | P1 | 角色权限路由守卫 |
| `frontend/src/components/TableSkeleton.tsx` | P1 | 表格骨架屏组件 |
| `frontend/src/components/ActionDropdown.tsx` | P1 | 操作按钮下拉菜单 |
| `backend/app/core/exceptions.py` | P1 | 统一异常处理 |
| `frontend/src/pages/ForgotPasswordPage.tsx` | P2 | 忘记密码页面 |
| `frontend/src/pages/ResetPasswordPage.tsx` | P2 | 重置密码页面 |
| `frontend/src/components/BatchImportModal.tsx` | P2 | 批量导入弹窗 |
| `backend/app/services/email_service.py` | P2 | 邮件发送服务 |
| `backend/app/models/password_reset.py` | P2 | 密码重置 Token 模型 |
| `backend/app/models/audit_log.py` | P2 | 审计日志模型 |
| `backend/app/services/audit_service.py` | P2 | 审计日志服务 |
| `backend/app/api/v1/endpoints/ws.py` | P3 | WebSocket 端点 |
| `frontend/src/components/LogViewer.tsx` | P3 | 实时日志查看器 |
| `frontend/src/contexts/ThemeContext.tsx` | P3 | 主题上下文 |
| `frontend/src/hooks/useStudents.ts` | P3 | React Query Hooks |

### 修改文件

| 文件路径 | 阶段 | 修改内容 |
|----------|:----:|----------|
| `frontend/src/App.tsx` | P1 | 添加学生路由，集成 RoleGuard |
| `frontend/src/pages/StudentsPage.tsx` | P1/P2 | 优化操作列，添加批量导入 |
| `frontend/src/pages/AdminProjectsPage.tsx` | P1 | 同步优化操作列 |
| `frontend/src/styles/app.css` | P1/P3 | 骨架屏样式，暗色主题 |
| `backend/app/main.py` | P1/P3 | 异常处理，WebSocket |
| `backend/app/api/v1/endpoints/auth.py` | P2 | 密码重置 API |
| `backend/app/api/v1/endpoints/students.py` | P2 | 批量导入/导出 API |
| `frontend/src/pages/MonitoringPage.tsx` | P2 | 更多监控指标 |
| `frontend/src/layouts/MainLayout.tsx` | P3 | 响应式适配 |

---

## ✅ 验收检查清单

### Phase 1 验收
- [ ] 学生能正确登录并访问项目状态页
- [ ] 教师/管理员无法访问未授权页面
- [ ] StudentsPage 操作列优化完成
- [ ] AdminProjectsPage 操作列优化完成
- [ ] 数据加载时显示骨架屏
- [ ] API 错误返回统一格式

### Phase 2 验收
- [ ] 密码重置邮件发送成功
- [ ] 密码重置链接有效期验证
- [ ] CSV 批量导入功能正常
- [ ] 导入错误行有明确提示
- [ ] 数据可导出为 Excel/CSV
- [ ] 审计日志记录关键操作

### Phase 3 验收
- [ ] 构建日志 WebSocket 实时推送
- [ ] 暗色模式切换正常
- [ ] React Query 缓存生效
- [ ] 移动端布局适配正常

---

*文档结束*
