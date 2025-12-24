import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Button from 'devextreme-react/button'
import Form, { Item as FormItem, Label, RequiredRule } from 'devextreme-react/form'
import { Popup } from 'devextreme-react/popup'
import notify from 'devextreme/ui/notify'

import { studentsApi, Student, DeployParams } from '../api/students'
import DeploymentStatusModal from '../components/DeploymentStatusModal'

const StudentDetailPage = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [student, setStudent] = useState<Student | null>(null)
    const [loading, setLoading] = useState(true)
    const [deployHistory, setDeployHistory] = useState<any[]>([])

    // Deploy Modal State
    const [isDeployPopupVisible, setIsDeployPopupVisible] = useState(false)
    const [isDeployStatusVisible, setIsDeployStatusVisible] = useState(false)
    const [deployForm, setDeployForm] = useState<DeployParams>({ image_tag: 'nginx:alpine' })

    const loadData = async () => {
        if (!id) return
        try {
            setLoading(true)
            const data = await studentsApi.get(parseInt(id)) as unknown as Student
            setStudent(data)

            // Mock History Data
            setDeployHistory([
                { id: 101, status: 'success', image_tag: 'nginx:alpine', created_at: '2024-12-24 10:30:45', duration: '45s', user: '李老师' },
                { id: 100, status: 'failed', image_tag: 'nginx:latest', created_at: '2024-12-23 15:45:12', duration: '12s', user: '系统自动' },
                { id: 99, status: 'success', image_tag: 'nginx:v1.0', created_at: '2024-12-20 09:12:00', duration: '50s', user: '张三' }
            ])
        } catch (err) {
            notify('加载学生详情失败', 'error', 3000)
            navigate('/students')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [id])

    const handleDeploySubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!student) return
        try {
            await studentsApi.deploy(student.id, deployForm)
            setIsDeployPopupVisible(false)
            setIsDeployStatusVisible(true)
            // Add to mock history
            setDeployHistory(prev => [{
                id: Date.now(),
                status: 'processing',
                image_tag: deployForm.image_tag,
                created_at: new Date().toLocaleString('zh-CN'),
                duration: '-',
                user: '李老师'
            }, ...prev])
        } catch (err: any) {
            notify(err.response?.data?.detail || '部署失败', 'error', 3000)
        }
    }

    const handleDeployFormChange = (e: any) => {
        setDeployForm(prev => ({ ...prev, [e.dataField]: e.value }))
    }

    if (loading || !student) {
        return (
            <div className="content-scroll" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: 'var(--text-3)' }}>加载中...</div>
            </div>
        )
    }

    const isRunning = !!student.domain

    return (
        <>
            {/* Page Header */}
            <div style={{
                background: 'var(--bg-white)',
                padding: 24,
                borderBottom: '1px solid var(--border-color)'
            }}>
                {/* Breadcrumb */}
                <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-3)' }}>
                    <a
                        onClick={() => navigate('/students')}
                        style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }}
                    >
                        项目列表
                    </a>
                    <span style={{ margin: '0 8px' }}>/</span>
                    <span style={{ color: 'var(--text-2)' }}>详情</span>
                </div>

                {/* Title Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                        {student.name}的{student.project_type === 'gd' ? '毕业设计' : '课程设计'}
                        <span style={{
                            fontSize: 12, background: 'var(--fill-1)', color: 'var(--text-2)',
                            padding: '2px 8px', borderRadius: 2, fontFamily: 'monospace'
                        }}>
                            ID: {student.student_code}
                        </span>
                    </h1>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-default" onClick={() => notify('编辑功能开发中', 'info', 2000)}>编辑配置</button>
                        <button className="btn btn-primary" onClick={() => setIsDeployPopupVisible(true)}>部署新版本</button>
                        {student.domain && (
                            <button className="btn btn-default" onClick={() => window.open(`http://${student.domain}`, '_blank')}>访问网站</button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, maxWidth: 1200, margin: '0 auto' }}>

                {/* Config Card */}
                <div className="modern-card">
                    <div className="card-header">
                        <span className="card-title">配置信息 (Configuration)</span>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>学生姓名</div>
                                <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 500 }}>{student.name}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>项目类型</div>
                                <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 500 }}>
                                    {student.project_type === 'gd' ? '毕业设计 (Graduation Project)' : '课程设计 (Course Design)'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>Git 仓库地址</div>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>
                                    {student.git_repo_url ? (
                                        <a href={student.git_repo_url} target="_blank" rel="noreferrer" className="link-text">
                                            {student.git_repo_url}
                                        </a>
                                    ) : (
                                        <span style={{ color: 'var(--text-4)' }}>未配置</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>分配域名</div>
                                <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 500 }}>
                                    {student.domain || <span style={{ color: 'var(--text-4)' }}>未分配</span>}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>当前镜像 Tag</div>
                                <div style={{
                                    fontSize: 14, fontWeight: 500, fontFamily: 'monospace',
                                    background: 'var(--fill-2)', padding: '2px 6px', borderRadius: 2, display: 'inline-block'
                                }}>
                                    {deployForm.image_tag}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>容器端口</div>
                                <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 500 }}>80 (http)</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Card */}
                <div className="modern-card">
                    <div className="card-header">
                        <span className="card-title">当前状态 (Health)</span>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                        <div style={{
                            width: 100, height: 100, borderRadius: '50%',
                            border: `4px solid ${isRunning ? 'var(--success-1)' : 'var(--fill-2)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 48, color: isRunning ? 'var(--success-6)' : 'var(--text-3)',
                            marginBottom: 16
                        }}>
                            {isRunning ? '✔' : '⏳'}
                        </div>
                        <div style={{
                            fontWeight: 600, fontSize: 18,
                            color: isRunning ? 'var(--success-6)' : 'var(--text-3)'
                        }}>
                            {isRunning ? 'RUNNING' : 'PENDING'}
                        </div>
                        <p style={{ marginTop: 16, color: 'var(--text-3)', textAlign: 'center', fontSize: 13 }}>
                            {isRunning ? (
                                <>服务运行正常<br />已持续运行 4 天 12 小时</>
                            ) : (
                                '等待首次部署'
                            )}
                        </p>
                    </div>
                </div>

                {/* History Card (Full Width) */}
                <div className="modern-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header">
                        <span className="card-title">部署历史 (History)</span>
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>部署时间</th>
                                <th>版本 Tag</th>
                                <th>耗时</th>
                                <th>触发人</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deployHistory.map((record) => (
                                <tr key={record.id}>
                                    <td>{record.created_at}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{record.image_tag}</td>
                                    <td>{record.duration}</td>
                                    <td>{record.user}</td>
                                    <td>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: 2, fontSize: 12, fontWeight: 500,
                                            background: record.status === 'success' ? 'var(--success-1)' : (record.status === 'failed' ? 'var(--danger-1)' : 'var(--primary-1)'),
                                            color: record.status === 'success' ? 'var(--success-6)' : (record.status === 'failed' ? 'var(--danger-6)' : 'var(--primary-6)')
                                        }}>
                                            {record.status === 'success' ? '成功' : (record.status === 'failed' ? '失败' : '部署中')}
                                        </span>
                                    </td>
                                    <td>
                                        <a className="link-text" onClick={() => notify('日志查看功能开发中', 'info', 2000)}>查看日志</a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Deploy Config Modal */}
            <Popup
                visible={isDeployPopupVisible}
                onHiding={() => setIsDeployPopupVisible(false)}
                title="部署项目"
                showTitle={true}
                dragEnabled={false}
                width={400}
                height="auto"
            >
                <form onSubmit={handleDeploySubmit}>
                    <p style={{ marginBottom: 20, color: 'var(--text-2)' }}>
                        将拉取最新镜像并重启容器
                    </p>
                    <Form formData={deployForm} onFieldDataChanged={handleDeployFormChange} labelLocation="top">
                        <FormItem dataField="image_tag" editorType="dxTextBox">
                            <Label text="Docker 镜像 Tag" />
                            <RequiredRule />
                        </FormItem>
                    </Form>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button text="取消" onClick={() => setIsDeployPopupVisible(false)} type="normal" />
                        <Button text="开始部署" useSubmitBehavior={true} type="default" />
                    </div>
                </form>
            </Popup>

            {/* Deployment Status Modal */}
            <DeploymentStatusModal
                visible={isDeployStatusVisible}
                onClose={() => setIsDeployStatusVisible(false)}
                studentName={student?.name}
                domain={student?.domain}
            />
        </>
    )
}

export default StudentDetailPage
