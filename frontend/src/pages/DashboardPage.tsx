import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataGrid, { Column } from 'devextreme-react/data-grid'
import Button from 'devextreme-react/button'
import ProgressBar from 'devextreme-react/progress-bar'
import { studentsApi, Student } from '../api/students'
import { monitoringApi, ClusterOverview } from '../api/monitoring'

const DashboardPage = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ total: 0, running: 0, failed: 0, pending: 0 })
  const [recentProjects, setRecentProjects] = useState<Student[]>([])
  const [clusterOverview, setClusterOverview] = useState<ClusterOverview | null>(null)

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

    const fetchOverview = async () => {
      try {
        const overview = await monitoringApi.getOverview()
        setClusterOverview(overview)
      } catch (error) {
        console.error('Failed to load cluster overview', error)
      }
    }

    fetchData()
    fetchOverview()
  }, [])

  const getStatusClass = (student: Student) => {
    if (student.domain) return 'st-success'
    return 'st-waiting'
  }

  const getStatusText = (student: Student) => {
    if (student.domain) return '运行中'
    return '待部署'
  }

  const cpuUsage = clusterOverview?.cpu_percentage
  const cpuUsageValue = typeof cpuUsage === 'number' ? Math.min(100, Math.max(0, cpuUsage)) : 0
  const cpuUsageText = cpuUsage === null || cpuUsage === undefined ? 'N/A' : `${cpuUsage.toFixed(1)}%`
  const clusterStatus = clusterOverview?.status ?? 'Unknown'
  const statusColor = clusterStatus === 'Healthy' ? 'var(--success-6)' : 'var(--warning-6)'
  const healthValue = clusterStatus === 'Healthy' ? 100 : clusterStatus === 'Unknown' ? 40 : 65

  const renderStudentCell = (cellData: { data: Student }) => {
    const student = cellData.data
    return (
      <div className="cell-stack">
        <div className="cell-title">{student.name} ({student.student_code})</div>
        <div className="cell-sub">最后更新: 10分钟前</div>
      </div>
    )
  }

  const renderTypeCell = (cellData: { data: Student }) => (
    <span className={`tag ${cellData.data.project_type === 'gd' ? 'tag-blue' : 'tag-gray'}`}>
      {cellData.data.project_type === 'gd' ? '毕设' : '课设'}
    </span>
  )

  const renderStatusCell = (cellData: { data: Student }) => (
    <span className={`status-badge ${getStatusClass(cellData.data)}`}>
      <span className="dot"></span>
      {getStatusText(cellData.data)}
    </span>
  )

  const renderActionCell = (cellData: { data: Student }) => (
    <Button
      text="管理"
      stylingMode="text"
      onClick={(e) => {
        e.event?.stopPropagation()
        navigate(`/students/${cellData.data.id}`)
      }}
    />
  )

  return (
    <>
      {/* Top Bar */}
      <div className="top-bar">
        <h1 className="page-title">系统总览</h1>
      </div>

      {/* Content */}
      <div className="content-scroll">
        {/* Stats Grid */}
        <div className="grid-stats">
          <div className="stat-card stat-card-primary" onClick={() => navigate('/students')}>
            <div className="stat-header">
              <span className="stat-label">总项目数</span>
              <span className="stat-icon"><i className="dx-icon-chart"></i></span>
            </div>
            <div>
              <span className="stat-value">{stats.total}</span>
              <span className="stat-unit">个</span>
            </div>
            <div className="stat-meta">
              较上周 <span style={{ color: 'var(--success-6)', fontWeight: 600 }}>▲ 12%</span>
            </div>
          </div>

          <div
            className="stat-card stat-card-success"
            onClick={() => navigate('/students?status=running')}
          >
            <div className="stat-header">
              <span className="stat-label">运行中 (Running)</span>
              <span className="stat-icon"><i className="dx-icon-runner"></i></span>
            </div>
            <div>
              <span className="stat-value">{stats.running}</span>
              <span className="stat-unit">个</span>
            </div>
            <div className="stat-meta" style={{ color: 'var(--success-6)' }}>
              系统负载正常
            </div>
          </div>

          <div
            className="stat-card stat-card-danger"
            onClick={() => navigate('/students?status=failed')}
          >
            <div className="stat-header">
              <span className="stat-label">部署失败 (Failed)</span>
              <span className="stat-icon"><i className="dx-icon-warning"></i></span>
            </div>
            <div>
              <span className="stat-value">{stats.failed}</span>
              <span className="stat-unit">个</span>
            </div>
            <div className="stat-meta">亟需处理</div>
          </div>

          <div className="stat-card stat-card-warning" onClick={() => navigate('/students?status=pending')}>
            <div className="stat-header">
              <span className="stat-label">待部署 (Pending)</span>
              <span className="stat-icon"><i className="dx-icon-clock"></i></span>
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
              <Button text="查看全部" stylingMode="text" onClick={() => navigate('/students')} />
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <DataGrid
                dataSource={recentProjects}
                showBorders={false}
                columnAutoWidth={true}
                rowAlternationEnabled={true}
                keyExpr="id"
                noDataText="暂无数据"
              >
                <Column caption="学生信息" cellRender={renderStudentCell} />
                <Column caption="类型" width={100} cellRender={renderTypeCell} />
                <Column caption="状态" width={120} cellRender={renderStatusCell} />
                <Column caption="操作" width={100} cellRender={renderActionCell} />
              </DataGrid>
            </div>
          </div>

          {/* Side Widgets */}
          <div className="panel-stack">
            {/* Quick Actions */}
            <div className="modern-card">
              <div className="card-header">
                <span className="card-title">快捷操作</span>
              </div>
              <div className="card-body panel-stack">
                <div
                  className="quick-action"
                  onClick={() => navigate('/students')}
                >
                  <div className="quick-action-icon"><i className="dx-icon-plus"></i></div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>新建学生项目</div>
                    <div className="cell-sub">录入新的毕设或课设</div>
                  </div>
                </div>
                <div
                  className="quick-action"
                  onClick={() => navigate('/students?status=failed')}
                >
                  <div className="quick-action-icon danger"><i className="dx-icon-warning"></i></div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>处理异常部署</div>
                    <div className="cell-sub">有 {stats.failed} 个项目需要关注</div>
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
                <div className="status-block">
                  <div className="status-row">
                    <span className="status-label">K8s 集群状态</span>
                    <span className="status-value" style={{ color: statusColor }}>{clusterStatus}</span>
                  </div>
                  <ProgressBar
                    className="progress-compact progress-success"
                    min={0}
                    max={100}
                    value={healthValue}
                    showStatus={false}
                  />
                </div>

                <div className="status-block">
                  <div className="status-row">
                    <span className="status-label">节点资源使用率</span>
                    <span className="status-value" style={{ color: 'var(--warning-6)' }}>{cpuUsageText}</span>
                  </div>
                  <ProgressBar
                    className="progress-compact progress-warning"
                    min={0}
                    max={100}
                    value={cpuUsageValue}
                    showStatus={false}
                  />
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
