import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminProjectsApi, AdminProject } from '../api/adminProjects';
import { projectsApi } from '../api/projects';
import { deploymentsApi } from '../api/deployments';
import Button from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import { LoadPanel } from 'devextreme-react/load-panel';
import './ProjectStatusPage.css';

// --- Types & Config ---
type DisplayStatus =
    | 'NOT_DEPLOYED'
    | 'BUILDING'
    | 'IMAGE_READY'
    | 'DEPLOYING'
    | 'RUNNING'
    | 'FAILED'
    | 'UPDATING';

interface StatusConfig {
    color: string;
    label: string;
    description: string;
    icon: string;
    cssClass: string;
}

const STATUS_CONFIG: Record<DisplayStatus, StatusConfig> = {
    NOT_DEPLOYED: { color: '#9E9E9E', label: '尚未部署', description: '该项目暂无部署记录', icon: 'dx-icon-info', cssClass: 'status-default' },
    BUILDING: { color: '#2196F3', label: '正在构建', description: '系统正在构建Docker镜像...', icon: 'dx-icon-toolbox', cssClass: 'status-deploying' },
    IMAGE_READY: { color: '#9C27B0', label: '镜像就绪', description: '镜像已推送到仓库，准备部署', icon: 'dx-icon-box', cssClass: 'status-deploying' },
    DEPLOYING: { color: '#FF9800', label: '部署中', description: '正在调度资源并启动容器...', icon: 'dx-icon-runner', cssClass: 'status-deploying' },
    RUNNING: { color: '#52c41a', label: '运行正常', description: '服务健康检查通过，运行中', icon: 'dx-icon-check', cssClass: 'status-running' },
    FAILED: { color: '#ff4d4f', label: '部署失败', description: '部署流程异常终止', icon: 'dx-icon-close', cssClass: 'status-failed' },
    UPDATING: { color: '#1890ff', label: '更新中', description: '正在应用新的配置...', icon: 'dx-icon-refresh', cssClass: 'status-deploying' },
};

const ProjectStatusPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<AdminProject | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [displayStatus, setDisplayStatus] = useState<DisplayStatus>('NOT_DEPLOYED');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Auto-refresh interval ref
    const intervalRef = useRef<NodeJS.Timeout>();

    const mapStatus = (backendStatus?: string): DisplayStatus => {
        if (!backendStatus) return 'NOT_DEPLOYED';
        const s = backendStatus.toLowerCase();
        if (s === 'running' || s === 'success') return 'RUNNING';
        if (s === 'deploying' || s === 'pending') return 'DEPLOYING';
        if (s === 'failed' || s === 'error') return 'FAILED';
        if (s === 'not_deployed' || s === 'stopped') return 'NOT_DEPLOYED';
        return 'NOT_DEPLOYED';
    };

    const loadProject = useCallback(async (silent = false) => {
        if (!id) return;
        try {
            if (!silent) setIsRefreshing(true);
            const data = (id === 'me' ? await projectsApi.getMe() : await adminProjectsApi.get(Number(id))) as AdminProject;
            setProject(data);
            setDisplayStatus(mapStatus(data.latest_deploy_status));
            setLastUpdated(new Date());
        } catch (err) {
            console.error(err);
            notify('无法获取项目状态', 'error', 2000);
        } finally {
            if (!silent) {
                setIsRefreshing(false);
                setIsLoading(false);
            }
        }
    }, [id]);

    useEffect(() => {
        loadProject();
        intervalRef.current = setInterval(() => loadProject(true), 5000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [loadProject]);

    const handleDeploy = async () => {
        if (!project) return;
        try {
            await deploymentsApi.triggerDeploy(project.student_code, {
                project_type: project.project_type,
                image: project.expected_image_name || ''
            });
            notify('部署任务已提交', 'success', 2000);
            setDisplayStatus('DEPLOYING');
            loadProject(true);
        } catch (err: any) {
            notify(err.response?.data?.detail || '部署失败', 'error', 3000);
        }
    };

    if (isLoading && !project) {
        return <LoadPanel visible={true} />;
    }

    if (!project) {
        return <div className="error-container">项目不存在或无法访问</div>;
    }

    const currentConfig = STATUS_CONFIG[displayStatus];
    const canDeploy = ['NOT_DEPLOYED', 'IMAGE_READY', 'FAILED', 'RUNNING'].includes(displayStatus);

    return (
        <div className="fade-in">
            {/* Top Bar */}
            <div className="top-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Button icon="arrowleft" stylingMode="text" onClick={() => navigate(-1)} />
                    <div>
                        <h1 className="page-title">项目监控台</h1>
                        <div className="page-subtitle">
                            Monitor & Control: {project.name}
                        </div>
                    </div>
                </div>
                <div className="panel-actions">
                    <span style={{ fontSize: 13, color: 'var(--text-3)', marginRight: 8, fontFamily: 'monospace' }}>
                        LAST UPDATE: {lastUpdated.toLocaleTimeString()}
                    </span>
                    <Button
                        icon={isRefreshing ? "refresh spin" : "refresh"}
                        stylingMode="text"
                        onClick={() => loadProject()}
                        elementAttr={{ class: isRefreshing ? "refresh-spin" : "" }}
                    />
                </div>
            </div>

            <div className="content-scroll">
                <div className="status-dashboard-grid">

                    {/* LEFT COLUMN: Main Status */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                        {/* 1. Deployment Hero Card */}
                        <div className={`modern-card deploy-status-card ${currentConfig.cssClass}`}>
                            <div className="deploy-header">
                                <div className="deploy-title">
                                    <i className="dx-icon-activefolder"></i>
                                    Deployment Status
                                </div>
                                {displayStatus === 'RUNNING' && project.domain && (
                                    <a href={`http://${project.domain}`} target="_blank" rel="noreferrer" className="tag tag-success"
                                        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', fontSize: 13 }}>
                                        <i className="dx-icon-globe"></i> 访问应用门户
                                    </a>
                                )}
                            </div>

                            <div className="deploy-state">
                                <div className="deploy-state-icon">
                                    <i className={currentConfig.icon}></i>
                                </div>
                                <div className="deploy-state-label">
                                    {currentConfig.label}
                                </div>
                                <div className="deploy-state-desc">
                                    {currentConfig.description}
                                </div>
                            </div>

                            {/* Meta Grid */}
                            <div className="deploy-meta-grid">
                                <div className="meta-box">
                                    <span className="meta-label">运行镜像 (LIVE IMAGE)</span>
                                    <div className="image-tags-row">
                                        {project.running_image ? (
                                            project.running_image.split('\n').map((img, i) => (
                                                <div key={i} className="image-tag-pill" title={img}>{img}</div>
                                            ))
                                        ) : <span className="meta-value">-</span>}
                                    </div>
                                </div>
                                <div className="meta-box">
                                    <span className="meta-label">部署时间 (DEPLOYED AT)</span>
                                    <span className="meta-value">
                                        {project.latest_deploy_time ? new Date(project.latest_deploy_time).toLocaleString() : '-'}
                                    </span>
                                </div>
                                <div className="meta-box">
                                    <span className="meta-label">Trace ID</span>
                                    <span className="meta-value" style={{ fontFamily: 'monospace' }}>#{project.latest_deploy_id || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Action Area */}
                        <div className="action-area">
                            <div className="action-text">
                                <h4>项目操作 (Operations)</h4>
                                <p>您可以手动重新触发部署流程。这将拉取 Git 最新代码并重建。</p>
                            </div>
                            <Button
                                text={displayStatus === 'RUNNING' ? "重新部署 (Redeploy)" : "开始部署 (Deploy)"}
                                type="default"
                                stylingMode="contained"
                                icon="upload"
                                disabled={!canDeploy}
                                onClick={handleDeploy}
                                height={44}
                                width={180}
                                style={{ borderRadius: 8, fontWeight: 600, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)' }}
                            />
                        </div>

                        {/* 3. Diagnostics / Logs (Mac Terminal Style) */}
                        {displayStatus === 'FAILED' && (
                            <div className="terminal-card">
                                <div className="terminal-header">
                                    <div className="window-dot dot-red"></div>
                                    <div className="window-dot dot-yellow"></div>
                                    <div className="window-dot dot-green"></div>
                                    <div className="terminal-title">deployment-diagnostics — sash — 80x24</div>
                                </div>
                                <div className="terminal-body">
                                    <div className="log-line system">[System] Starting diagnostic analysis...</div>
                                    <div className="log-line error">[Error] Deployment terminated unexpectedly.</div>
                                    <br />
                                    <div className="log-line error">
                                        {project.latest_deploy_message || ">> Error: No detailed log message provided by backend."}
                                    </div>
                                    <br />
                                    <div className="log-line info">{'>'} Solution Hint:</div>
                                    <div className="log-line">  1. Check your `Dockerfile` syntax.</div>
                                    <div className="log-line">  2. Verify network connectivity to registry.</div>
                                    <div className="log-line">  3. Ensure application listens on port 80.</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div className="modern-card">
                            <div className="deploy-header">
                                <div className="deploy-title">项目详情 (Details)</div>
                            </div>
                            <div className="info-list">
                                <div className="info-row">
                                    <span className="info-key">学生姓名</span>
                                    <span className="info-val">{project.name}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-key">学号</span>
                                    <span className="info-val" style={{ fontFamily: 'monospace' }}>{project.student_code}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-key">项目类型</span>
                                    <div className="info-val">
                                        <span className={`status-label-small ${project.project_type === 'gd' ? 'st-gd' : 'st-cd'}`}>
                                            {project.project_type === 'gd' ? '毕业设计' : (project.project_type === 'cd' ? '课程设计' : '系统')}
                                        </span>
                                    </div>
                                </div>
                                <div className="info-row">
                                    <span className="info-key">Git 仓库</span>
                                    <span className="info-val">
                                        <a href={project.git_repo_url} target="_blank" rel="noopener noreferrer">
                                            Link <i className="dx-icon-link"></i>
                                        </a>
                                    </span>
                                </div>
                                <div className="info-row">
                                    <span className="info-key">创建于</span>
                                    <span className="info-val">{new Date(project.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="modern-card">
                            <div className="deploy-header">
                                <div className="deploy-title">资源配额 (Quota)</div>
                            </div>
                            <div style={{ padding: '24px' }}>
                                <div className="quota-row">
                                    <div className="quota-circle"><i className="dx-icon-cpu"></i></div>
                                    <div className="quota-info">
                                        <div className="quota-label">CPU Limit</div>
                                        <div className="quota-value">0.5 Core</div>
                                    </div>
                                </div>
                                <div className="quota-row">
                                    <div className="quota-circle"><i className="dx-icon-info"></i></div>
                                    <div className="quota-info">
                                        <div className="quota-label">Memory Limit</div>
                                        <div className="quota-value">512 MiB</div>
                                    </div>
                                </div>
                                <div className="quota-row">
                                    <div className="quota-circle"><i className="dx-icon-variable"></i></div>
                                    <div className="quota-info">
                                        <div className="quota-label">Replicas</div>
                                        <div className="quota-value">1</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ProjectStatusPage;
