import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Popup } from 'devextreme-react/popup'
import Form, { Item as FormItem, Label, RequiredRule } from 'devextreme-react/form'
import Button from 'devextreme-react/button'
import notify from 'devextreme/ui/notify'

import { studentsApi, Student } from '../api/students'
import DeploymentStatusModal from '../components/DeploymentStatusModal'

const StudentsPage = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [students, setStudents] = useState<Student[]>([])

    // Filters
    const [searchText, setSearchText] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'gd' | 'cd'>('all')
    const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'failed' | 'deploying' | 'pending'>('all')

    // Modals
    const [isCreatePopupVisible, setIsCreatePopupVisible] = useState(false)
    const [isDeployConfigVisible, setIsDeployConfigVisible] = useState(false)
    const [isDeployStatusVisible, setIsDeployStatusVisible] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

    // Forms
    const [studentForm, setStudentForm] = useState({
        student_code: '',
        name: '',
        project_type: 'gd',
        git_repo_url: ''
    })
    const [deployForm, setDeployForm] = useState({
        image_tag: 'nginx:alpine'
    })

    // Load Data
    const loadData = async () => {
        try {
            const data = await studentsApi.list() as unknown as Student[]
            setStudents(data)
        } catch (err) {
            notify('加载数据失败', 'error', 2000)
        }
    }

    useEffect(() => {
        loadData()
        const statusParam = searchParams.get('status')
        if (statusParam && ['all', 'running', 'failed', 'pending'].includes(statusParam)) {
            setStatusFilter(statusParam as any)
        }
    }, [searchParams])

    // --- Actions ---
    const handleCreateStudent = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await studentsApi.create({
                ...studentForm,
                project_type: studentForm.project_type as 'gd' | 'cd'
            })
            notify('学生项目创建成功', 'success', 2000)
            setIsCreatePopupVisible(false)
            loadData()
            setStudentForm({ student_code: '', name: '', project_type: 'gd', git_repo_url: '' })
        } catch (err: any) {
            notify(err.response?.data?.detail || '创建失败', 'error', 3000)
        }
    }

    const handleDeploySubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedStudent) return
        try {
            await studentsApi.deploy(selectedStudent.id, deployForm)
            setIsDeployConfigVisible(false)
            setIsDeployStatusVisible(true)
            loadData()
        } catch (err: any) {
            notify(err.response?.data?.detail || '部署失败', 'error', 3000)
        }
    }

    const openDeployPopup = (student: Student) => {
        setSelectedStudent(student)
        setIsDeployConfigVisible(true)
    }

    // --- Helpers ---
    const getStatus = (student: Student): 'running' | 'pending' | 'failed' => {
        if (student.domain) return 'running'
        return 'pending'
    }

    const getStatusText = (student: Student) => {
        if (student.domain) return '运行中'
        return '待部署'
    }

    const getStatusClass = (student: Student) => {
        if (student.domain) return 'st-success'
        return 'st-waiting'
    }

    // Filter Logic
    const filteredStudents = students.filter(s => {
        const matchesSearch =
            s.name.toLowerCase().includes(searchText.toLowerCase()) ||
            s.student_code.toLowerCase().includes(searchText.toLowerCase())
        const matchesType = typeFilter === 'all' || s.project_type === typeFilter
        const matchesStatus = statusFilter === 'all' || getStatus(s) === statusFilter
        return matchesSearch && matchesType && matchesStatus
    })

    const handleStudentFormChange = (e: any) => {
        setStudentForm(prev => ({ ...prev, [e.dataField]: e.value }))
    }

    const handleDeployFormChange = (e: any) => {
        setDeployForm(prev => ({ ...prev, [e.dataField]: e.value }))
    }

    return (
        <>
            {/* Top Bar */}
            <div className="top-bar">
                <h1 className="page-title">学生项目列表</h1>
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>共 {students.length} 个项目</div>
            </div>

            {/* Content */}
            <div className="content-scroll">
                <div className="modern-card">
                    {/* Filter Bar */}
                    <div style={{
                        padding: '16px 24px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <input
                                type="text"
                                placeholder="搜索学生姓名、学号或项目ID"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                style={{
                                    height: 32, width: 240, padding: '0 12px',
                                    border: '1px solid var(--border-color)', borderRadius: 2,
                                    fontSize: 13, outline: 'none'
                                }}
                            />
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value as any)}
                                style={{
                                    height: 32, width: 120, padding: '0 8px',
                                    border: '1px solid var(--border-color)', borderRadius: 2,
                                    fontSize: 13, color: 'var(--text-2)'
                                }}
                            >
                                <option value="all">所有类型</option>
                                <option value="gd">毕业设计</option>
                                <option value="cd">课程设计</option>
                            </select>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                style={{
                                    height: 32, width: 120, padding: '0 8px',
                                    border: '1px solid var(--border-color)', borderRadius: 2,
                                    fontSize: 13, color: 'var(--text-2)'
                                }}
                            >
                                <option value="all">所有状态</option>
                                <option value="running">运行中</option>
                                <option value="failed">异常</option>
                                <option value="pending">待部署</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn btn-default" onClick={loadData}>刷新</button>
                            <button className="btn btn-primary" onClick={() => setIsCreatePopupVisible(true)}>+ 新建项目</button>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 200 }}>学生信息</th>
                                <th style={{ width: 120 }}>项目类型</th>
                                <th>访问域名 (Domain)</th>
                                <th style={{ width: 140 }}>当前状态</th>
                                <th style={{ width: 180 }}>更新时间</th>
                                <th style={{ width: 180, textAlign: 'right' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.map((student) => (
                                <tr key={student.id}>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 500 }}>{student.name}</span>
                                            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'monospace' }}>{student.student_code}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`tag ${student.project_type === 'gd' ? 'tag-blue' : 'tag-gray'}`}>
                                            {student.project_type === 'gd' ? '毕业设计' : '课程设计'}
                                        </span>
                                    </td>
                                    <td>
                                        {student.domain ? (
                                            <a className="link-text" href={`http://${student.domain}`} target="_blank" rel="noreferrer">
                                                {student.domain}
                                            </a>
                                        ) : (
                                            <span style={{ color: 'var(--text-4)' }}>-</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${getStatusClass(student)}`}>
                                            <span className="dot"></span>
                                            {getStatusText(student)}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-3)', fontSize: 13 }}>
                                        {student.created_at ? new Date(student.created_at).toLocaleString('zh-CN') : '-'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
                                            <a className="link-text" onClick={() => navigate(`/students/${student.id}`)}>详情</a>
                                            <a className="link-text" onClick={() => openDeployPopup(student)}>
                                                {student.domain ? '重新部署' : '立即部署'}
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredStudents.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
                                        暂无数据
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Simple Pagination */}
                    <div style={{
                        padding: '16px 24px',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 8,
                        fontSize: 13,
                        color: 'var(--text-2)'
                    }}>
                        共 {filteredStudents.length} 条记录
                    </div>
                </div>
            </div>

            {/* Create Project Modal */}
            <Popup
                visible={isCreatePopupVisible}
                onHiding={() => setIsCreatePopupVisible(false)}
                title="新建学生项目"
                showTitle={true}
                dragEnabled={false}
                width={500}
                height={450}
            >
                <form onSubmit={handleCreateStudent}>
                    <Form formData={studentForm} onFieldDataChanged={handleStudentFormChange} labelLocation="top">
                        <FormItem dataField="student_code" editorType="dxTextBox">
                            <Label text="学号 (Student ID)" />
                            <RequiredRule message="请输入学号" />
                        </FormItem>
                        <FormItem dataField="name" editorType="dxTextBox">
                            <Label text="姓名 (Name)" />
                            <RequiredRule message="请输入姓名" />
                        </FormItem>
                        <FormItem
                            dataField="project_type"
                            editorType="dxSelectBox"
                            editorOptions={{
                                items: [{ id: 'gd', text: '毕业设计 (Graduation Design)' }, { id: 'cd', text: '课程设计 (Course Design)' }],
                                displayExpr: 'text',
                                valueExpr: 'id'
                            }}
                        >
                            <Label text="项目类型" />
                            <RequiredRule />
                        </FormItem>
                        <FormItem dataField="git_repo_url" editorType="dxTextBox">
                            <Label text="Git 仓库地址 (可选)" />
                        </FormItem>
                    </Form>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button text="取消" onClick={() => setIsCreatePopupVisible(false)} type="normal" />
                        <Button text="创建项目" useSubmitBehavior={true} type="default" />
                    </div>
                </form>
            </Popup>

            {/* Deploy Config Modal */}
            <Popup
                visible={isDeployConfigVisible}
                onHiding={() => setIsDeployConfigVisible(false)}
                title="部署项目"
                showTitle={true}
                dragEnabled={false}
                width={400}
                height="auto"
            >
                <form onSubmit={handleDeploySubmit}>
                    <div style={{ marginBottom: 20 }}>
                        <p style={{ margin: '0 0 10px', color: 'var(--text-1)' }}>
                            准备部署 <strong>{selectedStudent?.name}</strong> 的项目
                        </p>
                    </div>
                    <Form formData={deployForm} onFieldDataChanged={handleDeployFormChange} labelLocation="top">
                        <FormItem dataField="image_tag" editorType="dxTextBox">
                            <Label text="Docker 镜像 Tag" />
                            <RequiredRule />
                        </FormItem>
                    </Form>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button text="取消" onClick={() => setIsDeployConfigVisible(false)} type="normal" />
                        <Button text="开始部署" useSubmitBehavior={true} type="default" />
                    </div>
                </form>
            </Popup>

            {/* Deployment Status Modal */}
            <DeploymentStatusModal
                visible={isDeployStatusVisible}
                onClose={() => setIsDeployStatusVisible(false)}
                studentName={selectedStudent?.name}
                domain={selectedStudent?.domain}
            />
        </>
    )
}

export default StudentsPage
