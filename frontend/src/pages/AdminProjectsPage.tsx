import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DataGrid, { Column, FilterRow, Paging, SearchPanel } from 'devextreme-react/data-grid';
import { adminProjectsApi, AdminProject } from '../api/adminProjects';
import { studentsApi } from '../api/students'; // Added import
import { buildConfigsApi } from '../api/buildConfigs';
import { buildsApi } from '../api/builds';
import { deploymentsApi } from '../api/deployments';
import { Popup } from 'devextreme-react/popup';
import Form, { Item as FormItem, Label, RequiredRule } from 'devextreme-react/form';
import Button from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import BuildConfigModal from '../components/BuildConfigModal';
import BuildHistory from '../components/BuildHistory';
import BuildProgress from '../components/BuildProgress';

const AdminProjectsPage = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<AdminProject[]>([]);
    const [loading, setLoading] = useState(true);
    const popupContainer = typeof document === 'undefined' ? undefined : document.body;

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            setLoading(true);
            const data = await adminProjectsApi.list();
            setProjects(data);
        } catch (error) {
            console.error("Failed to load projects", error);
        } finally {
            setLoading(false);
        }
    };

    const [editingProject, setEditingProject] = useState<Partial<AdminProject>>({});
    const [isPopupVisible, setIsPopupVisible] = useState(false);
    const [isBuildConfigVisible, setIsBuildConfigVisible] = useState(false);
    const [isBuildHistoryVisible, setIsBuildHistoryVisible] = useState(false);
    const [isBuildHistoryReady, setIsBuildHistoryReady] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [isBuildProgressVisible, setIsBuildProgressVisible] = useState(false);
    const [buildProgressStudent, setBuildProgressStudent] = useState<AdminProject | null>(null);
    const [buildProgressBuildId, setBuildProgressBuildId] = useState<number | null>(null);

    // Create Project State
    const [isCreatePopupVisible, setIsCreatePopupVisible] = useState(false);
    const [newProject, setNewProject] = useState({
        student_code: '',
        name: '',
        project_type: 'gd',
        git_repo_url: '',
        expected_image_name: '',
        create_build_config: true,
        generate_deploy_key: true,
        trigger_build: true
    });

    const handleCreateSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const {
            create_build_config,
            generate_deploy_key,
            trigger_build,
            ...payload
        } = newProject;
        try {
            const created = await studentsApi.create({
                ...payload,
                project_type: newProject.project_type as 'gd' | 'cd'
            });

            if (create_build_config && newProject.git_repo_url) {
                try {
                    await buildConfigsApi.updateConfig(created.id, {
                        repo_url: newProject.git_repo_url,
                        branch: 'main',
                        dockerfile_path: 'Dockerfile',
                        context_path: '.',
                        auto_build: true,
                        auto_deploy: true
                    });
                } catch (cfgErr: any) {
                    notify(cfgErr.response?.data?.detail || '????????', 'warning', 2000);
                }
            } else if (create_build_config && !newProject.git_repo_url) {
                notify('???????????????', 'warning', 3000);
            }

            if (generate_deploy_key) {
                if (!newProject.git_repo_url) {
                    notify('??????????? Deploy Key', 'warning', 3000);
                } else {
                    try {
                        await buildConfigsApi.generateDeployKey(created.id, false, true);
                    } catch (keyErr: any) {
                        notify(keyErr.response?.data?.detail || 'Deploy Key ????', 'warning', 3000);
                    }
                }
            }

            if (trigger_build) {
                try {
                    const build = await buildsApi.triggerBuild(created.id);
                    setBuildProgressStudent(created as AdminProject);
                    setBuildProgressBuildId(build.id);
                    setIsBuildProgressVisible(true);
                    notify('???????', 'success', 2000);
                } catch (buildErr: any) {
                    await handleBuildError(buildErr, created as AdminProject);
                }
            }

            notify('??????', 'success', 2000);
            setIsCreatePopupVisible(false);
            setNewProject({
                student_code: '',
                name: '',
                project_type: 'gd',
                git_repo_url: '',
                expected_image_name: '',
                create_build_config: true,
                generate_deploy_key: true,
                trigger_build: true
            });
            loadProjects();
        } catch (err: any) {
            notify(err.response?.data?.detail || '????', 'error', 2000);
        }
    };

    const handleNewProjectChange = (e: any) => {
        if (e.dataField) {
            setNewProject(prev => ({ ...prev, [e.dataField]: e.value }));
        }
    };

    const handleEditClick = (data: AdminProject) => {
        if (data.id === 0) {
            notify('系统项目暂不支持直接编辑', 'warning', 2000);
            return;
        }
        setEditingProject({ ...data }); // Clone data
        setIsPopupVisible(true);
    };

    const openBuildConfigPopup = (studentId: number) => {
        setSelectedStudentId(studentId);
        setIsBuildConfigVisible(true);
    };

    const openBuildHistoryPopup = (studentId: number) => {
        setIsBuildProgressVisible(false);
        setBuildProgressBuildId(null);
        setBuildProgressStudent(null);
        setSelectedStudentId(studentId);
        setIsBuildHistoryReady(false);
        setIsBuildHistoryVisible(true);
    };

    const getErrorDetail = (err: any) => {
        const detail = err?.response?.data?.detail;
        if (!detail) return '';
        return typeof detail === 'string' ? detail : String(detail);
    };

    const handleBuildError = async (err: any, project: AdminProject) => {
        const detail = getErrorDetail(err);
        if (detail.includes('Image repository is not configured')) {
            const ok = await confirm('镜像仓库未配置，是否打开构建配置？', '构建失败');
            if (ok) {
                openBuildConfigPopup(project.id);
            } else {
                notify('可在系统设置配置默认 Registry。', 'info', 3000);
            }
            return;
        }
        notify(detail || '构建失败', 'error', 3000);
    };

    const handleTriggerBuild = async (project: AdminProject) => {
        setIsBuildHistoryVisible(false);
        setIsBuildHistoryReady(false);
        setBuildProgressStudent(project);
        setBuildProgressBuildId(null);
        setIsBuildProgressVisible(true);
        try {
            const build = await buildsApi.triggerBuild(project.id);
            setBuildProgressBuildId(build.id);
            notify('???????', 'success', 2000);
        } catch (err: any) {
            await handleBuildError(err, project);
            setIsBuildProgressVisible(false);
        }
    };

    const handleDeployLatestBuild = async (project: AdminProject) => {
        try {
            await deploymentsApi.deployFromBuild(project.student_code, {
                project_type: project.project_type as 'gd' | 'cd'
            });
            notify('部署任务已提交', 'success', 2000);
            loadProjects();
        } catch (err: any) {
            notify(err.response?.data?.detail || '部署失败', 'error', 3000);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!editingProject.id) return;
            await adminProjectsApi.update(editingProject.id, editingProject);
            notify('项目更新成功', 'success', 2000);
            setIsPopupVisible(false);
            loadProjects();
        } catch (err: any) {
            notify(err.response?.data?.detail || '更新失败', 'error', 2000);
        }
    };

    const onFormOptionChanged = (e: any) => {
        if (e.dataField) {
            setEditingProject(prev => ({ ...prev, [e.dataField]: e.value }));
        }
    };

    const statusCellRender = (cellData: any) => {
        const status = cellData.value;
        let badgeClass = 'st-waiting';
        let statusText = status || '未部署';
        let color = '#999';

        switch (status) {
            case 'running':
            case 'success':
                badgeClass = 'st-success';
                statusText = '运行中';
                color = '#52c41a';
                break;
            case 'error':
            case 'failed':
                badgeClass = 'st-danger';
                statusText = '异常';
                color = '#ff4d4f';
                break;
            case 'deploying':
            case 'pending':
                badgeClass = 'st-waiting';
                statusText = '部署中';
                color = '#1890ff';
                break;
            case 'stopped':
                badgeClass = 'st-default';
                statusText = '已停止';
                color = '#d9d9d9';
                break;
            case 'not_deployed':
                badgeClass = 'st-default';
                statusText = '未部署';
                color = '#d9d9d9';
                break;
        }

        return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className={`status-badge ${badgeClass}`} style={{ marginRight: 8 }}>
                    <span className="dot" style={{ background: color }}></span>
                    {statusText}
                </span>
            </div>
        );
    };

    return (
        <>
            {/* Top Bar */}
            <div className="top-bar">
                <div>
                    <h1 className="page-title">全局项目管理</h1>
                    <div className="page-subtitle">查看所有学生的项目及部署状态</div>
                </div>
                <div className="panel-actions">
                    <Button
                        text="刷新列表"
                        icon="refresh"
                        type="normal"
                        stylingMode="outlined"
                        onClick={loadProjects}
                        height={36}
                    />
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

            <div className="content-scroll">
                <div className="modern-card">
                    {loading ? (
                        <div className="card-body">
                            <div className="empty-state">
                                <i className="dx-icon-refresh"></i>
                                <p>数据加载中...</p>
                            </div>
                        </div>
                    ) : (
                        <DataGrid
                            dataSource={projects}
                            showBorders={false}
                            focusedRowEnabled={true}
                            columnAutoWidth={false}
                            columnMinWidth={120}
                            allowColumnResizing={true}
                            columnResizingMode="widget"
                            keyExpr="id"
                            rowAlternationEnabled={true}
                            columnHidingEnabled={true}
                            noDataText="暂无项目数据"
                            width="100%"
                            wordWrapEnabled={true}
                        >
                            <SearchPanel visible={true} width={300} placeholder="搜索项目..." />
                            <FilterRow visible={true} />
                            <Paging defaultPageSize={10} />

                            <Column dataField="student_code" caption="学号" width={120} fixed={true} />
                            <Column dataField="name" caption="学生姓名" width={120} fixed={true} />
                            <Column
                                dataField="project_type"
                                caption="项目类型"
                                width={120}
                                cellRender={(data) => (
                                    <span className={`tag ${data.value === 'gd' ? 'tag-blue' : 'tag-gray'} `}>
                                        {data.value === 'gd' ? '毕业设计' : (data.value === 'cd' ? '课程设计' : data.value)}
                                    </span>
                                )}
                            />
                            <Column
                                dataField="git_repo_url"
                                caption="Git 仓库"
                                width={110}
                                cellRender={(data) => (
                                    data.value ? (
                                        <a href={data.value} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: '#1890ff' }}>
                                            <i className="dx-icon-globe" style={{ marginRight: 5 }}></i>
                                            查看
                                        </a>
                                    ) : <span style={{ color: '#ccc' }}>-</span>
                                )}
                            />
                            <Column
                                dataField="running_image"
                                caption="当前运行镜像"
                                minWidth={280}
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
                                caption="部署状态"
                                width={160}
                                cellRender={statusCellRender}
                                alignment="center"
                            />
                            <Column
                                dataField="latest_deploy_time"
                                caption="最后部署时间"
                                dataType="datetime"
                                format="yyyy-MM-dd HH:mm"
                                width={160}
                            />
                            <Column
                                dataField="created_at"
                                caption="创建时间"
                                dataType="datetime"
                                format="yyyy-MM-dd HH:mm"
                                width={160}
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
                                            text="编辑"
                                            icon="edit"
                                            type="default"
                                            stylingMode="outlined"
                                            onClick={() => handleEditClick(data.data)}
                                            disabled={data.data.id === 0} // Prevent editing system project
                                            height={24}
                                            style={{ fontSize: 12 }}
                                        />
                                        <Button
                                            text="构建"
                                            icon="refresh"
                                            type="normal"
                                            stylingMode="outlined"
                                            onClick={() => handleTriggerBuild(data.data)}
                                            disabled={data.data.id === 0}
                                            height={24}
                                            style={{ fontSize: 12 }}
                                        />
                                        <Button
                                            text="构建记录"
                                            icon="event"
                                            type="normal"
                                            stylingMode="outlined"
                                            onClick={() => openBuildHistoryPopup(data.data.id)}
                                            disabled={data.data.id === 0}
                                            height={24}
                                            style={{ fontSize: 12 }}
                                        />
                                        <Button
                                            text="部署最新"
                                            icon="arrowup"
                                            type="normal"
                                            stylingMode="outlined"
                                            onClick={() => handleDeployLatestBuild(data.data)}
                                            disabled={data.data.id === 0}
                                            height={24}
                                            style={{ fontSize: 12 }}
                                        />
                                        <Button
                                            text="配置"
                                            icon="optionsgear"
                                            type="normal"
                                            stylingMode="outlined"
                                            onClick={() => openBuildConfigPopup(data.data.id)}
                                            disabled={data.data.id === 0}
                                            height={24}
                                            style={{ fontSize: 12 }}
                                        />
                                    </div>
                                )}
                            />
                        </DataGrid>
                    )}
                </div>

                <Popup
                    visible={isPopupVisible}
                    onHiding={() => setIsPopupVisible(false)}
                    title="编辑项目信息"
                    showTitle={true}
                    dragEnabled={false}
                    width={500}
                    height="auto"
                >
                    <form onSubmit={handleSave}>
                        <Form formData={editingProject} onFieldDataChanged={onFormOptionChanged}>
                            <FormItem dataField="name">
                                <Label text="项目名称" />
                                <RequiredRule message="名称不能为空" />
                            </FormItem>
                            <FormItem dataField="git_repo_url">
                                <Label text="Git 仓库地址" />
                                <RequiredRule message="Git地址不能为空" />
                            </FormItem>
                            
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
                            {/* More fields can be added here if backend supports them */}
                            <div style={{ marginTop: 20, textAlign: 'right' }}>
                                <button className="btn btn-primary" type="submit">保存更改</button>
                            </div>
                        </Form>
                    </form>
                </Popup>

                <Popup
                    visible={isCreatePopupVisible}
                    onHiding={() => setIsCreatePopupVisible(false)}
                    title="新建项目"
                    showTitle={true}
                    dragEnabled={false}
                    width={500}
                    height="auto"
                >
                    <form onSubmit={handleCreateSave}>
                        <Form formData={newProject} onFieldDataChanged={handleNewProjectChange}>
                        <FormItem dataField="student_code">
                            <Label text="?? (Student Code)" />
                            <RequiredRule message="??????" />
                        </FormItem>
                        <FormItem dataField="name">
                            <Label text="????" />
                            <RequiredRule message="??????" />
                        </FormItem>
                        <FormItem
                            dataField="project_type"
                            editorType="dxSelectBox"
                            editorOptions={{
                                items: [
                                    { id: 'gd', text: '????' },
                                    { id: 'cd', text: '????' }
                                ],
                                displayExpr: 'text',
                                valueExpr: 'id'
                            }}
                        >
                            <Label text="????" />
                            <RequiredRule />
                        </FormItem>
                        <FormItem dataField="git_repo_url">
                            <Label text="Git ???? (??)" />
                        </FormItem>
                        <FormItem dataField="expected_image_name">
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
                    </form>
                </Popup>

                <BuildConfigModal
                    visible={isBuildConfigVisible}
                    onClose={() => setIsBuildConfigVisible(false)}
                    studentId={selectedStudentId || 0}
                    onSaved={loadProjects}
                />

                <Popup
                    visible={isBuildHistoryVisible}
                    onHiding={() => {
                        setIsBuildHistoryVisible(false);
                        setIsBuildHistoryReady(false);
                    }}
                    onShown={() => setIsBuildHistoryReady(true)}
                    title="构建记录"
                    showTitle={true}
                    dragEnabled={false}
                    shading={true}
                    showCloseButton={true}
                    container={popupContainer}
                    position="center"
                    width={900}
                    height={520}
                >
                    {isBuildHistoryReady && selectedStudentId ? (
                        <div style={{ height: '100%' }}>
                            <BuildHistory studentId={selectedStudentId} />
                        </div>
                    ) : null}
                </Popup>

                <Popup
                    visible={isBuildProgressVisible}
                    onHiding={() => {
                        setIsBuildProgressVisible(false);
                        setBuildProgressBuildId(null);
                        setBuildProgressStudent(null);
                    }}
                    title={`构建进度 - ${buildProgressStudent?.name || ''}`}
                    showTitle={true}
                    dragEnabled={false}
                    shading={true}
                    showCloseButton={true}
                    container={popupContainer}
                    position="center"
                    width={600}
                    height="auto"
                >
                    {buildProgressStudent ? (
                        <BuildProgress
                            studentId={buildProgressStudent.id}
                            buildId={buildProgressBuildId}
                        />
                    ) : null}
                </Popup>
            </div>
        </>
    );
};

export default AdminProjectsPage;
