import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DataGrid, { Column, FilterRow, Paging, SearchPanel } from 'devextreme-react/data-grid'; // Added DataGrid imports
import { Popup } from 'devextreme-react/popup'
import Form, { Item as FormItem, Label, RequiredRule } from 'devextreme-react/form'
import Button from 'devextreme-react/button'
import notify from 'devextreme/ui/notify'
import { confirm } from 'devextreme/ui/dialog'

import { studentsApi, Student } from '../api/students'
import { deploymentsApi } from '../api/deployments'
import { buildConfigsApi } from '../api/buildConfigs'
import { buildsApi } from '../api/builds'
import DeploymentStatusModal from '../components/DeploymentStatusModal'
import BuildConfigModal from '../components/BuildConfigModal'
import BuildHistory from '../components/BuildHistory'
import BuildProgress from '../components/BuildProgress'

const StudentsPage = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [students, setStudents] = useState<Student[]>([])
    const popupContainer = typeof document === 'undefined' ? undefined : document.body

    // Filters
    const [searchText, setSearchText] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'gd' | 'cd'>('all')
    const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'failed' | 'deploying' | 'pending'>('all')

    // Modals
    const [isCreatePopupVisible, setIsCreatePopupVisible] = useState(false)
    const [isDeployConfigVisible, setIsDeployConfigVisible] = useState(false)
    const [isDeployStatusVisible, setIsDeployStatusVisible] = useState(false)
    const [isBuildConfigVisible, setIsBuildConfigVisible] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [buildPopupMode, setBuildPopupMode] = useState<'history' | 'progress' | null>(null)
    const [buildPopupStudent, setBuildPopupStudent] = useState<Student | null>(null)
    const [buildPopupBuildId, setBuildPopupBuildId] = useState<number | null>(null)

    // Forms
    const [studentForm, setStudentForm] = useState({
        student_code: '',
        name: '',
        project_type: 'gd',
        git_repo_url: '',
        expected_image_name: '',
        create_build_config: true,
        generate_deploy_key: true,
        trigger_build: true
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
        const {
            create_build_config,
            generate_deploy_key,
            trigger_build,
            ...payload
        } = studentForm

        try {
            const created = await studentsApi.create({
                ...payload,
                project_type: studentForm.project_type as 'gd' | 'cd'
            })

            if (create_build_config && studentForm.git_repo_url) {
                try {
                    await buildConfigsApi.updateConfig(created.id, {
                        repo_url: studentForm.git_repo_url,
                        branch: 'main',
                        dockerfile_path: 'Dockerfile',
                        context_path: '.',
                        auto_build: true,
                        auto_deploy: true
                    })
                } catch (cfgErr: any) {
                    notify(cfgErr.response?.data?.detail || '????????', 'warning', 2000)
                }
            } else if (create_build_config && !studentForm.git_repo_url) {
                notify('???????????????', 'warning', 3000)
            }

            if (generate_deploy_key) {
                if (!studentForm.git_repo_url) {
                    notify('??????????? Deploy Key', 'warning', 3000)
                } else {
                    try {
                        await buildConfigsApi.generateDeployKey(created.id, false, true)
                    } catch (keyErr: any) {
                        notify(keyErr.response?.data?.detail || 'Deploy Key ????', 'warning', 3000)
                    }
                }
            }

            if (trigger_build) {
                try {
                    const build = await buildsApi.triggerBuild(created.id)
                    setBuildPopupStudent(created)
                    setBuildPopupBuildId(build.id)
                    setBuildPopupMode('progress')
                    notify('???????', 'success', 2000)
                } catch (buildErr: any) {
                    await handleBuildError(buildErr, created)
                }
            }

            notify('????????', 'success', 2000)
            setIsCreatePopupVisible(false)
            loadData()
            setStudentForm({
                student_code: '',
                name: '',
                project_type: 'gd',
                git_repo_url: '',
                expected_image_name: '',
                create_build_config: true,
                generate_deploy_key: true,
                trigger_build: true
            })
        } catch (err: any) {
            notify(err.response?.data?.detail || '????', 'error', 3000)
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

    const openBuildConfigPopup = (student: Student) => {
        setSelectedStudent(student)
        setIsBuildConfigVisible(true)
    }

    const openBuildHistoryPopup = (student: Student) => {
        setBuildPopupStudent(student)
        setBuildPopupBuildId(null)
        setBuildPopupMode('history')
    }

    const getErrorDetail = (err: any) => {
        const detail = err?.response?.data?.detail
        if (!detail) return ''
        return typeof detail === 'string' ? detail : String(detail)
    }

    const handleBuildError = async (err: any, student: Student) => {
        const detail = getErrorDetail(err)
        if (detail.includes('Image repository is not configured')) {
            const ok = await confirm('镜像仓库未配置，是否打开构建配置？', '构建失败')
            if (ok) {
                openBuildConfigPopup(student)
            } else {
                notify('可在系统设置配置默认 Registry。', 'info', 3000)
            }
            return
        }
        notify(detail || '构建失败', 'error', 3000)
    }

    const handleTriggerBuild = async (student: Student) => {
        try {
            const build = await buildsApi.triggerBuild(student.id)
            // ????????????????
            setBuildPopupStudent(student)
            setBuildPopupBuildId(build.id)
            setBuildPopupMode('progress')
            notify('???????', 'success', 2000)
        } catch (err: any) {
            await handleBuildError(err, student)
        }
    }

    const handleDeployLatestBuild = async (student: Student) => {
        try {
            await deploymentsApi.deployFromBuild(student.student_code, {
                project_type: student.project_type
            })
            setSelectedStudent(student)
            setIsDeployStatusVisible(true)
            notify('部署任务已提交', 'success', 2000)
            loadData()
        } catch (err: any) {
            notify(err.response?.data?.detail || '部署失败', 'error', 3000)
        }
    }

    // --- Helpers ---
    const getStatus = (student: Student): 'running' | 'pending' | 'failed' | 'deploying' => {
        switch (student.latest_deploy_status) {
            case 'running':
            case 'success':
                return 'running'
            case 'deploying':
            case 'pending':
                return 'deploying'
            case 'failed':
            case 'error':
                return 'failed'
            default:
                return 'pending'
        }
    }

    const getStatusText = (student: Student) => {
        const status = getStatus(student)
        if (status === 'running') return '运行中'
        if (status === 'deploying') return '部署中'
        if (status === 'failed') return '异常'
        return '待部署'
    }

    const getStatusClass = (student: Student) => {
        const status = getStatus(student)
        if (status === 'running') return 'st-success'
        if (status === 'failed') return 'st-danger'
        if (status === 'deploying') return 'st-waiting'
        return 'st-default'
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

    const closeBuildPopup = () => {
        setBuildPopupMode(null)
        setBuildPopupBuildId(null)
        setBuildPopupStudent(null)
    }

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
                <div>
                    <h1 className="page-title">学生项目列表</h1>
                    <div style={{ fontSize: 13, color: 'var(--text-3)' }}>共 {students.length} 个项目</div>
                </div>
                <div className="panel-actions">
                    <Button
                        text="新建项目"
                        icon="add"
                        type="default"
                        stylingMode="contained"
                        onClick={() => setIsCreatePopupVisible(true)}
                        height={36}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="content-scroll">
                <div className="modern-card">
                    <DataGrid
                        dataSource={students}
                        showBorders={false}
                        focusedRowEnabled={true}
                        columnAutoWidth={false}
                        columnMinWidth={100}
                        allowColumnResizing={true}
                        columnResizingMode="widget"
                        keyExpr="id"
                        rowAlternationEnabled={true}
                        columnHidingEnabled={true}
                        width="100%"
                        wordWrapEnabled={true}
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
                                const status = data.data.latest_deploy_status;
                                const isRunning = status === 'running' || status === 'success';
                                if (!domain || !isRunning) return <span style={{ color: '#ccc' }}>-</span>;
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
                            minWidth={260}
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
                            width={160}
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
                            width={520}
                            fixed={true}
                            fixedPosition="right"
                            alignment="center"
                            cellRender={(data) => (
                                <div className="table-actions">
                                    <Button
                                        text="监控"
                                        icon="chart"
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
                                        icon="upload"
                                        type="default"
                                        stylingMode="outlined"
                                        onClick={() => openDeployPopup(data.data)}
                                        height={24}
                                        style={{ fontSize: 12 }}
                                    />
                                    <Button
                                        text="构建"
                                        icon="refresh"
                                        type="normal"
                                        stylingMode="outlined"
                                        onClick={() => handleTriggerBuild(data.data)}
                                        height={24}
                                        style={{ fontSize: 12 }}
                                    />
                                    <Button
                                        text="构建记录"
                                        icon="event"
                                        type="normal"
                                        stylingMode="outlined"
                                        onClick={() => openBuildHistoryPopup(data.data)}
                                        height={24}
                                        style={{ fontSize: 12 }}
                                    />
                                    <Button
                                        text="部署最新"
                                        icon="arrowup"
                                        type="normal"
                                        stylingMode="outlined"
                                        onClick={() => handleDeployLatestBuild(data.data)}
                                        height={24}
                                        style={{ fontSize: 12 }}
                                    />
                                    <Button
                                        text="配置"
                                        icon="optionsgear"
                                        type="normal"
                                        stylingMode="outlined"
                                        onClick={() => openBuildConfigPopup(data.data)}
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
                position={{ my: 'center', at: 'center', of: window }}
                width={500}
                height={450}
            >
                <form onSubmit={handleCreateStudent}>
                    <Form formData={studentForm} onFieldDataChanged={handleStudentFormChange} labelLocation="top">
                        <FormItem dataField="student_code" editorType="dxTextBox">
                            <Label text="?? (Student ID)" />
                            <RequiredRule message="?????" />
                        </FormItem>
                        <FormItem dataField="name" editorType="dxTextBox">
                            <Label text="?? (Name)" />
                            <RequiredRule message="?????" />
                        </FormItem>
                        <FormItem
                            dataField="project_type"
                            editorType="dxSelectBox"
                            editorOptions={{
                                items: [
                                    { id: 'gd', text: '???? (Graduation Design)' },
                                    { id: 'cd', text: '???? (Course Design)' }
                                ],
                                displayExpr: 'text',
                                valueExpr: 'id'
                            }}
                        >
                            <Label text="????" />
                            <RequiredRule />
                        </FormItem>
                        <FormItem dataField="git_repo_url" editorType="dxTextBox">
                            <Label text="Git ???? (??)" />
                        </FormItem>
                        <FormItem dataField="expected_image_name" editorType="dxTextBox">
                            <Label text="??????? (??)" />
                        </FormItem>
                        <FormItem itemType="group" caption="????">
                            <FormItem
                                dataField="create_build_config"
                                editorType="dxCheckBox"
                                editorOptions={{ text: '??????' }}
                            />
                            <FormItem
                                dataField="generate_deploy_key"
                                editorType="dxCheckBox"
                                editorOptions={{ text: '?? Deploy Key' }}
                            />
                            <FormItem
                                dataField="trigger_build"
                                editorType="dxCheckBox"
                                editorOptions={{ text: '???????' }}
                            />
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
                position={{ my: 'center', at: 'center', of: window }}
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

            <BuildConfigModal
                visible={isBuildConfigVisible}
                onClose={() => setIsBuildConfigVisible(false)}
                studentId={selectedStudent?.id || 0}
                onSaved={loadData}
            />

            <Popup
                visible={buildPopupMode === 'history'}
                onHiding={closeBuildPopup}
                title={`构建记录 - ${buildPopupStudent?.name || ''}`}
                showTitle={true}
                dragEnabled={false}
                shading={true}
                showCloseButton={true}
                container={popupContainer}
                position="center"
                width={900}
                height={520}
            >
                {buildPopupStudent ? (
                    <div style={{ height: '100%' }}>
                        <BuildHistory studentId={buildPopupStudent.id} />
                    </div>
                ) : null}
            </Popup>

            <Popup
                visible={buildPopupMode === 'progress'}
                onHiding={closeBuildPopup}
                title={`构建进度 - ${buildPopupStudent?.name || ''}`}
                showTitle={true}
                dragEnabled={false}
                shading={true}
                showCloseButton={true}
                container={popupContainer}
                position="center"
                width={600}
                height="auto"
            >
                {buildPopupStudent ? (
                    <BuildProgress
                        studentId={buildPopupStudent.id}
                        buildId={buildPopupBuildId}
                    />
                ) : null}
            </Popup>
        </>
    )
}

export default StudentsPage
