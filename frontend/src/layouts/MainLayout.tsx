import { useMemo } from 'react'
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom'
import notify from 'devextreme/ui/notify'
import { useAuth } from '../contexts/AuthContext'

const MainLayout = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout } = useAuth()

    const menuItems = [
        { id: 'dashboard', text: '总览', icon: '📊', path: '/dashboard' },
        { id: 'students', text: '学生项目管理', icon: '🎓', path: '/students' },
        { id: 'images', text: '镜像仓库', icon: '📦', path: '#' },
        { id: 'deployments', text: '部署记录', icon: '🚀', path: '#' },
        { id: 'monitoring', text: '资源监控', icon: '⚡', path: '#' },
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
            <aside className="sidebar">
                <div className="logo-area">
                    <div className="logo-icon">H</div>
                    <div className="logo-text">Hydrosim Portal</div>
                </div>

                <nav className="nav-menu">
                    {menuItems.slice(0, 2).map((item) => (
                        <NavLink
                            key={item.id}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-item ${isActive || (item.path !== '#' && location.pathname.startsWith(item.path)) ? 'active' : ''}`
                            }
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.text}
                        </NavLink>
                    ))}

                    <div className="nav-group-title">系统运维</div>
                    {menuItems.slice(2).map((item) => (
                        <a
                            key={item.id}
                            href={item.path}
                            className="nav-item"
                            onClick={(e) => { if (item.path === '#') e.preventDefault(); }}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.text}
                        </a>
                    ))}
                </nav>

                <div className="user-profile">
                    <div className="avatar">{avatarChar}</div>
                    <div className="user-info">
                        <div className="user-name">{user?.username || '教师'}</div>
                        <div className="user-role">管理员</div>
                    </div>
                    <div
                        style={{ cursor: 'pointer', color: 'var(--text-3)', padding: '8px' }}
                        onClick={handleLogout}
                        title="退出登录"
                    >
                        ⋮
                    </div>
                </div>
            </aside>

            {/* Main Workspace */}
            <div className="workspace">
                <Outlet />
            </div>
        </div>
    )
}

export default MainLayout
