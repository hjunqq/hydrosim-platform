# 后端 API 扩展设计

> **版本**: 1.0  
> **创建日期**: 2026-01-13  
> **基础文档**: [原 API 参考](../api/backend_api.md)

---

## 1. 待实现 API 清单

### 1.1 认证相关

#### 1.1.1 忘记密码

**POST** `/api/v1/auth/forgot-password/`

请求发送密码重置邮件。

**Request Body**:
```json
{
  "email": "teacher@example.com"
}
```

**Response** (200):
```json
{
  "message": "If this email exists, a reset link has been sent."
}
```

**实现要点**:
- 不暴露邮箱是否存在
- Token 有效期 1 小时
- 每个邮箱每小时限制 3 次请求

---

#### 1.1.2 重置密码

**POST** `/api/v1/auth/reset-password/`

使用 Token 设置新密码。

**Request Body**:
```json
{
  "token": "abc123...",
  "new_password": "newSecurePassword123"
}
```

**Response** (200):
```json
{
  "message": "Password has been reset successfully."
}
```

**Error Responses**:
- 400: Token 无效或已过期
- 422: 密码不符合要求

---

### 1.2 学生管理

#### 1.2.1 批量导入学生

**POST** `/api/v1/students/batch/`

**Content-Type**: `multipart/form-data`

**Form Fields**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| file | File | ✅ | CSV 文件 |
| create_build_config | boolean | | 是否创建构建配置 (默认 true) |
| generate_deploy_key | boolean | | 是否生成 Deploy Key (默认 true) |
| trigger_build | boolean | | 是否触发构建 (默认 false) |

**CSV 格式**:
```csv
student_code,name,project_type,git_repo_url,expected_image_name
s2025001,张三,gd,https://git.example.com/s2025001.git,
s2025002,李四,cd,https://git.example.com/s2025002.git,registry.example.com/project:latest
```

**Response** (200):
```json
{
  "total": 50,
  "success": 48,
  "failed": 2,
  "created_students": [
    { "id": 101, "student_code": "s2025001", "name": "张三" }
  ],
  "errors": [
    {
      "row": 3,
      "student_code": "s2025003",
      "field": "student_code",
      "error": "Student code already exists"
    },
    {
      "row": 10,
      "student_code": "s2025010",
      "field": "git_repo_url",
      "error": "Invalid URL format"
    }
  ]
}
```

---

#### 1.2.2 导出学生列表

**GET** `/api/v1/students/export/`

**Query Parameters**:
| 参数 | 类型 | 说明 |
|------|------|------|
| format | string | `csv` 或 `xlsx` (默认 csv) |
| project_type | string | 筛选项目类型 |

**Response**: 文件下载

