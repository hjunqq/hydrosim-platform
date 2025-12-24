import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { studentsApi, Student } from '../api/students'

const DashboardPage = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ total: 0, running: 0, failed: 0, pending: 0 })
  const [recentProjects, setRecentProjects] = useState<Student[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await studentsApi.list() as unknown as Student[]

        // Calculate Stats
        const total = data.length
        const running = data.filter((s) => s.domain).length
        const failed = 0 // Mock
        const pending = total - running - failed

        setStats({ total, running, failed, pending })
        setRecentProjects(data.slice(0, 5))
      } catch (error) {
        console.error('Failed to load dashboard data', error)
      }
    }
    fetchData()
  }, [])

  const getStatusClass = (student: Student) => {
    if (student.domain) return 'st-success'
    return 'st-waiting'
  }

  const getStatusText = (student: Student) => {
    if (student.domain) return '运行中'
    return '待部署'
  }

  return (
    <>
      {/* Top Bar */}
      <div className="top-bar">
        <h1 className="page-title">系统总览</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-default">帮助文档</button>
          <button className="btn btn-default">系统设置</button>
        </div>
      </div>

      {/* Content */}
      <div className="content-scroll">
        {/* Stats Grid */}
        <div className="grid-stats">
          <div className="stat-card" onClick={() => navigate('/students')}>
            <div className="stat-header">
              <span className="stat-label">总项目数</span>
              <span className="stat-icon">📂</span>
            </div>
            <div>
              <span className="stat-value">{stats.total}</span>
              <span className="stat-unit">个</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
              较上周 <span style={{ color: 'var(--success-6)' }}>▲ 12%</span>
            </div>
          </div>

          <div
            className="stat-card"
            style={{ borderTop: '3px solid var(--success-6)' }}
            onClick={() => navigate('/students?status=running')}
          >
            <div className="stat-header">
              <span className="stat-label">运行中 (Running)</span>
              <span style={{ color: 'var(--success-6)' }}>●</span>
            </div>
            <div>
              <span className="stat-value" style={{ color: 'var(--success-6)' }}>{stats.running}</span>
              <span className="stat-unit">个</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--success-6)' }}>
              系统负载正常
            </div>
          </div>

          <div
            className="stat-card"
            style={{ borderTop: '3px solid var(--danger-6)' }}
            onClick={() => navigate('/students?status=failed')}
          >
            <div className="stat-header">
              <span className="stat-label">部署失败 (Failed)</span>
              <span style={{ color: 'var(--danger-6)' }}>⚠️</span>
            </div>
            <div>
              <span className="stat-value" style={{ color: 'var(--danger-6)' }}>{stats.failed}</span>
              <span className="stat-unit">个</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
              亟需处理
            </div>
          </div>

          <div className="stat-card" onClick={() => navigate('/students?status=pending')}>
            <div className="stat-header">
              <span className="stat-label">待部署 (Pending)</span>
              <span className="stat-icon">⏳</span>
            </div>
            <div>
              <span className="stat-value">{stats.pending}</span>
              <span className="stat-unit">个</span>
            </div>
          </div>
        </div>

        {/* Split Layout */}
        <div className="grid-2-1">
          {/* Recent Projects */}
          <div className="modern-card">
            <div className="card-header">
              <span className="card-title">最近活跃项目</span>
              <span><a className="link-text" onClick={() => navigate('/students')}>查看全部</a></span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>学生信息</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {recentProjects.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{student.name} ({student.code})</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>最后更新: 10分钟前</div>
                    </td>
                    <td>
                      <span className={`tag ${student.project_type === 'gd' ? 'tag-blue' : 'tag-gray'}`}>
                        {student.project_type === 'gd' ? '毕设' : '课设'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(student)}`}>
                        <span className="dot"></span>
                        {getStatusText(student)}
                      </span>
                    </td>
                    <td>
                      <a className="link-text" onClick={() => navigate(`/students/${student.id}`)}>管理</a>
                    </td>
                  </tr>
                ))}
                {recentProjects.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)' }}>暂无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Side Widgets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Quick Actions */}
            <div className="modern-card">
              <div className="card-header">
                <span className="card-title">快捷操作</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 12, border: '1px solid var(--border-color)', borderRadius: 4,
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onClick={() => navigate('/students')}
                  className="quick-item-hover"
                >
                  <div style={{
                    width: 32, height: 32, background: 'var(--primary-1)',
                    color: 'var(--primary-6)', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>+</div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>新建学生项目</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>录入新的毕设或课设</div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 12, border: '1px solid var(--border-color)', borderRadius: 4,
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate('/students?status=failed')}
                >
                  <div style={{
                    width: 32, height: 32, background: 'var(--danger-1)',
                    color: 'var(--danger-6)', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>!</div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>处理异常部署</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>有 {stats.failed} 个项目需要关注</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Status */}
            <div className="modern-card">
              <div className="card-header">
                <span className="card-title">平台状态</span>
              </div>
              <div className="card-body">
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-2)' }}>K8s 集群状态</span>
                  <span style={{ color: 'var(--success-6)' }}>Healthy</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--fill-2)', borderRadius: 2, marginBottom: 20 }}>
                  <div style={{ width: '100%', height: '100%', background: 'var(--success-6)', borderRadius: 2 }}></div>
                </div>

                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-2)' }}>节点资源使用率</span>
                  <span style={{ color: 'var(--warning-6)' }}>78%</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--fill-2)', borderRadius: 2 }}>
                  <div style={{ width: '78%', height: '100%', background: 'var(--warning-6)', borderRadius: 2 }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default DashboardPage
