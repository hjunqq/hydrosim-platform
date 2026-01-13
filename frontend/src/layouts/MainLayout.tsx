import { useState, useEffect } from 'react'
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom'
import notify from 'devextreme/ui/notify'
import { useAuth } from '../contexts/AuthContext'
import ThemeToggle from '../components/ThemeToggle'

const MainLayout = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout } = useAuth()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false)
    }, [location.pathname])

    // Close sidebar on window resize to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 768) {
                setSidebarOpen(false)
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const menuItems = [
        { id: 'dashboard', text: '总览', icon: 'dx-icon-chart', path: '/dashboard', roles: ['admin', 'teacher', 'student'] },
        { id: 'students', text: '学生项目管理', icon: 'dx-icon-group', path: '/students', roles: ['admin', 'teacher'] },
        { id: 'deployments', text: '部署记录', icon: 'dx-icon-box', path: '/deployments', roles: ['admin', 'teacher'] },
    ]

    const handleLogout = () => {
        logout()
        notify('已退出登录', 'success', 2000)
        navigate('/login')
    }

    // Get display name - first character for avatar
    const avatarChar = user?.username?.charAt(0)?.toUpperCase() || 'U'

    return (
        <div className="app-shell">
            {/* Mobile Overlay */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
                <div className="logo-area">
                    <div className="logo-icon">H</div>
                    <div className="logo-text">Hydrosim Portal</div>
                </div>

                <nav className="nav-menu">
                    {/* Common Menu */}
                    {menuItems.filter(i => !i.roles || i.roles.includes(user?.role || '')).map((item) => (
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

                    {/* Student My Project */}
                    {user?.role === 'student' && (
                        <NavLink to={`/projects/me/status`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon"><i className="dx-icon-product"></i></span>
                            我的项目
                        </NavLink>
                    )}

                    {/* Admin/Teacher Resource Monitoring */}
                    {(user?.role === 'admin' || user?.role === 'teacher') && (
                        <>
                            <div className="nav-group-title">系统运维</div>
                            {user?.role === 'admin' && (
                                <>
                                    <NavLink to="/admin/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                        <span className="nav-icon"><i className="dx-icon-folder"></i></span>
                                        全局项目
                                    </NavLink>
                                    <NavLink to="/admin/accounts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                        <span className="nav-icon"><i className="dx-icon-group"></i></span>
                                        账号管理
                                    </NavLink>
                                    <NavLink to="/admin/registry" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                        <span className="nav-icon"><i className="dx-icon-datapie"></i></span>
                                        镜像仓库
                                    </NavLink>
                                    <NavLink to="/admin/audit" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                        <span className="nav-icon"><i className="dx-icon-clock"></i></span>
                                        审计日志
                                    </NavLink>
                                </>
                            )}
                            <NavLink to="/admin/monitoring" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <span className="nav-icon"><i className="dx-icon-datatrending"></i></span>
                                资源监控
                            </NavLink>
                        </>
                    )}
                </nav>
            </aside>

            {/* Main Workspace */}
            <div className="workspace">
                {/* Global Header */}
                <header className="global-header">
                    <div className="header-left">
                        {/* Mobile menu toggle */}
                        <button
                            className="menu-toggle-btn"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            title="菜单"
                        >
                            <i className="dx-icon-menu" aria-hidden="true"></i>
                        </button>
                    </div>

                    <div className="header-right">
                        <ThemeToggle />
                        <button className="header-icon-btn" title="帮助文档" onClick={() => navigate('/help/system')}>
                            <i className="dx-icon-help" aria-hidden="true"></i>
                        </button>

                        {user?.role === 'admin' && (
                            <button className="header-icon-btn" title="系统设置" onClick={() => navigate('/admin/settings')}>
                                <i className="dx-icon-optionsgear" aria-hidden="true"></i>
                            </button>
                        )}

                        <div className="header-user" title="个人中心" onClick={() => navigate('/profile')}>
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
                </header>

                <div className="content-area" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <Outlet />
                </div>
            </div>
        </div>
    )
}

export default MainLayout
