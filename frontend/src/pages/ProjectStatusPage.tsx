import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminProjectsApi, AdminProject } from '../api/adminProjects';
import { deploymentsApi } from '../api/deployments';
import Button from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import './ProjectStatusPage.css'; // Will create this css file

// 1. Status Enums (Frontend View)
type DisplayStatus =
    | 'NOT_DEPLOYED'
    | 'BUILDING'
    | 'IMAGE_READY'
    | 'DEPLOYING'
    | 'RUNNING'
    | 'FAILED'
    | 'UPDATING';

const STATUS_CONFIG: Record<DisplayStatus, { color: string; label: string; description?: string }> = {
    NOT_DEPLOYED: { color: '#9E9E9E', label: '尚未部署', description: '项目尚未进行过部署' },
    BUILDING: { color: '#2196F3', label: '正在构建镜像', description: '正在编译代码并构建Docker镜像...' },
    IMAGE_READY: { color: '#9C27B0', label: '镜像就绪', description: '镜像构建完成，等待推送到集群' },
    DEPLOYING: { color: '#FF9800', label: '正在部署到平台', description: '正在调度资源并启动容器...' },
    RUNNING: { color: '#4CAF50', label: '服务运行中', description: '应用已成功启动并运行' },
    FAILED: { color: '#F44336', label: '部署失败', description: '部署过程中遇到错误' },
    UPDATING: { color: '#00BCD4', label: '更新中', description: '正在更新应用配置或镜像...' },
};

const ProjectStatusPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<AdminProject | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [displayStatus, setDisplayStatus] = useState<DisplayStatus>('NOT_DEPLOYED');
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // 2. Map Backend Status to Display Status
    const mapStatus = (backendStatus?: string): DisplayStatus => {
        if (!backendStatus) return 'NOT_DEPLOYED';
        const s = backendStatus.toLowerCase();
        if (s === 'running') return 'RUNNING';
        if (s === 'deploying' || s === 'pending') return 'DEPLOYING';
        if (s === 'failed' || s === 'error') return 'FAILED';
        if (s === 'not_deployed' || s === 'stopped') return 'NOT_DEPLOYED';
        // Mock specific states if needed
        return 'NOT_DEPLOYED';
    };

    const loadProject = useCallback(async () => {
        if (!id) return;
        try {
            const data = await adminProjectsApi.get(Number(id));
            setProject(data);
            setDisplayStatus(mapStatus(data.latest_deploy_status));
            setLastUpdated(new Date());
            setIsLoading(false);
        } catch (err) {
            notify('加载项目状态失败', 'error', 2000);
            setIsLoading(false);
        }
    }, [id]);

    // 3. Polling
    useEffect(() => {
        loadProject();
        const interval = setInterval(loadProject, 5000); // 5s Polling
        return () => clearInterval(interval);
    }, [loadProject]);

    // 4. Actions
    const handleDeploy = async () => {
        if (!project) return;
        setIsActionLoading(true);
        try {
            await deploymentsApi.triggerDeploy(project.student_code, {
                project_type: project.project_type,
                image: project.expected_image_name || '' // Use expected if set, else empty (default)
            });
            notify('部署指令已下达', 'success', 2000);
            setDisplayStatus('DEPLOYING'); // Optimistic update
            loadProject();
        } catch (err: any) {
            notify(err.response?.data?.detail || '部署请求失败', 'error', 3000);
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading && !project) {
        return <div className="status-page-loading">加载中...</div>;
    }

    if (!project) {
        return <div className="status-page-error">项目不存在</div>;
    }

    const statusInfo = STATUS_CONFIG[displayStatus];
    const canDeploy = ['NOT_DEPLOYED', 'IMAGE_READY', 'FAILED', 'RUNNING'].includes(displayStatus);

    return (
        <div className="project-status-page">
            <div className="status-header">
                <Button icon="back" onClick={() => navigate(-1)} stylingMode="text" />
                <h2>项目监控: {project.name}</h2>
            </div>

            <div className="status-container">
                {/* 1. Basic Info */}
                <section className="status-section info-section">
                    <h3>项目基本信息</h3>
                    <div className="info-grid">
                        <div className="info-item">
                            <label>学生编号</label>
                            <span>{project.student_code}</span>
                        </div>
                        <div className="info-item">
                            <label>项目类型</label>
                            <span>{project.project_type === 'gd' ? '毕业设计' : (project.project_type === 'cd' ? '课程设计' : '平台系统')}</span>
                        </div>
                        <div className="info-item">
                            <label>Git 仓库</label>
                            <a href={project.git_repo_url} target="_blank" rel="noreferrer">{project.git_repo_url || '-'}</a>
                        </div>
                        <div className="info-item">
                            <label>访问域名</label>
                            {displayStatus === 'RUNNING' && project.domain ? (
                                <a href={`http://${project.domain}`} target="_blank" rel="noreferrer">{project.domain}</a>
                            ) : <span>-</span>}
                        </div>
                    </div>
                </section>

                {/* 2. Current Status (Core) */}
                <section className="status-section core-status-section" style={{ borderLeft: `6px solid ${statusInfo.color}` }}>
                    <div className="status-main">
                        <div className="status-badge" style={{ backgroundColor: statusInfo.color }}>
                            {statusInfo.label}
                        </div>
                        <p className="status-desc">{statusInfo.description}</p>
                        <div className="status-meta">
                            <span>最近更新: {lastUpdated.toLocaleTimeString()}</span>
                            <div className="running-image-container">
                                <span className="meta-label">当前镜像:</span>
                                <div className="image-list">
                                    {project.running_image && project.running_image !== '-' ? (
                                        project.running_image.split('\n').map((img, idx) => (
                                            <div key={idx} className="image-item" title={img}>
                                                {img}
                                            </div>
                                        ))
                                    ) : (
                                        <span>-</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3 & 4. Build & Deploy Info (Simplified placeholder as backend doesn't separate yet) */}
                <div className="multi-column-section">
                    <section className="status-section">
                        <h3>最近一次构建</h3>
                        <div className="detail-row">
                            <span>状态:</span> <span className="text-gray">未知 (CI未接入)</span>
                        </div>
                        <div className="detail-row">
                            <span>镜像Tag:</span> <span>latest</span>
                        </div>
                    </section>

                    <section className="status-section">
                        <h3>最近一次部署</h3>
                        <div className="detail-row">
                            <span>时间:</span> <span>{project.latest_deploy_time ? new Date(project.latest_deploy_time).toLocaleString() : '-'}</span>
                        </div>
                        <div className="detail-row">
                            <span>结果:</span>
                            <span style={{ color: displayStatus === 'FAILED' ? 'red' : (displayStatus === 'RUNNING' ? 'green' : 'inherit') }}>
                                {displayStatus}
                            </span>
                        </div>
                    </section>
                </div>

                {/* 5. Run & Access */}
                {displayStatus === 'RUNNING' && (
                    <section className="status-section run-section">
                        <h3>运行访问</h3>
                        <div className="access-box">
                            <p>您的应用正在运行，可以通过以下地址访问：</p>
                            <a href={`http://${project.domain}`} target="_blank" rel="noreferrer" className="access-link">
                                http://{project.domain}
                            </a>
                        </div>
                    </section>
                )}

                {/* 6. Actions */}
                <section className="status-section action-section">
                    <h3>操作</h3>
                    <div className="action-buttons">
                        <Button
                            text={displayStatus === 'RUNNING' || displayStatus === 'FAILED' ? "重新部署" : "开始部署"}
                            type="default"
                            stylingMode="contained"
                            disabled={!canDeploy || isActionLoading}
                            onClick={handleDeploy}
                            width={150}
                            height={40}
                        />
                        {/* More buttons like Rollback could go here */}
                    </div>
                </section>

                {/* 7. Diagnostics */}
                {displayStatus === 'FAILED' && (
                    <section className="status-section diagnostic-section">
                        <h3>诊断报告</h3>
                        <div className="diagnostic-box">
                            <div className="diagnostic-title">可能的原因 (Reason)</div>
                            <div className="diagnostic-content">
                                {project.latest_deploy_message || '未知错误，请检查日志或联系管理员。'}
                            </div>
                            <div className="diagnostic-tip">
                                💡 建议检查：
                                <ul>
                                    <li>Git 仓库地址是否正确？</li>
                                    <li>代码是否能在本地能够通过编译？</li>
                                    <li>如果是镜像拉取失败，请检查镜像名称是否正确。</li>
                                </ul>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

export default ProjectStatusPage;
