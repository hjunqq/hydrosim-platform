import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DataGrid, { Column, FilterRow, Paging, SearchPanel } from 'devextreme-react/data-grid';
import { adminProjectsApi, AdminProject } from '../api/adminProjects';
import { studentsApi } from '../api/students'; // Added import
import { Popup } from 'devextreme-react/popup';
import Form, { Item as FormItem, Label, RequiredRule } from 'devextreme-react/form';
import Button from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';

const AdminProjectsPage = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<AdminProject[]>([]);
    const [loading, setLoading] = useState(true);

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

    // Create Project State
    const [isCreatePopupVisible, setIsCreatePopupVisible] = useState(false);
    const [newProject, setNewProject] = useState({
        student_code: '',
        name: '',
        project_type: 'gd',
        git_repo_url: '',
        expected_image_name: ''
    });

    const handleCreateSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await studentsApi.create({
                ...newProject,
                project_type: newProject.project_type as 'gd' | 'cd'
            });
            notify('项目创建成功', 'success', 2000);
            setIsCreatePopupVisible(false);
            setNewProject({ student_code: '', name: '', project_type: 'gd', git_repo_url: '', expected_image_name: '' });
            loadProjects();
        } catch (err: any) {
            notify(err.response?.data?.detail || '创建失败', 'error', 2000);
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
                            columnAutoWidth={true}
                            keyExpr="id"
                            rowAlternationEnabled={true}
                            noDataText="暂无项目数据"
                        >
                            <SearchPanel visible={true} width={300} placeholder="搜索项目..." />
                            <FilterRow visible={true} />
                            <Paging defaultPageSize={10} />

                        <Column dataField="student_code" caption="学号" width={120} />
                        <Column dataField="name" caption="学生姓名" width={120} />
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
                            width={250}
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
                            width={120}
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
                            dataField="latest_deploy_time"
                            caption="最后部署时间"
                            dataType="datetime"
                            format="yyyy-MM-dd HH:mm"
                            width={150}
                        />
                        <Column
                            caption="操作"
                            width={180}
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
                                    < Button
                                        text="编辑"
                                        type="default"
                                        stylingMode="outlined"
                                        onClick={() => handleEditClick(data.data)}
                                        disabled={data.data.id === 0} // Prevent editing system project
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
                        <FormItem dataField="expected_image_name" helpText="若填写，将校验运行镜像是否包含该关键词">
                            <Label text="预期镜像关键词 (可选验证)" />
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
                            <Label text="学号 (Student Code)" />
                            <RequiredRule message="学号不能为空" />
                        </FormItem>
                        <FormItem dataField="name">
                            <Label text="项目名称" />
                            <RequiredRule message="名称不能为空" />
                        </FormItem>
                        <FormItem
                            dataField="project_type"
                            editorType="dxSelectBox"
                            editorOptions={{
                                items: [{ id: 'gd', text: '毕业设计' }, { id: 'cd', text: '课程设计' }],
                                displayExpr: 'text',
                                valueExpr: 'id'
                            }}
                        >
                            <Label text="项目类型" />
                            <RequiredRule />
                        </FormItem>
                        <FormItem dataField="git_repo_url">
                            <Label text="Git 仓库地址 (可选)" />
                        </FormItem>
                        <FormItem dataField="expected_image_name" helpText="若填写，将校验运行镜像是否包含该关键词">
                            <Label text="预期镜像关键词 (可选验证)" />
                        </FormItem>
                        <div style={{ marginTop: 20, textAlign: 'right' }}>
                            <button className="btn btn-primary" type="submit">创建项目</button>
                        </div>
                    </Form>
                </form>
            </Popup>
        </div>
    </>
    );
};

export default AdminProjectsPage;
