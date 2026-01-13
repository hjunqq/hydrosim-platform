# UI/UX 深化设计规范

> **版本**: 2.0  
> **基础文档**: [教师门户设计方案](./teacher_portal_design.md)  
> **创建日期**: 2026-01-13  
> **设计理念**: 专业、克制、高效 + **增加动效与视觉层次**

---

## 1. 设计系统增强

### 1.1 配色系统扩展

在现有配色基础上，增加以下语义化颜色：

```css
:root {
  /* === 现有配色 (保持) === */
  --primary-6: #0B6B77;
  --primary-5: #1297A6;
  --primary-1: #E1F4F6;
  
  /* === 新增:渐变背景 === */
  --gradient-primary: linear-gradient(135deg, #0B6B77 0%, #0B4A7D 100%);
  --gradient-success: linear-gradient(135deg, #1B9A6A 0%, #0D7854 100%);
  --gradient-warning: linear-gradient(135deg, #F08B2D 0%, #D97218 100%);
  --gradient-danger: linear-gradient(135deg, #E5484D 0%, #C93B40 100%);
  
  /* === 新增:阴影层级 === */
  --shadow-xs: 0 1px 2px rgba(11, 31, 42, 0.05);
  --shadow-sm: 0 2px 4px rgba(11, 31, 42, 0.08);
  --shadow-md: 0 4px 12px rgba(11, 31, 42, 0.12);
  --shadow-lg: 0 8px 24px rgba(11, 31, 42, 0.16);
  --shadow-xl: 0 16px 48px rgba(11, 31, 42, 0.20);
  
  /* === 新增:动画曲线 === */
  --ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1);
  --ease-in-out-circ: cubic-bezier(0.85, 0, 0.15, 1);
  --spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  
  /* === 新增:动画时长 === */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
}
```

### 1.2 暗色主题变量

```css
[data-theme="dark"] {
  /* 主色调整 */
  --primary-6: #40C4D4;
  --primary-5: #5DCED9;
  --primary-1: #1A3A3F;
  
  /* 文字颜色 */
  --text-1: #E8EAED;
  --text-2: #BDC1C6;
  --text-3: #9AA0A6;
  --text-4: #5F6368;
  
  /* 背景 */
  --bg-white: #1E1E1E;
  --fill-0: #252525;
  --fill-1: #2A2A2A;
  --fill-2: #333333;
  
  /* 边框 */
  --border-color: #3C4043;
  --border-strong: #5F6368;
  
  /* 阴影 */
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
}
```

---

## 2. 组件设计规范

### 2.1 按钮组件

#### 主按钮 (Primary Button)
```css
.btn-primary {
  background: var(--gradient-primary);
  color: #fff;
  border: none;
  padding: 0 20px;
  height: 36px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out-expo);
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: var(--shadow-xs);
}
```

#### 次要按钮 (Secondary Button)
```css
.btn-secondary {
  background: var(--bg-white);
  color: var(--text-1);
  border: 1px solid var(--border-color);
  transition: all var(--duration-fast) ease;
}

.btn-secondary:hover {
  border-color: var(--primary-6);
  color: var(--primary-6);
  background: var(--primary-1);
}
```

#### 图标按钮 (Icon Button)
```css
.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.btn-icon:hover {
  background: var(--fill-1);
}

.btn-icon.danger:hover {
  background: var(--danger-1);
  color: var(--danger-6);
}
```

---

### 2.2 卡片组件

#### 基础卡片
```css
.card {
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: all var(--duration-normal) var(--ease-out-expo);
}

.card:hover {
  box-shadow: var(--shadow-md);
  border-color: rgba(var(--primary-6-rgb), 0.3);
}
```

#### 统计卡片 (Stat Card)
```css
.stat-card {
  position: relative;
  padding: 20px 24px;
  border-radius: 12px;
  background: var(--bg-white);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out-expo);
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--gradient-primary);
  border-radius: 12px 0 0 12px;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}

.stat-card:hover::before {
  opacity: 1;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-1);
  font-family: 'DIN Alternate', 'Roboto Mono', system-ui;
  letter-spacing: -0.5px;
}

.stat-label {
  font-size: 14px;
  color: var(--text-3);
  margin-top: 4px;
}
```

---

### 2.3 表格组件

#### DataGrid 自定义样式
```css
/* 表头 */
.dx-datagrid-headers {
  background: var(--fill-0);
  border-bottom: 2px solid var(--border-color);
}

.dx-datagrid-headers .dx-header-row > td {
  font-weight: 600;
  color: var(--text-2);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 行悬停 */
.dx-datagrid-rowsview .dx-row:hover {
  background: var(--primary-1) !important;
}

/* 选中行 */
.dx-datagrid-rowsview .dx-selection > td {
  background: var(--primary-1) !important;
  border-color: var(--primary-5) !important;
}

/* 操作列按钮 */
.table-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.table-actions .dx-button {
  min-width: auto;
  padding: 0 8px;
}
```

---

### 2.4 状态徽章

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  transition: all var(--duration-fast) ease;
}

.status-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

/* 运行中 - 脉动动画 */
.status-badge.running .dot {
  background: var(--success-6);
  box-shadow: 0 0 0 0 rgba(27, 154, 106, 0.4);
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(27, 154, 106, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(27, 154, 106, 0); }
  100% { box-shadow: 0 0 0 0 rgba(27, 154, 106, 0); }
}

