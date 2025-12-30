# 教师管理门户前端设计方案

**版本**: 1.0  
**适用角色**: 前端开发工程师、UI 设计师  
**技术栈**: React + DevExtreme

---

## 1. 整体设计风格说明

本设计旨在打造一个**专业、克制、高效**的工程管理系统。
核心理念是“**信息优先，操作直观**”。避免装饰性元素，强调数据的清晰展示和状态的快速识别。

### 1.1 配色方案 (Color Palette)

采用**冷色调/中性色**为主，强调“工程感”。

*   **主色 (Primary Blue)**: `#0056D2` (深邃蓝) - 用于主按钮、选中状态、关键链接。
*   **背景色 (Background)**:
    *   页面背景: `#F4F5F7` (浅灰，降低长期使用的视觉疲劳)
    *   内容卡片背景: `#FFFFFF` (纯白)
*   **文字颜色 (Typography)**:
    *   主要标题: `#172B4D` (近黑深蓝，高对比度)
    *   正文文本: `#42526E` (深灰，阅读舒适)
    *   次要/提示文本: `#6B778C` (中灰)
*   **边框/分隔线**: `#DFE1E6`

### 1.2 字体排印 (Typography)

*   **字体家族**: 优先使用系统无衬线字体。
    `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;`
*   **字号层级**:
    *   一级标题 (Page Title): `24px` / `600`
    *   二级标题 (Section Title): `18px` / `600`
    *   正文 (Body): `14px` / `400` (基础字号)
    *   辅助文字 (Caption): `12px` / `400`

### 1.3 布局与间距 (Layout & Spacing)

*   **栅格**: 采用 8px 栅格系统 (8, 16, 24, 32px)。
*   **卡片**: 统一使用白色卡片承载内容，圆角 `4px`，轻微阴影 `box-shadow: 0 1px 3px rgba(0,0,0,0.1)`。
*   **密度**: 中等偏高 (Compact Mode)，适合表格数据展示，减少无效留白。

---

## 2. 页面布局草图描述

### 2.1 登录页 (Login)
*   **布局**: 居中卡片式布局。背景为深色工程几何图形或纯净的淡灰底色。
*   **卡片内容**:
    *   **顶部**: Logo + 标题“Hydrosim 教学项目管理门户”。
    *   **表单**: 垂直排列的输入框（账号、密码）。输入框高度 `40px`，直角或微圆角 `2px`。
    *   **按钮**: 通栏主色按钮“登录”，高度 `40px`。
    *   **底部**: “忘记密码”链接居中或居右。

### 2.2 主控制台 (Dashboard)
*   **框架**: 经典的 **Left Sidebar + Top Header** 结构。
    *   **Sidebar**: 深色背景 (`#172B4D`)，白色文字。菜单项选中有左侧高亮条。
    *   **Header**: 白色背景，展示面包屑（左）和 用户信息（右）。
*   **内容区**:
    *   **顶部概览**: 4个横向排列的 `InfoCard`。左侧图标，右侧大数字（如 “24”），下方小文字标签（如“运行中项目”）。
        *   运行中: 绿色图标/数字
        *   失败: 红色图标/数字
    *   **最近部署列表**: 一个精简的 `DataGrid`，仅展示“学生、项目、状态、时间”四列。无分页，仅针对最近5-10条。
    *   **快捷入口**: 右上角或单独区域的一组 `Action Buttons`（带图标的次级按钮）。

### 2.3 学生项目列表页 (Project List)
*   **筛选栏 (Toolbar)**: 位于表格上方。包含“搜索框”（左）、“下拉筛选”（项目类型、状态）、“刷新按钮”（右）、“新建按钮”（主色，最右）。
*   **表格区**: 全屏宽度的 `DataGrid`。
    *   **行**: 斑马纹或悬停高亮。
    *   **列操作**: 最后一列为“操作”，包含文字链接按钮 [详情] [部署] [访问]。
    *   **状态列**: 使用 `StatusBadge` 组件。

### 2.4 学生项目详情页 (Project Detail)
*   **头部 (Header)**: 面包屑导航 `< 返回列表`。下方展示项目标题行，右侧放置 [部署] [访问] [编辑] 按钮组。
*   **信息栅格**: 两栏布局。
    *   **左栏 (2/3)**: “配置信息”卡片。表单只读态展示（Label: Value）。
    *   **右栏 (1/3)**: “项目概况”卡片（学生信息、类型、当前大状态图标）。
