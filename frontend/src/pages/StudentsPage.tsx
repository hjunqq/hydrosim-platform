import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DataGrid, { Column, FilterRow, Paging, SearchPanel } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup'
import Form, { Item as FormItem, Label, RequiredRule } from 'devextreme-react/form'
import Button from 'devextreme-react/button'
import notify from 'devextreme/ui/notify'
import { confirm } from 'devextreme/ui/dialog'

import { studentsApi, Student } from '../api/students'
import { deploymentsApi } from '../api/deployments'
import { buildConfigsApi } from '../api/buildConfigs'
import { buildsApi, Build } from '../api/builds'
import DeploymentStatusModal from '../components/DeploymentStatusModal'
import BuildConfigModal from '../components/BuildConfigModal'
import BuildHistoryModal from '../components/BuildHistoryModal'
import BuildStatusModal from '../components/BuildStatusModal'

const StudentsPage = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [students, setStudents] = useState<Student[]>([])


    // Modals
    const [isCreatePopupVisible, setIsCreatePopupVisible] = useState(false)
    const [isDeployConfigVisible, setIsDeployConfigVisible] = useState(false)
    const [isDeployStatusVisible, setIsDeployStatusVisible] = useState(false)
    const [isBuildConfigVisible, setIsBuildConfigVisible] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [isBuildHistoryVisible, setIsBuildHistoryVisible] = useState(false)
    const [historyStudent, setHistoryStudent] = useState<Student | null>(null)
    const [isBuildStatusVisible, setIsBuildStatusVisible] = useState(false)
    const [buildStatusStudent, setBuildStatusStudent] = useState<Student | null>(null)
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
            }) as unknown as any

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
                    notify(cfgErr.response?.data?.detail || '构建配置保存失败', 'warning', 2000)
                }
            } else if (create_build_config && !studentForm.git_repo_url) {
                notify('未填写 Git 仓库，无法创建构建配置', 'warning', 3000)
            }

            if (generate_deploy_key) {
                if (!studentForm.git_repo_url) {
                    notify('未填写 Git 仓库，无法生成 Deploy Key', 'warning', 3000)
                } else {
                    try {
                        await buildConfigsApi.generateDeployKey(created.id, false, true)
                    } catch (keyErr: any) {
                        notify(keyErr.response?.data?.detail || 'Deploy Key 生成失败', 'warning', 3000)
                    }
                }
            }

            if (trigger_build) {
                try {
                    const build = await buildsApi.triggerBuild(created.id) as unknown as Build
                    setBuildStatusStudent(created as unknown as Student)
                    setBuildPopupBuildId(build.id)
                    setIsBuildStatusVisible(true)
                    notify('构建任务已提交', 'success', 2000)
                } catch (buildErr: any) {
                    await handleBuildError(buildErr, created as unknown as Student)
                }
            }

            notify('项目创建成功', 'success', 2000)
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

    const openBuildConfigPopup = (student: Student) => {
        setSelectedStudent(student)
        setIsBuildConfigVisible(true)
    }

    const openBuildHistoryPopup = (student: Student) => {
        setIsBuildStatusVisible(false);
        setBuildStatusStudent(null);
        setBuildPopupBuildId(null);
        setSelectedStudent(null); // Clear other selections
        setHistoryStudent(student);
        setIsBuildHistoryVisible(true);
    };

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
        setIsBuildHistoryVisible(false);
        setSelectedStudent(null);
        setBuildStatusStudent(student);
        setBuildPopupBuildId(null);
        try {
            const build = await buildsApi.triggerBuild(student.id) as unknown as Build;
            setBuildPopupBuildId(build.id);
            setIsBuildStatusVisible(true);
            notify('构建任务已提交', 'success', 2000);
        } catch (err: any) {
            await handleBuildError(err, student);
            setIsBuildStatusVisible(false);
        }
    };

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

    const closeBuildStatusModal = () => {
        setIsBuildStatusVisible(false);
    }

    const closeBuildHistoryModal = () => {
        setIsBuildHistoryVisible(false);
    }

    const handleStudentFormChange = (e: any) => {
        setStudentForm(prev => ({ ...prev, [e.dataField]: e.value }))
    }

    const handleDeleteStudent = async (student: Student) => {
        const displayName = student.name || student.student_code
        const ok = await confirm(`确认删除项目 "${displayName}"？`, '删除确认')
        if (!ok) return
        try {
            await studentsApi.delete(student.id)
            notify('项目已删除', 'success', 2000)
            loadData()
        } catch (err: any) {
            notify(err.response?.data?.detail || '删除失败', 'error', 3000)
        }
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
                            width={600}
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
                                        icon="toolbox"
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
                                    <Button
                                        text="删除"
                                        icon="trash"
                                        type="danger"
                                        stylingMode="outlined"
                                        onClick={() => handleDeleteStudent(data.data)}
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
            <Popup
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
                            <Label text="学号 (Student ID)" />
                            <RequiredRule message="学号不能为空" />
                        </FormItem>
                        <FormItem dataField="name" editorType="dxTextBox">
                            <Label text="姓名 (Name)" />
                            <RequiredRule message="姓名不能为空" />
                        </FormItem>
                        <FormItem
                            dataField="project_type"
                            editorType="dxSelectBox"
                            editorOptions={{
                                items: [
                                    { id: 'gd', text: '毕业设计 (Graduation Design)' },
                                    { id: 'cd', text: '课程设计 (Course Design)' }
                                ],
                                displayExpr: 'text',
                                valueExpr: 'id'
                            }}
                        >
                            <Label text="项目类型" />
                            <RequiredRule />
                        </FormItem>
                        <FormItem dataField="git_repo_url" editorType="dxTextBox">
                            <Label text="Git 仓库 (可选)" />
                        </FormItem>
                        <FormItem dataField="expected_image_name" editorType="dxTextBox">
                            <Label text="预期镜像名 (可选)" />
                        </FormItem>
                        <FormItem itemType="group" caption="构建与部署">
                            <FormItem
                                dataField="create_build_config"
                                editorType="dxCheckBox"
                                editorOptions={{ text: '创建构建配置' }}
                            />
                            <FormItem
                                dataField="generate_deploy_key"
                                editorType="dxCheckBox"
                                editorOptions={{ text: '生成 Deploy Key' }}
                            />
                            <FormItem
                                dataField="trigger_build"
                                editorType="dxCheckBox"
                                editorOptions={{ text: '创建后触发构建' }}
                            />
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
            </Popup>

            {/* Deployment Status Modal */}
            <DeploymentStatusModal
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

            <BuildHistoryModal
                visible={isBuildHistoryVisible}
                onClose={closeBuildHistoryModal}
                studentId={historyStudent?.id}
                studentName={historyStudent?.name}
            />

            <BuildStatusModal
                visible={isBuildStatusVisible}
                onClose={closeBuildStatusModal}
                studentName={buildStatusStudent?.name}
                studentId={buildStatusStudent?.id}
                buildId={buildPopupBuildId}
            />
        </>
    )
}

export default StudentsPage