/* 部署中 - 旋转动画 */
.status-badge.deploying .dot {
  width: 12px;
  height: 12px;
  border: 2px solid var(--primary-1);
  border-top-color: var(--primary-6);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 错误 - 闪烁动画 */
.status-badge.error {
  background: var(--danger-1);
  color: var(--danger-6);
}

.status-badge.error .dot {
  animation: blink 1s steps(1) infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}
```

---

## 3. 页面交互规范

### 3.1 页面切换动画

```css
/* 页面进入动画 */
.page-enter {
  opacity: 0;
  transform: translateY(20px);
}

.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all var(--duration-slow) var(--ease-out-expo);
}

/* 页面离开动画 */
.page-exit {
  opacity: 1;
}

.page-exit-active {
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}
```

### 3.2 弹窗动画

```css
/* 弹窗背景 */
.popup-overlay {
  background: rgba(11, 31, 42, 0.5);
  backdrop-filter: blur(4px);
  animation: fadeIn var(--duration-fast) ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 弹窗主体 */
.popup-content {
  animation: slideUp var(--duration-normal) var(--spring);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

### 3.3 列表动画

```css
/* 列表项依次进入 */
.list-item {
  animation: listItemEnter var(--duration-normal) var(--ease-out-expo);
  animation-fill-mode: both;
}

.list-item:nth-child(1) { animation-delay: 0ms; }
.list-item:nth-child(2) { animation-delay: 50ms; }
.list-item:nth-child(3) { animation-delay: 100ms; }
.list-item:nth-child(4) { animation-delay: 150ms; }
.list-item:nth-child(5) { animation-delay: 200ms; }

@keyframes listItemEnter {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

---

## 4. 空状态与加载设计

### 4.1 骨架屏

```css
.skeleton {
  position: relative;
  overflow: hidden;
  background: var(--fill-1);
  border-radius: 4px;
}

.skeleton::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* 骨架屏变体 */
.skeleton-text { height: 16px; margin-bottom: 8px; }
.skeleton-title { height: 24px; width: 60%; margin-bottom: 16px; }
.skeleton-avatar { width: 40px; height: 40px; border-radius: 50%; }
.skeleton-button { width: 80px; height: 32px; border-radius: 8px; }
```

### 4.2 空状态

```css
.empty-state {
  padding: 48px 24px;
  text-align: center;
}

.empty-state-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 16px;
  background: var(--fill-1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: var(--text-4);
}

.empty-state-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
}

.empty-state-desc {
  font-size: 14px;
  color: var(--text-3);
  margin-bottom: 24px;
}
```

---

## 5. 响应式断点

```css
/* 移动端 */
@media (max-width: 767px) {
  :root {
    --content-padding: 16px;
  }
  
  .sidebar {
    position: fixed;
    left: -240px;
    z-index: 100;
    transition: left var(--duration-normal) var(--ease-out-expo);
  }
  
  .sidebar.open {
    left: 0;
  }
  
  .page-title { font-size: 18px; }
  .stat-value { font-size: 24px; }
  
  .table-actions {
    flex-direction: column;
    gap: 4px;
  }
}

/* 平板 */
@media (min-width: 768px) and (max-width: 1023px) {
  :root {
    --sidebar-width: 200px;
    --content-padding: 24px;
  }
}

/* 桌面 */
@media (min-width: 1024px) {
  :root {
    --sidebar-width: 240px;
    --content-padding: 32px;
  }
}

/* 大屏 */
@media (min-width: 1440px) {
  .content-container {
    max-width: 1400px;
    margin: 0 auto;
  }
}
```

---

## 6. DevExtreme 主题定制

### 6.1 主题配置

```typescript
// main.tsx
import 'devextreme/dist/css/dx.common.css';
import 'devextreme/dist/css/dx.material.blue.light.css';
import themes from 'devextreme/ui/themes';

// 切换主题
function setTheme(isDark: boolean) {
  themes.current(isDark ? 'material.blue.dark' : 'material.blue.light');
}
```

### 6.2 组件默认配置

```typescript
// dx-config.ts
import config from 'devextreme/core/config';

config({
  defaultCurrency: 'CNY',
  editorStylingMode: 'outlined',
  floatingActionButtonConfig: {
    icon: 'add',
    position: { at: 'right bottom', my: 'right bottom', offset: '-24 -24' }
  }
});
```

---

## 7. 图标规范

### 使用 DevExtreme 内置图标

| 用途 | 图标名称 | 示例 |
|------|----------|------|
| 新增 | `add` | 新建项目按钮 |
| 编辑 | `edit` | 编辑配置 |
| 删除 | `trash` | 删除操作 |
| 部署 | `upload` | 部署按钮 |
| 构建 | `toolbox` | 触发构建 |
| 刷新 | `refresh` | 刷新列表 |
| 搜索 | `search` | 搜索框 |
| 设置 | `optionsgear` | 系统设置 |
| 监控 | `chart` | 监控页面 |
| 仓库 | `folder` | 项目管理 |
| 用户 | `user` | 用户信息 |
| 帮助 | `help` | 帮助文档 |
| 成功 | `check` | 成功状态 |
| 错误 | `close` | 错误状态 |
| 警告 | `warning` | 警告提示 |

---

## 8. 无障碍 (Accessibility)

```css
/* 焦点样式 */
:focus-visible {
  outline: 2px solid var(--primary-6);
  outline-offset: 2px;
}

/* 跳过导航链接 */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--primary-6);
  color: white;
  padding: 8px 16px;
  z-index: 1000;
  transition: top var(--duration-fast) ease;
}

.skip-link:focus {
  top: 0;
}

/* 屏幕阅读器专用 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
```

---

*文档结束*