*   **部署历史**: 下方宽栏卡片，展示历史部署记录表格。

### 2.5 部署记录/状态弹窗 (Deployment Modal)
*   **容器**: 标准 `Popup` (宽 600px)。
*   **头部**: 标题“正在部署... / 部署详情”。
*   **主体**:
    *   **进度条/步骤条 (Stepper)**: 准备 -> 构建 -> 启动 -> 检测。
    *   **日志窗口 (Log Viewer)**: 黑色背景 (`#1E1E1E`)，等宽字体 `Consolas`，灰色文字。固定高度，可滚动。
*   **底部**: 
    *   运行中: [后台运行] (关闭弹窗但后台继续)
    *   失败: [重试] [关闭]
    *   成功: [访问项目] [关闭]

---

## 3. 推荐组件风格 (Based on DevExtreme)

直接复用并定制 `DevExtreme React` 组件，保持一致性。

| 逻辑组件 | 推荐 DevExtreme 组件 | 样式定制建议 |
| :--- | :--- | :--- |
| **表格** | `DataGrid` | `showBorders={true}`, `rowAlternationEnabled={true}`. 禁用过多的表头滤镜，使用外部 Toolbar 筛选以保持整洁。 |
| **按钮** | `Button` | Main: `type="default"` (Blue); Secondary: `type="normal"`. `stylingMode="contained"` 或 `outlined`。 |
| **输入框** | `TextBox` / `SelectBox` | `stylingMode="outlined"`. 统一高度 `36px`。 |
| **弹窗** | `Popup` | `showTitle={true}`, `dragEnabled={false}`. 遮罩透明度 `0.5`。 |
| **日期** | `DateBox` | `type="datetime"`, `displayFormat="yyyy-MM-dd HH:mm"`. |
| **标签** | `LoadIndicator` | 用于部署中的状态展示。 |

### 自定义组件：StatusBadge (状态标签)
不直接使用文字，而是封装一个带背景色的圆角标签。
*   **结构**: `<span>` + `padding: 4px 8px` + `border-radius: 4px` + `font-size: 12px`.

---

## 4. 状态颜色规范 (Status Colors)

建立统一的状态语义颜色映射，**严禁混用**。

| 状态语义 | 颜色代码 (Hex) | 背景色 (Light) | 应用场景 |
| :--- | :--- | :--- | :--- |
| **运行中 / 成功 (Success)** | `#36B37E` (绿) | `#E3FCEF` | 部署成功、服务正常、Pod Running |
| **处理中 / 进行中 (Processing)** | `#0065FF` (蓝) | `#DEEBFF` | 部署中、构建中、Pulling Image |
| **失败 / 错误 (Error)** | `#FF5630` (红) | `#FFEBE6` | 部署失败、CrashLoopBackOff、校验不通过 |
| **待处理 / 未知 (Neutral)** | `#6B778C` (灰) | `#DFE1E6` | 待部署、停止、草稿 |
| **警告 (Warning)** | `#FFAB00` (黄) | `#FFFAE6` | 资源告警、非关键错误 |

**及前端 CSS 变量定义建议**:
```css
:root {
  --color-success: #36B37E;
  --color-success-bg: #E3FCEF;
  --color-info: #0065FF;
  --color-info-bg: #DEEBFF;
  --color-error: #FF5630;
  --color-error-bg: #FFEBE6;
  --color-neutral: #6B778C;
  --color-neutral-bg: #DFE1E6;
}
```

---

## 5. 前端设计语言摘要 (For Developer)

**开发原则**:
1.  **Readability First**: 表格数据尽量避免折行，关键列（状态、操作）定宽。
2.  **Feedback**: 所有的点击操作必须有反馈（Loading 状态或 Toast 提示）。
3.  **Consistency**: 所有页面的“标题区”高度和排版保持一致。

**DevExtreme Theme 配置**:
建议使用 `Material Compact` 或 `Generic Light` 主题作为基底，并覆盖 `--base-accent` 为 `#0056D2`。

**Icon System**:
使用 DevExtreme 自带图标库，保持风格统一。
*   Edit: `edit`
*   Deploy: `upload` 或 `runner`
*   Delete: `trash`
*   View/Visit: `globe` or `link`

---
*End of Design Specification*