**Headers**:
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="students_2026-01-13.csv"
```

---

#### 1.2.3 下载导入模板

**GET** `/api/v1/students/batch/template/`

**Response**: CSV 模板文件下载

---

### 1.3 审计日志

#### 1.3.1 查询审计日志

**GET** `/api/v1/audit/logs/`

**Query Parameters**:
| 参数 | 类型 | 说明 |
|------|------|------|
| action | string | 操作类型筛选 |
| resource_type | string | 资源类型筛选 |
| user_id | integer | 操作人筛选 |
| start_date | datetime | 开始时间 |
| end_date | datetime | 结束时间 |
| skip | integer | 分页偏移 |
| limit | integer | 每页数量 (默认 50, 最大 200) |

**Response** (200):
```json
{
  "total": 1234,
  "items": [
    {
      "id": 1,
      "action": "CREATE",
      "resource_type": "student",
      "resource_id": 101,
      "user_id": 1,
      "user_name": "admin",
      "details": {
        "student_code": "s2025001",
        "name": "张三"
      },
      "ip_address": "192.168.1.100",
      "created_at": "2026-01-13T10:30:00Z"
    }
  ]
}
```

**Action 类型枚举**:
- `CREATE`: 创建资源
- `UPDATE`: 更新资源
- `DELETE`: 删除资源
- `DEPLOY`: 部署操作
- `BUILD`: 构建操作
- `LOGIN`: 登录
- `LOGOUT`: 登出
- `PASSWORD_RESET`: 密码重置

**Resource Type 枚举**:
- `student`
- `project`
- `deployment`
- `build`
- `build_config`
- `registry`
- `settings`

---

#### 1.3.2 导出审计日志

**GET** `/api/v1/audit/logs/export/`

**Query Parameters**: 同查询接口

**Response**: CSV 文件下载

---

### 1.4 系统设置

#### 1.4.1 获取邮件配置

**GET** `/api/v1/admin/settings/email/`

**Response** (200):
```json
{
  "smtp_host": "smtp.example.com",
  "smtp_port": 587,
  "smtp_user": "noreply@example.com",
  "smtp_password": "••••••••",
  "smtp_use_tls": true,
  "from_name": "HydroSim Portal",
  "from_email": "noreply@example.com"
}
```

---

#### 1.4.2 更新邮件配置

**PUT** `/api/v1/admin/settings/email/`

**Request Body**:
```json
{
  "smtp_host": "smtp.example.com",
  "smtp_port": 587,
  "smtp_user": "noreply@example.com",
  "smtp_password": "newpassword",
  "smtp_use_tls": true,
  "from_name": "HydroSim Portal",
  "from_email": "noreply@example.com"
}
```

---

#### 1.4.3 测试邮件发送

**POST** `/api/v1/admin/settings/email/test/`

**Request Body**:
```json
{
  "to_email": "test@example.com"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Test email sent successfully"
}
```

---

### 1.5 监控增强

#### 1.5.1 获取 Pod 状态分布

**GET** `/api/v1/monitoring/pods/distribution/`

**Response** (200):
```json
{
  "running": 42,
  "pending": 3,
  "failed": 2,
  "succeeded": 15,
  "unknown": 0
}
```

---

#### 1.5.2 获取部署成功率

**GET** `/api/v1/monitoring/deployments/success-rate/`

**Query Parameters**:
| 参数 | 类型 | 说明 |
|------|------|------|
| period | string | `24h`, `7d`, `30d` |

**Response** (200):
```json
{
  "period": "24h",
  "total_deployments": 50,
  "successful": 45,
  "failed": 5,
  "success_rate": 0.9,
  "trend": [
    { "time": "2026-01-13T00:00:00Z", "success_rate": 0.95 },
    { "time": "2026-01-13T06:00:00Z", "success_rate": 0.88 },
    { "time": "2026-01-13T12:00:00Z", "success_rate": 0.92 }
  ]
}
```

---

#### 1.5.3 获取资源消耗 Top N

**GET** `/api/v1/monitoring/resources/top/`

**Query Parameters**:
| 参数 | 类型 | 说明 |
|------|------|------|
| metric | string | `cpu` 或 `memory` |
| limit | integer | 返回数量 (默认 10) |

**Response** (200):
```json
{
  "metric": "cpu",
  "items": [
    {
      "student_code": "s2025001",
      "student_name": "张三",
      "namespace": "students-gd",
      "cpu_usage": "500m",
      "cpu_limit": "1000m",
      "usage_percent": 0.5
    }
  ]
}
```

---

#### 1.5.4 获取异常事件

**GET** `/api/v1/monitoring/events/`

**Query Parameters**:
| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | `Warning` 或 `Normal` |
| namespace | string | 命名空间筛选 |
| limit | integer | 返回数量 (默认 50) |

**Response** (200):
```json
{
  "items": [
    {
      "type": "Warning",
      "reason": "ImagePullBackOff",
      "message": "Back-off pulling image \"registry.example.com/project:v1\"",
      "namespace": "students-gd",
      "involved_object": "pod/s2025001-deployment-xxxx",
      "first_timestamp": "2026-01-13T10:00:00Z",
      "last_timestamp": "2026-01-13T10:30:00Z",
      "count": 5
    }
  ]
}
```

---

## 2. 数据模型

### 2.1 密码重置 Token

```python
# models/password_reset.py
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from app.db.base_class import Base

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    user_type = Column(String, default="teacher")  # teacher or student
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    @classmethod
    def create_token(cls, user_id: int, user_type: str = "teacher"):
        import secrets
        return cls(
            token=secrets.token_urlsafe(32),
            user_id=user_id,
            user_type=user_type,
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )
    
    @property
    def is_valid(self) -> bool:
        return not self.used and datetime.utcnow() < self.expires_at
