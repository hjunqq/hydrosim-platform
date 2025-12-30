import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DataGrid, { Column, FilterRow, Paging, SearchPanel } from 'devextreme-react/data-grid'; // Added DataGrid imports
import { Popup } from 'devextreme-react/popup'
import Form, { Item as FormItem, Label, RequiredRule } from 'devextreme-react/form'
import Button from 'devextreme-react/button'
import notify from 'devextreme/ui/notify'

import { studentsApi, Student } from '../api/students'
import { deploymentsApi } from '../api/deployments'
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
        git_repo_url: '',
        expected_image_name: ''
    })
    const [deployForm, setDeployForm] = useState({
        image: '',
        project_type: 'gd'
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
            loadData()
            setStudentForm({ student_code: '', name: '', project_type: 'gd', git_repo_url: '', expected_image_name: '' })
        } catch (err: any) {
            notify(err.response?.data?.detail || '创建失败', 'error', 3000)
        }
    }

    const handleDeploySubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedStudent) return
        try {
            await deploymentsApi.triggerDeploy(selectedStudent.student_code, {
                image: deployForm.image,
                project_type: deployForm.project_type as 'gd' | 'cd'
            })
            setIsDeployConfigVisible(false)
            setIsDeployStatusVisible(true)
            loadData()
        } catch (err: any) {
            notify(err.response?.data?.detail || '部署失败', 'error', 3000)
        }
    }

    const openDeployPopup = (student: Student) => {
        setSelectedStudent(student)
        setDeployForm({
            image: '',
            project_type: student.project_type
        })
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
                    <DataGrid
                        dataSource={students}
                        showBorders={false}
                        focusedRowEnabled={true}
                        columnAutoWidth={true}
                        allowColumnResizing={true}
                        columnResizingMode="widget"
                        keyExpr="id"
                        rowAlternationEnabled={true}
                    >
                        <SearchPanel visible={true} width={300} placeholder="搜索项目..." />
                        <FilterRow visible={true} />
                        <Paging defaultPageSize={10} />

                        <Column dataField="student_code" caption="学号" width={120} fixed={true} />
                        <Column dataField="name" caption="姓名" width={120} fixed={true} />
                        <Column
                            dataField="project_type"
                            caption="类型"
                            width={80}
                            cellRender={(d) => (
                                <span className={`tag ${d.value === 'gd' ? 'tag-blue' : 'tag-gray'}`}>
                                    {d.value === 'gd' ? '毕设' : '课设'}
                                </span>
                            )}
                        />

                        <Column
                            caption="Git仓库"
                            width={80}
                            alignment="center"
                            cellRender={(data) => {
                                const url = data.data.git_repo_url;
                                if (!url) return <span style={{ color: '#ccc' }}>-</span>;
                                return (
                                    <a href={url} target="_blank" rel="noopener noreferrer" title="访问代码仓库">
                                        <i className="dx-icon-globe" style={{ fontSize: 18, color: '#1890ff' }}></i>
                                    </a>
                                );
                            }}
                        />

                        <Column
                            caption="门户"
                            width={80}
                            alignment="center"
                            cellRender={(data) => {
                                const domain = data.data.domain;
                                if (!domain) return <span style={{ color: '#ccc' }}>-</span>;
                                const url = domain.startsWith('http') ? domain : `http://${domain}`;
                                return (
                                    <a href={url} target="_blank" rel="noopener noreferrer" title="访问部署门户">
                                        <i className="dx-icon-home" style={{ fontSize: 18, color: '#52c41a' }}></i>
                                    </a>
                                );
                            }}
                        />

                        <Column
                            dataField="running_image"
                            caption="当前运行镜像"
                            minWidth={250}
                            cellRender={(data) => (
                                <div style={{ fontSize: 12, color: '#666', lineHeight: '1.4' }}>
                                    {data.value ? data.value.split('\n').map((img: string, idx: number) => (
                                        <div key={idx} style={{ marginBottom: 2 }}>{img}</div>
                                    )) : '-'}
                                </div>
                            )}
                        />

                        <Column
                            dataField="latest_deploy_status"
                            caption="状态"
                            width={100}
                            cellRender={(cellData) => {
                                const status = cellData.value;
                                let badgeClass = 'st-default';
                                let statusText = '未部署';
                                let color = '#d9d9d9';

                                switch (status) {
                                    case 'running':
                                    case 'success':
                                        badgeClass = 'st-success';
                                        statusText = '运行中';
                                        color = '#52c41a';
                                        break;
                                    case 'deploying':
                                    case 'pending':
                                        badgeClass = 'st-waiting';
                                        statusText = '部署中';
                                        color = '#1890ff';
                                        break;
                                    case 'error':
                                    case 'failed':
                                        badgeClass = 'st-danger';
                                        statusText = '异常';
                                        color = '#ff4d4f';
                                        break;
                                }

                                return (
                                    <span className={`status-badge ${badgeClass}`}>
                                        <span className="dot" style={{ background: color }}></span>
                                        {statusText}
                                    </span>
                                );
                            }}
                        />
                        <Column
                            caption="操作"
                            width={180}
                            fixed={true}
                            fixedPosition="right"
                            alignment="center"
                            cellRender={(data) => (
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                    <Button
                                        text="监控"
                                        type="normal"
                                        stylingMode="outlined"
                                        onClick={(e) => {
                                            e.event?.stopPropagation();
                                            navigate(`/projects/${data.data.id}/status`);
                                        }}
                                        height={24}
                                        style={{ fontSize: 12 }}
                                    />
                                    <Button
                                        text="部署"
                                        type="default"
                                        stylingMode="outlined"
                                        onClick={() => openDeployPopup(data.data)}
                                        height={24}
                                        style={{ fontSize: 12 }}
                                    />
                                </div>
                            )}
                        />
                    </DataGrid>
                </div>
            </div>

            {/* Create Project Modal */}
            < Popup
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
                        <FormItem dataField="expected_image_name" editorType="dxTextBox">
                            <Label text="预期镜像关键词 (可选)" />
                        </FormItem>
                    </Form>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button text="取消" onClick={() => setIsCreatePopupVisible(false)} type="normal" />
                        <Button text="创建项目" useSubmitBehavior={true} type="default" />
                    </div>
                </form>
            </Popup >

            {/* Deploy Config Modal */}
            < Popup
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
                        <FormItem
                            dataField="image"
                            editorType="dxTextBox"
                            editorOptions={{
                                placeholder: 'e.g. registry.example.com/project:v1'
                            }}
                        >
                            <Label text="Docker 镜像 (Image)" />
                            <RequiredRule />
                        </FormItem>
                        <FormItem
                            dataField="project_type"
                            editorType="dxSelectBox"
                            editorOptions={{
                                items: [{ id: 'gd', text: '毕业设计' }, { id: 'cd', text: '课程设计' }],
                                displayExpr: 'text',
                                valueExpr: 'id',
                                disabled: true
                            }}
                        >
                            <Label text="项目类型" />
                        </FormItem>
                    </Form>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button text="取消" onClick={() => setIsDeployConfigVisible(false)} type="normal" />
                        <Button text="开始部署" useSubmitBehavior={true} type="default" />
                    </div>
                </form>
            </Popup >

            {/* Deployment Status Modal */}
            < DeploymentStatusModal
                visible={isDeployStatusVisible}
                onClose={() => setIsDeployStatusVisible(false)}
                studentName={selectedStudent?.name}
                domain={selectedStudent?.domain}
            />
        </>
    )
}

export default StudentsPage
