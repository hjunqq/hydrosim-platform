import { Outlet, useNavigate, NavLink } from 'react-router-dom'
import notify from 'devextreme/ui/notify'
import { useAuth } from '../contexts/AuthContext'

const MainLayout = () => {
    const navigate = useNavigate()
    const { user, logout } = useAuth()

    const menuItems = [
        { id: 'dashboard', text: '总览', icon: 'dx-icon-chart', path: '/dashboard' },
        { id: 'students', text: '学生项目管理', icon: 'dx-icon-group', path: '/students' },
        { id: 'deployments', text: '部署记录', icon: 'dx-icon-box', path: '/deployments' },
    ]

    const handleLogout = () => {
        logout()
        notify('已退出登录', 'success', 2000)
        navigate('/login')
    }

    // Get display name - first character for avatar
    const avatarChar = user?.username?.charAt(0)?.toUpperCase() || '教'

    return (
        <div className="app-shell">
            {/* Sidebar */}
            <aside className="sidebar" >
                <div className="logo-area">
                    <div className="logo-icon">H</div>
                    <div className="logo-text">Hydrosim Portal</div>
                </div>

                <nav className="nav-menu">
                    {/* Common Menu */}
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.id}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-item ${isActive ? 'active' : ''}`
                            }
                        >
                            <span className="nav-icon"><i className={item.icon}></i></span>
                            {item.text}
                        </NavLink>
                    ))}

                    {/* Admin Menu */}
                    {user?.role === 'admin' && (
                        <>
                            <div className="nav-group-title">系统运维</div>
                            <NavLink to="/admin/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <span className="nav-icon"><i className="dx-icon-folder"></i></span>
                                全局项目
                            </NavLink>
                            <NavLink to="/admin/registry" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <span className="nav-icon"><i className="dx-icon-datapie"></i></span>
                                镜像仓库
                            </NavLink>
                            <NavLink to="/admin/monitoring" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <span className="nav-icon"><i className="dx-icon-datatrending"></i></span>
                                资源监控
                            </NavLink>
                        </>
                    )}
                </nav>
            </aside >

            {/* Main Workspace */}
            < div className="workspace" >
                {/* Global Header */}
                < header className="global-header" >
                    <div className="header-left">
                        {/* Placeholder for Breadcrumbs or Page Title if strictly needed globally */}
                    </div>

                    <div className="header-right">
                        <button className="header-icon-btn" title="帮助文档" onClick={() => notify('帮助文档功能开发中...', 'info', 2000)}>
                            <i className="dx-icon-help" aria-hidden="true"></i>
                        </button>

                        {user?.role === 'admin' && (
                            <button className="header-icon-btn" title="系统设置" onClick={() => notify('系统设置功能开发中...', 'info', 2000)}>
                                <i className="dx-icon-optionsgear" aria-hidden="true"></i>
                            </button>
                        )}

                        <div className="header-user" title="用户信息">
                            <div className="header-avatar">{avatarChar}</div>
                            <div className="header-username">{user?.username || '教师'}</div>
                        </div>

                        <button
                            className="header-icon-btn"
                            onClick={handleLogout}
                            title="退出登录"
                            style={{ color: '#F53F3F' }}
                        >
                            <i className="dx-icon-return" aria-hidden="true"></i>
                        </button>
                    </div>
                </header >

                <div className="content-area" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <Outlet />
                </div>
            </div >
        </div >
    )
}

export default MainLayout