```

### 2.2 审计日志

```python
# models/audit_log.py
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False, index=True)
    resource_type = Column(String, nullable=False, index=True)
    resource_id = Column(Integer)
    user_id = Column(Integer, ForeignKey("teachers.id"))
    user_name = Column(String)
    details = Column(JSON)
    ip_address = Column(String)
    user_agent = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("Teacher", backref="audit_logs")
```

### 2.3 邮件配置

```python
# models/email_settings.py (扩展 SystemSettings)

class SystemSettings(Base):
    # ... 现有字段 ...
    
    # 邮件配置
    smtp_host = Column(String)
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String)
    smtp_password = Column(String)  # 加密存储
    smtp_use_tls = Column(Boolean, default=True)
    email_from_name = Column(String, default="HydroSim Portal")
    email_from_address = Column(String)
```

---

## 3. Pydantic Schemas

### 3.1 密码重置

```python
# schemas/auth.py

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validate_password(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain digit')
        return v
```

### 3.2 批量导入

```python
# schemas/student.py

class BatchImportResult(BaseModel):
    total: int
    success: int
    failed: int
    created_students: List[StudentBrief]
    errors: List[BatchImportError]

class BatchImportError(BaseModel):
    row: int
    student_code: Optional[str]
    field: Optional[str]
    error: str

class StudentBrief(BaseModel):
    id: int
    student_code: str
    name: str
```

### 3.3 审计日志

```python
# schemas/audit.py

class AuditLogOut(BaseModel):
    id: int
    action: str
    resource_type: str
    resource_id: Optional[int]
    user_id: Optional[int]
    user_name: Optional[str]
    details: Optional[dict]
    ip_address: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class AuditLogList(BaseModel):
    total: int
    items: List[AuditLogOut]
```

---

## 4. 服务层

### 4.1 邮件服务

```python
# services/email_service.py

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from jinja2 import Template

class EmailService:
    def __init__(self, settings):
        self.host = settings.smtp_host
        self.port = settings.smtp_port
        self.user = settings.smtp_user
        self.password = settings.smtp_password
        self.use_tls = settings.smtp_use_tls
        self.from_name = settings.email_from_name
        self.from_email = settings.email_from_address
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{self.from_name} <{self.from_email}>"
        msg['To'] = to_email
        
        if text_content:
            msg.attach(MIMEText(text_content, 'plain'))
        msg.attach(MIMEText(html_content, 'html'))
        
        try:
            with smtplib.SMTP(self.host, self.port) as server:
                if self.use_tls:
                    server.starttls()
                server.login(self.user, self.password)
                server.send_message(msg)
            return True
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    def send_password_reset(self, to_email: str, reset_url: str) -> bool:
        template = """
        <h2>密码重置</h2>
        <p>您好，</p>
        <p>请点击以下链接重置您的密码：</p>
        <p><a href="{{ reset_url }}">{{ reset_url }}</a></p>
        <p>此链接有效期为 1 小时。</p>
        <p>如果您没有请求重置密码，请忽略此邮件。</p>
        """
        html_content = Template(template).render(reset_url=reset_url)
        return self.send_email(
            to_email=to_email,
            subject="[HydroSim Portal] 密码重置",
            html_content=html_content
        )
```

### 4.2 审计服务

```python
# services/audit_service.py

from sqlalchemy.orm import Session
from fastapi import Request
from app.models.audit_log import AuditLog

class AuditService:
    def __init__(self, db: Session):
        self.db = db
    
    def log(
        self,
        action: str,
        resource_type: str,
        resource_id: int = None,
        user_id: int = None,
        user_name: str = None,
        details: dict = None,
        request: Request = None
    ):
        log_entry = AuditLog(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            user_name=user_name,
            details=details,
            ip_address=request.client.host if request else None,
            user_agent=request.headers.get("user-agent") if request else None
        )
        self.db.add(log_entry)
        self.db.commit()
        return log_entry

# 使用示例
def create_student(...):
    # ... 创建学生逻辑 ...
    
    audit_service.log(
        action="CREATE",
        resource_type="student",
        resource_id=student.id,
        user_id=current_user.id,
        user_name=current_user.username,
        details={"student_code": student.student_code, "name": student.name},
        request=request
    )
```

---

## 5. API 限流配置

```python
# core/rate_limit.py

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# main.py
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 使用示例
@router.post("/forgot-password/")
@limiter.limit("3/hour")
async def forgot_password(request: Request, ...):
    ...
```

---

*文档结束*
